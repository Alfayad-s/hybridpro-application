import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const JUST_PAID_COOKIE = 'hp_just_paid'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()
  const pathname = url.pathname
  const justPaid =
    request.nextUrl.searchParams.get('welcome') === '1' ||
    request.cookies.get(JUST_PAID_COOKIE)?.value === '1'

  const redirectTo = (path: string, keepWelcome = justPaid) => {
    url.pathname = path
    const email = url.searchParams.get('email')
    url.search = ''
    if (keepWelcome) {
      url.searchParams.set('welcome', '1')
      if (email) url.searchParams.set('email', email)
    }
    const response = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie)
    })
    if (keepWelcome) {
      response.cookies.set(JUST_PAID_COOKIE, '1', {
        path: '/',
        maxAge: 10 * 60,
        sameSite: 'lax',
      })
    }
    return response
  }

  if (justPaid) {
    supabaseResponse.cookies.set(JUST_PAID_COOKIE, '1', {
      path: '/',
      maxAge: 10 * 60,
      sameSite: 'lax',
    })
  }

  // Leave the PKCE verifier / session cookies alone during the OAuth exchange.
  if (pathname.startsWith('/auth/callback')) {
    return NextResponse.next({ request })
  }

  const isPublicRoute =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/subscribe' ||
    pathname === '/forgot-password' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/api/subscriptions/plans' ||
    pathname === '/api/subscriptions/activate' ||
    pathname === '/api/subscriptions/status' ||
    pathname.startsWith('/opengraph-image') ||
    pathname.startsWith('/twitter-image') ||
    pathname === '/icon' ||
    pathname.startsWith('/apple-icon')

  const isAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')

  if (!user && !isPublicRoute && !isAsset) {
    return redirectTo('/login')
  }

  if (user && (pathname === '/login' || pathname === '/' || pathname === '/forgot-password')) {
    return redirectTo('/dashboard')
  }

  // After a successful website payment, never dump the user on /subscribe.
  if (justPaid && pathname === '/subscribe') {
    return user ? redirectTo('/dashboard') : redirectTo('/login')
  }

  if (user && justPaid && !isAsset) {
    return supabaseResponse
  }

  if (user && !isAsset) {
    const access = await readSubscriptionAccess(supabase, user.id, user.email)
    if (!access.tableReady) {
      return supabaseResponse
    }

    const unpaidAllowed =
      pathname === '/subscribe' ||
      pathname === '/settings' ||
      pathname === '/api/profile/ensure' ||
      pathname === '/api/subscriptions/me' ||
      pathname === '/api/subscriptions/attach'

    if (!access.active && !unpaidAllowed && !isPublicRoute) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Subscription required' }, { status: 402 })
      }
      return redirectTo('/subscribe', false)
    }

    if (access.active) {
      const needsPerformance =
        pathname.startsWith('/ai') ||
        pathname.startsWith('/meal-plans') ||
        pathname.startsWith('/body-composition')
      const planRank = access.planId === 'elite' ? 3 : access.planId === 'performance' ? 2 : 1
      if (needsPerformance && planRank < 2) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Upgrade required' }, { status: 403 })
        }
        url.pathname = '/subscribe'
        url.search = 'upgrade=performance'
        const response = NextResponse.redirect(url)
        supabaseResponse.cookies.getAll().forEach((cookie) => {
          response.cookies.set(cookie)
        })
        return response
      }
    }
  }

  return supabaseResponse
}

type SubscriptionRow = {
  plan_id: string | null
  status: string | null
  expires_at: string | null
  user_id: string | null
  email: string | null
  updated_at: string | null
}

async function readSubscriptionAccess(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  email?: string | null
) {
  let query = supabase
    .from('subscriptions')
    .select('plan_id,status,expires_at,user_id,email,updated_at')
    .order('updated_at', { ascending: false })
    .limit(5)

  query = email
    ? query.or(`user_id.eq.${userId},email.eq."${email.toLowerCase()}"`)
    : query.eq('user_id', userId)

  const { data, error } = await query
  if (error) {
    return { tableReady: false, active: false, planId: null as string | null }
  }

  const now = Date.now()
  const rows = (data ?? []) as SubscriptionRow[]
  const active = rows.find((row) => {
    if (row.status !== 'active') return false
    if (!row.expires_at) return true
    return new Date(row.expires_at).getTime() > now
  })

  return {
    tableReady: true,
    active: Boolean(active),
    planId: active?.plan_id ?? null,
  }
}
