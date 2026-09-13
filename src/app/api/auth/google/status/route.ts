import { NextResponse } from 'next/server'

const PROVIDER_DISABLED =
  'Google sign-in is not enabled yet. In Supabase → Authentication → Providers, turn on Google and add your Client ID / Secret.'

/** Probe GoTrue without starting a PKCE flow so the login page can stay in-app. */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ enabled: false, error: PROVIDER_DISABLED }, { status: 503 })
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/authorize?provider=google`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      redirect: 'manual',
      cache: 'no-store',
    })

    if (res.status === 400 || res.status === 404 || res.status === 422) {
      let message = PROVIDER_DISABLED
      try {
        const body = (await res.json()) as { msg?: string; error_description?: string }
        const raw = (body.msg || body.error_description || '').toLowerCase()
        if (raw && !raw.includes('provider is not enabled') && !raw.includes('unsupported provider')) {
          message = body.msg || body.error_description || PROVIDER_DISABLED
        }
      } catch {
        // keep default
      }
      return NextResponse.json({ enabled: false, error: message }, { status: 409 })
    }

    // 302/303 = Google is enabled and GoTrue is ready to start OAuth.
    if (res.status >= 300 && res.status < 400) {
      return NextResponse.json({ enabled: true })
    }

    if (res.ok) {
      return NextResponse.json({ enabled: true })
    }

    return NextResponse.json({ enabled: false, error: PROVIDER_DISABLED }, { status: 409 })
  } catch {
    return NextResponse.json(
      { enabled: false, error: 'Could not reach authentication. Check your connection and try again.' },
      { status: 503 }
    )
  }
}
