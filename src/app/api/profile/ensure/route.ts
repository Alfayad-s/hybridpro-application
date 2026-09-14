import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { ensureProfile } from '@/lib/auth/ensure-profile'
import { avatarUrlFromAuthUser, fullNameFromAuthUser } from '@/lib/auth/user-display'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { fullName?: string | null; avatarUrl?: string | null } = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine — we'll use auth metadata
  }

  const result = await ensureProfile({
    id: user.id,
    fullName: body.fullName ?? fullNameFromAuthUser(user),
    avatarUrl: body.avatarUrl ?? avatarUrlFromAuthUser(user),
    email: user.email,
  })

  return NextResponse.json(result)
}
