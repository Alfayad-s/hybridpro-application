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

export function useSubscription() {
  const [subscription, setSubscription] = useState<ClientSubscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/subscriptions/me', { cache: 'no-store' })
        const data = (await res.json()) as { subscription?: ClientSubscription | null }
        if (!cancelled) setSubscription(data.subscription ?? null)
      } catch {
        if (!cancelled) setSubscription(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const active = subscription?.status === 'active'
  return {
    subscription,
    loading,
    active,
    planId: active ? subscription?.planId ?? null : null,
    canAccess: (feature: SubscriptionFeature) => canAccess(feature, active ? subscription?.planId : null),
  }
}
