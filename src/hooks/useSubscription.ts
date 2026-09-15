'use client'

import { useEffect, useState } from 'react'
import { canAccess, type SubscriptionFeature } from '@/lib/subscriptions/entitlements'
import type { PricingPlanId } from '@/lib/subscriptions/plans'

export type ClientSubscription = {
  id: string
  email: string
  planId: PricingPlanId
  planName: string
  status: string
  startsAt: string | null
  expiresAt: string | null
  nextPlanId: string | null
}

function isActiveSubscription(subscription: ClientSubscription | null) {
  if (!subscription || subscription.status !== 'active') return false
  if (!subscription.expiresAt) return true
  return new Date(subscription.expiresAt).getTime() > Date.now()
}

export function daysLeft(expiresAt: string | null | undefined) {
  if (!expiresAt) return null
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000))
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<ClientSubscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeFromApi, setActiveFromApi] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/subscriptions/me', { cache: 'no-store' })
        const data = (await res.json()) as {
          active?: boolean
          subscription?: ClientSubscription | null
        }
        if (!cancelled) {
          setSubscription(data.subscription ?? null)
          setActiveFromApi(typeof data.active === 'boolean' ? data.active : null)
        }
      } catch {
        if (!cancelled) {
          setSubscription(null)
          setActiveFromApi(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const active = activeFromApi ?? isActiveSubscription(subscription)
  return {
    subscription,
    loading,
    active,
    planId: active ? subscription?.planId ?? null : null,
    daysRemaining: daysLeft(subscription?.expiresAt),
    canAccess: (feature: SubscriptionFeature) =>
      canAccess(feature, active ? subscription?.planId : null),
  }
}
