import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import {
  backendAttachSubscription,
  backendGetPlan,
} from '@/lib/subscriptions/backend'
import {
  attachSubscriptionToUser,
  getSubscriptionForIdentity,
} from '@/lib/subscriptions/service'

export const runtime = 'nodejs'

function planPayload(
  plan: {
    active?: boolean
    planId?: string | null
    planName?: string | null
    expiresAt?: string | null
    daysRemaining?: number | null
    subscription?: unknown
  },
  subscription: unknown
) {
  const active = Boolean(plan.active)
  return {
    active,
    planId: active ? plan.planId ?? null : null,
    planName: active ? plan.planName ?? null : null,
    expiresAt: plan.expiresAt ?? null,
    daysRemaining: plan.daysRemaining ?? null,
    subscription: subscription ?? plan.subscription ?? null,
  }
}

function fromLocalSubscription(
  subscription: Awaited<ReturnType<typeof getSubscriptionForIdentity>>
) {
  const active = Boolean(
    subscription &&
      subscription.status === 'active' &&
      (!subscription.expiresAt || new Date(subscription.expiresAt).getTime() > Date.now())
  )
  const daysRemaining =
    active && subscription?.expiresAt
      ? Math.max(
          0,
          Math.ceil((new Date(subscription.expiresAt).getTime() - Date.now()) / 86_400_000)
        )
      : null
  return planPayload(
    {
      active,
      planId: subscription?.planId ?? null,
      planName: subscription?.planName ?? null,
      expiresAt: subscription?.expiresAt ?? null,
      daysRemaining,
    },
    subscription
  )
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await backendAttachSubscription({
      userId: user.id,
      email: user.email,
    })
  } catch (error) {
    console.error('[subscriptions/me] attach backend', error)
  }

  try {
    await attachSubscriptionToUser({
      userId: user.id,
      email: user.email,
    })
  } catch (error) {
    console.error('[subscriptions/me] attach local', error)
  }

  try {
    const plan = await backendGetPlan({
      userId: user.id,
      email: user.email,
    })
    if (plan.active) {
      return NextResponse.json(planPayload(plan, plan.subscription))
    }
  } catch (error) {
    console.error('[subscriptions/me] backend plan', error)
  }

  try {
    const subscription = await getSubscriptionForIdentity({
      userId: user.id,
      email: user.email,
    })
    return NextResponse.json(fromLocalSubscription(subscription))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not load subscription' },
      { status: 502 }
    )
  }
}
