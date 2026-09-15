import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { continueCheckoutPath, isPricingPlanId } from '@/lib/subscriptions/plans'

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
    const email = url.searchParams.get('email')
    const parsed = new URL(path, url.origin)
    url.pathname = parsed.pathname
    url.search = parsed.search
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
    pathname === '/api/subscriptions/me' ||
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

  const unpaidAllowed =
    pathname === '/' ||
    pathname === '/subscribe' ||
    pathname === '/login' ||
    pathname === '/forgot-password' ||
    pathname === '/api/profile/ensure' ||
    pathname === '/api/subscriptions/me' ||
    pathname === '/api/subscriptions/attach'

  const landingPlansPath =
    request.nextUrl.searchParams.get('upgrade') === 'performance'
      ? '/?plans=1&upgrade=performance'
      : '/?plans=1'

  // Paid members skip the marketing landing. Everyone else stays on home + plans.
  if (pathname === '/') {
    if (justPaid) {
      return user ? redirectTo('/dashboard') : redirectTo('/login')
    }
    if (user) {
      const access = await readSubscriptionAccess(supabase, user.id, user.email)
      const wantsPlans =
        request.nextUrl.searchParams.get('plans') === '1' ||
        request.nextUrl.searchParams.get('upgrade') === 'performance'
      if (access.active && !wantsPlans) return redirectTo('/dashboard')
    }
    return supabaseResponse
  }

  if (pathname === '/subscribe') {
    if (justPaid) {
      return user ? redirectTo('/dashboard') : redirectTo('/login')
    }
    return redirectTo(landingPlansPath, false)
  }

  if (!user && !isPublicRoute && !isAsset) {
    return redirectTo('/?plans=1', false)
  }

  if (user && (pathname === '/login' || pathname === '/forgot-password') && !justPaid) {
    const checkoutPlan = url.searchParams.get('checkout')
    const reauth = url.searchParams.get('reauth') === '1'
    if (pathname === '/login' && reauth) {
      return supabaseResponse
    }
    if (pathname === '/login' && checkoutPlan && isPricingPlanId(checkoutPlan)) {
      return redirectTo(continueCheckoutPath(checkoutPlan), false)
    }
    const access = await readSubscriptionAccess(supabase, user.id, user.email)
    if (access.active) return redirectTo('/dashboard')
    return redirectTo('/?plans=1', false)
  }

  if (user && justPaid && !isAsset) {
    return supabaseResponse
  }

  if (user && !isAsset) {
    const access = await readSubscriptionAccess(supabase, user.id, user.email)

    if (!access.active && !unpaidAllowed && !isPublicRoute) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Subscription required' }, { status: 402 })
      }
      return redirectTo('/?plans=1', false)
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
        return redirectTo('/?plans=1&upgrade=performance', false)
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
  const fromBackend = await readSubscriptionAccessFromBackend(userId, email)
  if (fromBackend) return fromBackend
  return readSubscriptionAccessFromSupabase(supabase, userId, email)
}

async function readSubscriptionAccessFromBackend(userId: string, email?: string | null) {
  const base = process.env.HYBRID_BACKEND_URL?.trim().replace(/\/$/, '')
  const secret = process.env.INTERNAL_API_SECRET?.trim()
  if (!base || !secret) return null

  try {
    const params = new URLSearchParams()
    params.set('userId', userId)
    if (email) params.set('email', email)
    const res = await fetch(`${base}/api/subscriptions/status?${params}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      subscription?: { status?: string; planId?: string | null; expiresAt?: string | null }
    }
    const sub = data.subscription
    const active =
      sub?.status === 'active' &&
      (!sub.expiresAt || new Date(sub.expiresAt).getTime() > Date.now())
    return {
      tableReady: true,
      active,
      planId: active ? sub?.planId ?? null : null,
    }
  } catch {
    return null
  }
}

async function readSubscriptionAccessFromSupabase(
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
