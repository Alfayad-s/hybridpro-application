'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { Button } from '@/components/ui/button'
import { createClient } from '@/utils/supabase/client'

const schema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
})

type FormValues = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async ({ email }: FormValues) => {
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    })

    setIsLoading(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    setSent(true)
  }

  return (
    <div className="flex flex-col min-h-screen px-6 py-12 justify-center bg-background">
      <div className="flex flex-col items-center mb-10">
        <div className="w-16 h-16 rounded-[24px] overflow-hidden mb-4 border border-border">
          <BrandLogo size={64} className="rounded-[24px]" priority />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Reset password</h2>
        <p className="text-sm text-muted-foreground mt-1 text-center">
          Enter your email and we&apos;ll send a reset link
        </p>
      </div>

      {sent ? (
        <div className="space-y-6 text-center">
          <div className="flex flex-col items-center gap-3 p-5 rounded-[24px] bg-primary/10 border border-primary/20">
            <CheckCircle2 className="w-8 h-8 text-primary" />
            <p className="text-sm text-foreground font-medium">Check your email</p>
            <p className="text-xs text-muted-foreground">
              If an account exists for that address, a reset link is on the way.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-primary font-bold hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-[16px] bg-destructive/10 border border-destructive/20 px-4 py-3">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          <div>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="email"
                placeholder="Email address"
                autoComplete="email"
                {...register('email')}
                className="w-full h-[52px] bg-muted border border-border rounded-[24px] pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors text-sm"
              />
            </div>
            {errors.email && (
              <p className="text-xs text-destructive mt-1.5 ml-4">{errors.email.message}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-[52px] bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-[24px] flex items-center justify-center gap-2 border-0 shadow-lg shadow-primary/10 active:scale-[0.98] transition-all"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send reset link'}
          </Button>

          <Link
            href="/login"
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mt-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>
        </form>
      )}
    </div>
  )
}
