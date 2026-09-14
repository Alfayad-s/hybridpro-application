import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { backendAttachSubscription } from '@/lib/subscriptions/backend'

export const runtime = 'nodejs'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const subscription = await backendAttachSubscription({
      userId: user.id,
      email: user.email,
    })
    return NextResponse.json({ ok: true, subscription })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not attach subscription' },
      { status: 502 }
    )
  }
}
