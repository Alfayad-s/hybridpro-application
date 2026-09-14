import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { profiles } from '@/db/schema'
import { backendAttachSubscription } from '@/lib/subscriptions/backend'

export type EnsureProfileInput = {
  id: string
  fullName?: string | null
  avatarUrl?: string | null
  email?: string | null
}

/** Server-only — import from API routes / route handlers, not client components. */
export async function ensureProfile({ id, fullName, avatarUrl, email }: EnsureProfileInput) {
  try {
    const existing = await db.query.profiles.findFirst({
      where: eq(profiles.id, id),
    })

    if (existing) {
      if (fullName || avatarUrl) {
        await db
          .update(profiles)
          .set({
            ...(fullName ? { fullName } : {}),
            ...(avatarUrl ? { avatarUrl } : {}),
          })
          .where(eq(profiles.id, id))
      }
      if (email) {
        try {
          await backendAttachSubscription({ userId: id, email })
        } catch (error) {
          console.error('Failed to attach subscription:', error)
        }
      }
      return { ok: true as const }
    }

    await db.insert(profiles).values({
      id,
      fullName: fullName ?? null,
      avatarUrl: avatarUrl ?? null,
      experienceLevel: 'beginner',
    })

    if (email) {
      try {
        await backendAttachSubscription({ userId: id, email })
      } catch (error) {
        console.error('Failed to attach subscription:', error)
      }
    }

    return { ok: true as const }
  } catch (error) {
    // Profile table may not exist yet during early setup — don't block auth
    console.error('Failed to ensure profile:', error)
    return { ok: false as const }
  }
}
