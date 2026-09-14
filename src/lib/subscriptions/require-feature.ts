import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { backendGetSubscription } from './backend'
import { canAccess, type SubscriptionFeature } from './entitlements'
import type { PricingPlanId } from './plans'

type PublicSubscription = {
  planId?: PricingPlanId
  status?: string
}

export async function requireFeature(feature: SubscriptionFeature) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  let subscription: PublicSubscription | null = null
  try {
    subscription = (await backendGetSubscription({
      userId: user.id,
      email: user.email,
    })) as PublicSubscription | null
  } catch (error) {
    console.error('[require-feature]', error)
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Subscription service unavailable' }, { status: 503 }),
    }
  }

  const planId = subscription?.status === 'active' ? subscription.planId : null
  if (!canAccess(feature, planId)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: 'Upgrade required',
          feature,
          planId: planId ?? null,
        },
        { status: 403 }
      ),
    }
  }

  return { ok: true as const, user, subscription }
}
