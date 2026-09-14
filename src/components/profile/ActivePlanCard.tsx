'use client'

import { useRouter } from 'next/navigation'
import { CreditCard } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { checkoutUrl } from '@/lib/subscriptions/plans'
import { daysLeft, useSubscription } from '@/hooks/useSubscription'

export function ActivePlanCard() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const { subscription, active, loading } = useSubscription()
  const remaining = daysLeft(subscription?.expiresAt)

  return (
    <div className="rounded-[24px] border border-border bg-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Hybrid Pro plan
          </p>
          {loading ? (
            <p className="mt-1 text-xs text-muted-foreground">Checking your access…</p>
          ) : active && subscription ? (
            <>
              <h3 className="mt-1 text-lg font-bold tracking-tight text-foreground">
                {subscription.planName}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Active
                {subscription.expiresAt
                  ? ` · expires ${new Date(subscription.expiresAt).toLocaleDateString()}`
                  : ''}
                {remaining != null ? ` · ${remaining} day${remaining === 1 ? '' : 's'} left` : ''}
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              No active plan. Subscribe on the website, then sign in with the same email.
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
            active
              ? 'bg-primary/15 text-primary'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {loading ? '…' : active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => router.push('/subscribe')}
          className="h-10 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground active:scale-95"
        >
          {active ? 'Change plan' : 'View plans'}
        </button>
        {active && subscription && (
          <a
            href={checkoutUrl({
              planId: subscription.planId,
              email: user?.email,
              userId: user?.id,
            })}
            className="flex h-10 items-center rounded-full border border-border px-4 text-xs font-bold"
          >
            Renew
          </a>
        )}
      </div>
    </div>
  )
}
