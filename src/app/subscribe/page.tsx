'use client'

import { Check } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { checkoutUrl, pricingPlans } from '@/lib/subscriptions/plans'
import { useSubscription } from '@/hooks/useSubscription'

export default function SubscribePage() {
  const user = useAuthStore((s) => s.user)
  const { subscription, active, planId } = useSubscription()

  return (
    <div className="p-6 space-y-6 pb-10">
      <div>
        <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-primary">
          Hybrid Pro
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Choose your plan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {active
            ? `${subscription?.planName} is active until ${
                subscription?.expiresAt
                  ? new Date(subscription.expiresAt).toLocaleDateString()
                  : 'the end of this period'
              }. Renew or upgrade anytime.`
            : 'An active Hybrid Pro plan unlocks tracking in the app. Pay on the website, then sign in with the same email.'}
        </p>
      </div>

      <div className="space-y-4">
        {pricingPlans.map((plan) => {
          const current = planId === plan.id
          return (
            <article
              key={plan.id}
              className={`rounded-[24px] border p-5 ${
                plan.id === 'performance'
                  ? 'border-primary/50 bg-card'
                  : 'border-border bg-card'
              }`}
            >
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-primary">
                {plan.company} · {plan.category}
              </p>
              <div className="mt-1 flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold">{plan.name}</h2>
                {plan.saveLabel && (
                  <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground">
                    {plan.saveLabel}
                  </span>
                )}
              </div>
              <p className="mt-3 text-3xl font-bold text-primary">
                {plan.price}
                <span className="ml-1 text-sm font-medium text-muted-foreground">
                  {plan.cadence}
                </span>
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
              <a
                href={checkoutUrl({
                  planId: plan.id,
                  email: user?.email,
                  userId: user?.id,
                })}
                className="mt-5 flex h-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground active:scale-[0.99]"
              >
                {current ? `Renew ${plan.shortName}` : `Get ${plan.name}`}
              </a>
            </article>
          )
        })}
      </div>
    </div>
  )
}
