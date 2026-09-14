import 'server-only'
import { and, desc, eq, isNull, or } from 'drizzle-orm'
import { db } from '@/db'
import { payments, subscriptions } from '@/db/schema'
import { getPricingPlan, isPricingPlanId, type PricingPlanId } from './plans'
import { planRank } from './entitlements'

const DAY_MS = 24 * 60 * 60 * 1000
const ACCESS_DAYS = 30

export type SubscriptionRecord = typeof subscriptions.$inferSelect

export type PublicSubscription = {
  id: string
  email: string
  planId: PricingPlanId
  planName: string
  status: string
  startsAt: string | null
  expiresAt: string | null
  nextPlanId: string | null
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function addDays(from: Date, days: number) {
  return new Date(from.getTime() + days * DAY_MS)
}

function toPublic(row: SubscriptionRecord): PublicSubscription | null {
  if (!isPricingPlanId(row.planId)) return null
  const plan = getPricingPlan(row.planId)
  return {
    id: row.id,
    email: row.email,
    planId: row.planId,
    planName: plan?.name || row.planId,
    status: row.status,
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    nextPlanId: row.nextPlanId,
  }
}

async function expireIfNeeded(row: SubscriptionRecord) {
  if (row.status !== 'active' || !row.expiresAt || row.expiresAt.getTime() > Date.now()) {
    return row
  }

  if (row.nextPlanId && isPricingPlanId(row.nextPlanId)) {
    const startsAt = new Date()
    const [updated] = await db
      .update(subscriptions)
      .set({
        planId: row.nextPlanId,
        nextPlanId: null,
        status: 'active',
        startsAt,
        expiresAt: addDays(startsAt, ACCESS_DAYS),
      })
      .where(eq(subscriptions.id, row.id))
      .returning()
    return updated ?? { ...row, status: 'expired' as const }
  }

  const [updated] = await db
    .update(subscriptions)
    .set({ status: 'expired' })
    .where(eq(subscriptions.id, row.id))
    .returning()
  return updated ?? { ...row, status: 'expired' }
}

async function findLatestForIdentity(input: { userId?: string | null; email?: string | null }) {
  const email = input.email ? normalizeEmail(input.email) : null
  const clauses = [
    input.userId ? eq(subscriptions.userId, input.userId) : undefined,
    email ? eq(subscriptions.email, email) : undefined,
  ].filter(Boolean)

  if (clauses.length === 0) return null

  const [row] = await db
    .select()
    .from(subscriptions)
    .where(or(...clauses))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(1)

  return row ?? null
}

export async function getSubscriptionForIdentity(input: {
  userId?: string | null
  email?: string | null
}) {
  const row = await findLatestForIdentity(input)
  if (!row) return null
  const current = await expireIfNeeded(row)
  return toPublic(current)
}

export async function getActiveSubscription(input: {
  userId?: string | null
  email?: string | null
}) {
  const sub = await getSubscriptionForIdentity(input)
  if (!sub || sub.status !== 'active') return null
  return sub
}

export async function attachSubscriptionToUser(input: { userId: string; email: string }) {
  const email = normalizeEmail(input.email)
  await db
    .update(subscriptions)
    .set({ userId: input.userId })
    .where(and(eq(subscriptions.email, email), isNull(subscriptions.userId)))

  return getSubscriptionForIdentity({ userId: input.userId, email })
}

export type ActivateInput = {
  pineOrderId: string
  merchantOrderReference: string
  email: string
  mobile?: string | null
  planId: string
  amountPaise: number
  userId?: string | null
}

export async function activateSubscription(input: ActivateInput) {
  if (!isPricingPlanId(input.planId)) {
    throw new Error('Invalid plan')
  }

  const email = normalizeEmail(input.email)
  const pineOrderId = input.pineOrderId.trim()
  const merchantOrderReference = input.merchantOrderReference.trim()

  if (!pineOrderId || !merchantOrderReference || !email) {
    throw new Error('Missing payment identity')
  }

  const existingPayment = pineOrderId
    ? (
        await db
          .select()
          .from(payments)
          .where(eq(payments.pineOrderId, pineOrderId))
          .limit(1)
      )[0]
    : null

  if (existingPayment) {
    const existingSub = existingPayment.subscriptionId
      ? (
          await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, existingPayment.subscriptionId))
            .limit(1)
        )[0]
      : await findLatestForIdentity({ email, userId: input.userId })
    if (existingSub) {
      return { alreadyProcessed: true as const, subscription: toPublic(await expireIfNeeded(existingSub)) }
    }
  }

  const current = await findLatestForIdentity({ email, userId: input.userId })
  const now = new Date()
  const incomingRank = planRank(input.planId)
  const currentRank = current ? planRank(current.planId) : 0
  const currentActive =
    current?.status === 'active' && current.expiresAt && current.expiresAt.getTime() > now.getTime()

  let startsAt = now
  let expiresAt = addDays(now, ACCESS_DAYS)
  let planId: PricingPlanId = input.planId
  let nextPlanId: string | null = current?.nextPlanId ?? null

  if (currentActive && current) {
    if (incomingRank > currentRank) {
      planId = input.planId
      startsAt = now
      expiresAt = addDays(now, ACCESS_DAYS)
      nextPlanId = null
    } else if (incomingRank === currentRank) {
      planId = current.planId as PricingPlanId
      startsAt = current.startsAt ?? now
      expiresAt = addDays(current.expiresAt && current.expiresAt > now ? current.expiresAt : now, ACCESS_DAYS)
    } else {
      planId = current.planId as PricingPlanId
      startsAt = current.startsAt ?? now
      expiresAt = current.expiresAt ?? addDays(now, ACCESS_DAYS)
      nextPlanId = input.planId
    }
  }

  let subscriptionId = current?.id
  if (current) {
    const [updated] = await db
      .update(subscriptions)
      .set({
        userId: input.userId || current.userId,
        email,
        mobile: input.mobile || current.mobile,
        planId,
        nextPlanId,
        status: 'active',
        startsAt,
        expiresAt,
        pineOrderId,
        merchantOrderReference,
      })
      .where(eq(subscriptions.id, current.id))
      .returning()
    subscriptionId = updated?.id ?? current.id
  } else {
    const [created] = await db
      .insert(subscriptions)
      .values({
        userId: input.userId || null,
        email,
        mobile: input.mobile || null,
        planId,
        nextPlanId,
        status: 'active',
        startsAt,
        expiresAt,
        pineOrderId,
        merchantOrderReference,
      })
      .returning()
    subscriptionId = created?.id
  }

  if (!subscriptionId) {
    throw new Error('Could not save subscription')
  }

  await db.insert(payments).values({
    subscriptionId,
    email,
    planId: input.planId,
    amountPaise: input.amountPaise,
    currency: 'INR',
    pineOrderId,
    status: 'paid',
    paidAt: now,
  })

  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1)

  return { alreadyProcessed: false as const, subscription: row ? toPublic(row) : null }
}
