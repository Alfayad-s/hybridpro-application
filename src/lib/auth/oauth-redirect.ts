import { PRODUCTION_SITE_URL } from '@/lib/brand'
import { safeAuthNextPath } from '@/lib/auth/user-display'

export const AUTH_NEXT_COOKIE = 'hp-auth-next'

/** Persist the post-auth path so redirect URLs stay allowlist-friendly (`/auth/callback` only). */
export function setClientAuthNextPath(next: string) {
  const safe = safeAuthNextPath(next)
  document.cookie = `${AUTH_NEXT_COOKIE}=${encodeURIComponent(safe)}; Path=/; Max-Age=600; SameSite=Lax`
}

export function readAuthNextCookie(value: string | undefined | null) {
  if (!value) return null
  try {
    return safeAuthNextPath(decodeURIComponent(value))
  } catch {
    return safeAuthNextPath(value)
  }
}

/** Public origin for OAuth redirects (handles proxies / Vercel). */
export function publicAuthOrigin(request: Request) {
  const { origin } = new URL(request.url)
  if (process.env.NODE_ENV === 'development') return origin

  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost.split(',')[0].trim()}`
  }

  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    PRODUCTION_SITE_URL ||
    origin
  )
}

export function appAuthCallbackUrl() {
  return `${window.location.origin}/auth/callback`
}
