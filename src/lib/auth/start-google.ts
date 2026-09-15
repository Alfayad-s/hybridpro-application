'use client'

import { appAuthCallbackUrl, setClientAuthNextPath } from '@/lib/auth/oauth-redirect'
import { LANDING_PLANS_PATH } from '@/lib/subscriptions/plans'
import { createClient } from '@/utils/supabase/client'

export async function startGoogleSignIn(next = LANDING_PLANS_PATH) {
  const statusRes = await fetch('/api/auth/google/status', { cache: 'no-store' })
  const status = (await statusRes.json().catch(() => null)) as
    | { enabled?: boolean; error?: string }
    | null
  if (!statusRes.ok || !status?.enabled) {
    throw new Error(
      status?.error ||
        'Google sign-in is not enabled yet. In Supabase → Authentication → Providers, turn on Google and add your Client ID / Secret.'
    )
  }

  setClientAuthNextPath(next)
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: appAuthCallbackUrl(),
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
      skipBrowserRedirect: true,
    },
  })

  if (error) throw error
  if (!data.url) {
    throw new Error('Could not start Google sign-in. Check your Supabase Google provider settings.')
  }

  window.location.assign(data.url)
}
