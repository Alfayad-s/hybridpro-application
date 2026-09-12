'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Lock, Loader2 } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { Button } from '@/components/ui/button'
import { createClient } from '@/utils/supabase/client'

const schema = z
  .object({
    password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
    confirmPassword: z.string().min(6, { message: 'Confirm your password' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof schema>

export default function UpdatePasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async ({ password }: FormValues) => {
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    setIsLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="flex flex-col min-h-screen px-6 py-12 justify-center bg-background">
      <div className="flex flex-col items-center mb-10">
        <div className="w-16 h-16 rounded-[24px] overflow-hidden mb-4 border border-border">
          <BrandLogo size={64} className="rounded-[24px]" priority />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Set new password</h2>
        <p className="text-sm text-muted-foreground mt-1 text-center">Choose a strong password for your account</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="rounded-[16px] bg-destructive/10 border border-destructive/20 px-4 py-3">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        <div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="password"
              placeholder="New password"
              autoComplete="new-password"
              {...register('password')}
              className="w-full h-[52px] bg-muted border border-border rounded-[24px] pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors text-sm"
            />
          </div>
          {errors.password && (
            <p className="text-xs text-destructive mt-1.5 ml-4">{errors.password.message}</p>
          )}
        </div>

        <div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="password"
              placeholder="Confirm password"
              autoComplete="new-password"
              {...register('confirmPassword')}
              className="w-full h-[52px] bg-muted border border-border rounded-[24px] pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors text-sm"
            />
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-destructive mt-1.5 ml-4">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-[52px] bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-[24px] flex items-center justify-center gap-2 border-0 shadow-lg shadow-primary/10 active:scale-[0.98] transition-all"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update password'}
        </Button>
      </form>
    </div>
  )
}
