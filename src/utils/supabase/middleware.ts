import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

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
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && (pathname === '/login' || pathname === '/' || pathname === '/forgot-password')) {
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
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
      url.pathname = '/subscribe'
      url.search = ''
      return NextResponse.redirect(url)
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
        return NextResponse.redirect(url)
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
    ? query.or(`user_id.eq.${userId},email.eq.${email.toLowerCase()}`)
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
