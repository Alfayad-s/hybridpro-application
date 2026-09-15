import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import {
  backendAttachSubscription,
  backendGetPlan,
} from '@/lib/subscriptions/backend'

export const runtime = 'nodejs'

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
    console.error('[subscriptions/me] attach', error)
  }

  try {
    const plan = await backendGetPlan({
      userId: user.id,
      email: user.email,
    })
    return NextResponse.json({
      active: Boolean(plan.active),
      planId: plan.planId ?? null,
      planName: plan.planName ?? null,
      expiresAt: plan.expiresAt ?? null,
      daysRemaining: plan.daysRemaining ?? null,
      subscription: plan.subscription ?? null,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not load subscription' },
      { status: 502 }
    )
  }
}
