'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BrandLogo } from '@/components/brand/BrandLogo'

function PaymentWelcomeInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (params.get('welcome') === '1') setOpen(true)
  }, [params])

  if (!open) return null

  const dismiss = () => {
    setOpen(false)
    router.replace('/dashboard')
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 px-4 pb-8 pt-16 sm:items-center">
      <div className="w-full max-w-sm rounded-[28px] border border-border bg-card p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 w-16 overflow-hidden rounded-[22px] border border-border">
          <BrandLogo size={64} className="rounded-[22px]" priority />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
          Payment successful
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          Welcome to Hybrid Pro
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your plan is active. Workouts, meals, and coaching are ready in the app.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground active:scale-[0.99]"
        >
          Start training
        </button>
      </div>
    </div>
  )
}

export function PaymentWelcome() {
  return (
    <Suspense fallback={null}>
      <PaymentWelcomeInner />
    </Suspense>
  )
}
