'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { hasVerifiedGoogleAuth } from '@/lib/auth/google'
import {
  checkoutUrl,
  LANDING_PLANS_PATH,
  pricingPlans,
  WEBSITE_URL,
  type PricingPlan,
} from '@/lib/subscriptions/plans'
import { useAuthStore } from '@/stores/authStore'
import { useSubscription } from '@/hooks/useSubscription'
import { createClient } from '@/utils/supabase/client'

function PlanCheckoutButton({
  plan,
  current,
}: {
  plan: PricingPlan
  current: boolean
}) {
  const user = useAuthStore((s) => s.user)

  if (user) {
    return (
      <a
        href={checkoutUrl({
          planId: plan.id,
          email: user.email,
          userId: user.id,
        })}
        className="mt-5 flex h-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground active:scale-[0.99]"
      >
        {current ? 'Renew on website' : 'Checkout on website'}
      </a>
    )
  }

  return (
    <Link
      href="/login"
      className="mt-5 flex h-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground active:scale-[0.99]"
    >
      Sign in to checkout
    </Link>
  )
}

export function LandingPlans() {
  const user = useAuthStore((s) => s.user)
  const google = hasVerifiedGoogleAuth(user)
  const { subscription, active, planId } = useSubscription()
  const [upgrade, setUpgrade] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setUpgrade(params.get('upgrade'))
    if (params.get('plans') === '1' || window.location.hash === '#plans') {
      const timer = window.setTimeout(() => {
        document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 120)
      return () => window.clearTimeout(timer)
    }
  }, [])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = LANDING_PLANS_PATH
  }

  return (
    <section
      id="plans"
      className="relative z-10 mx-auto w-full max-w-lg scroll-mt-20 px-2 pb-10 pt-8 md:max-w-xl md:px-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-primary">
            {upgrade === 'performance' ? 'Upgrade required' : 'Plans'}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">Choose your Hybrid Pro plan</h2>
        </div>
        {user ? (
          <button
            type="button"
            onClick={() => void signOut()}
            className="shrink-0 pt-1 text-xs font-semibold text-muted-foreground"
          >
            Sign out
          </button>
        ) : null}
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        {active
          ? `${subscription?.planName} is active until ${
              subscription?.expiresAt
                ? new Date(subscription.expiresAt).toLocaleDateString()
                : 'the end of this period'
            }. Renew or upgrade on hybridpro.in.`
          : user
            ? 'You are signed in. Pick a plan to checkout on hybridpro.in.'
            : 'Sign in with Google or email, then checkout. Payment is completed on hybridpro.in with the same account.'}
      </p>
      {user?.email ? (
        <p className="mt-2 text-xs font-medium text-foreground/80">
          {google ? `Google account · ${user.email}` : `Signed in as ${user.email}`}
        </p>
      ) : null}

      <div className="mt-6 space-y-4">
        {pricingPlans.map((plan) => {
          const current = planId === plan.id
          const featured = plan.id === 'performance' || upgrade === 'performance'
          return (
            <article
              key={plan.id}
              className={`rounded-[24px] border p-5 ${
                featured ? 'border-primary/50 bg-card' : 'border-border bg-card'
              }`}
            >
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-primary">
                {plan.company} · {plan.category}
              </p>
              <div className="mt-1 flex items-start justify-between gap-3">
                <h3 className="text-lg font-bold">{plan.name}</h3>
                {plan.saveLabel ? (
                  <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground">
                    {plan.saveLabel}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-3xl font-bold text-primary">
                {plan.price}
                <span className="ml-1 text-sm font-medium text-muted-foreground">{plan.cadence}</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{plan.blurb}</p>
              <ul className="mt-4 space-y-2">
                {plan.included.slice(0, 5).map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <PlanCheckoutButton plan={plan} current={current} />
            </article>
          )
        })}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Secure checkout on{' '}
        <a href={WEBSITE_URL} className="font-semibold text-primary">
          hybridpro.in
        </a>
        . Checkout opens after you sign in with Google or email.
      </p>
    </section>
  )
}
