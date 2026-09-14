import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { backendGetSubscription } from '@/lib/subscriptions/backend'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const subscription = await backendGetSubscription({
      userId: user.id,
      email: user.email,
    })
    return NextResponse.json({ subscription })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not load subscription' },
      { status: 502 }
    )
  }
}
