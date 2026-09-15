import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { ensureProfile } from '@/lib/auth/ensure-profile'
import {
  AUTH_NEXT_COOKIE,
  publicAuthOrigin,
  readAuthNextCookie,
} from '@/lib/auth/oauth-redirect'
import {
  avatarUrlFromAuthUser,
  fullNameFromAuthUser,
  safeAuthNextPath,
} from '@/lib/auth/user-display'

function loginErrorRedirect(origin: string, error: string, message?: string) {
  const params = new URLSearchParams({ error })
  if (message) params.set('message', message)
  return NextResponse.redirect(`${origin}/login?${params.toString()}`)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const origin = publicAuthOrigin(request)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as
    | 'signup'
    | 'invite'
    | 'magiclink'
    | 'recovery'
    | 'email_change'
    | 'email'
    | null
  const oauthError = searchParams.get('error')
  const oauthDescription = searchParams.get('error_description')
  const next = safeAuthNextPath(
    searchParams.get('next') || readAuthNextCookie(request.cookies.get(AUTH_NEXT_COOKIE)?.value)
  )

  if (oauthError) {
    return loginErrorRedirect(
      origin,
      'oauth',
      oauthDescription || oauthError || 'Google sign-in was cancelled'
    )
  }

  if (!code && !(tokenHash && type)) {
    return loginErrorRedirect(origin, 'auth_callback_failed')
  }

  // Bind session cookies to this redirect. cookies().set() + a later
  // NextResponse.redirect() can drop the Set-Cookie headers in App Router.
  const redirectResponse = NextResponse.redirect(`${origin}${next}`)
  redirectResponse.cookies.set(AUTH_NEXT_COOKIE, '', { path: '/', maxAge: 0 })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            redirectResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const exchanged = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ type: type!, token_hash: tokenHash! })

  if (exchanged.error || !exchanged.data.session) {
    console.error('Auth callback failed:', exchanged.error?.message)
    return loginErrorRedirect(
      origin,
      'auth_callback_failed',
      exchanged.error?.message || 'Authentication failed. Please try again.'
    )
  }

  const user = exchanged.data.user
  if (user) {
    await ensureProfile({
      id: user.id,
      fullName: fullNameFromAuthUser(user),
      avatarUrl: avatarUrlFromAuthUser(user),
      email: user.email,
    })
  }

  return redirectResponse
}
