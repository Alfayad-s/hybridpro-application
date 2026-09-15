/** True when the session is a Google OAuth identity (not email/password only). */
export function hasVerifiedGoogleAuth(user: {
  app_metadata?: { provider?: string; providers?: string[] } | null
  identities?: Array<{ provider?: string }> | null
} | null | undefined): boolean {
  if (!user) return false
  if ((user.identities ?? []).some((identity) => identity.provider === 'google')) return true
  const meta = user.app_metadata
  if (meta?.provider === 'google') return true
  return Array.isArray(meta?.providers) && meta.providers.includes('google')
}
