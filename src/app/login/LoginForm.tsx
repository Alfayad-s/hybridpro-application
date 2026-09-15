'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Mail, Loader2, KeyRound, ArrowLeft } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { Button } from '@/components/ui/button'
import { createClient } from '@/utils/supabase/client'
import { ensureProfileClient } from '@/lib/auth/ensure-profile-client'
import { startGoogleSignIn } from '@/lib/auth/start-google'
import { appAuthCallbackUrl } from '@/lib/auth/oauth-redirect'
import {
  continueCheckoutPath,
  isPricingPlanId,
  LANDING_PLANS_PATH,
} from '@/lib/subscriptions/plans'
import { useActionLoading } from '@/components/feedback/ActionLoading'

const emailSchema = z.object({
  email: z.string().email({ message: 'Enter a valid email address' }),
})

const otpSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  otp: z
    .string()
    .min(6, { message: 'Enter the 6-digit code' })
    .max(8, { message: 'Code is too long' })
    .regex(/^\d+$/, { message: 'Code must be numbers only' }),
})

type EmailSchemaType = z.infer<typeof emailSchema>
type OtpSchemaType = z.infer<typeof otpSchema>

type LoginFormProps = {
  paidWelcome: boolean
  checkoutPlan: string | null
  reauth: boolean
  presetEmail: string | null
  authError: string | null
  authMessage: string | null
}

function decodeParam(value: string | null) {
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function initialAuthError(authError: string | null, authMessage: string | null) {
  const message = decodeParam(authMessage)
  if (authError === 'auth_callback_failed') {
    return message || 'Authentication failed. Please try again.'
  }
  if (authError === 'oauth') {
    return (
      message ||
      'Google sign-in failed. Enable Google in Supabase Auth providers and try again.'
    )
  }
  return null
}

function GoogleMark() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  )
}

export default function LoginForm({
  paidWelcome,
  checkoutPlan,
  reauth: wantsReauth,
  presetEmail,
  authError,
  authMessage,
}: LoginFormProps) {
  const [isVerifyOtp, setIsVerifyOtp] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState<string | null>(() => initialAuthError(authError, authMessage))
  const [info, setInfo] = useState<string | null>(null)
  const router = useRouter()
  const { showActionLoading, hideActionLoading } = useActionLoading()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    getValues,
  } = useForm<EmailSchemaType>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: presetEmail || '' },
  })

  const {
    register: registerOtp,
    handleSubmit: handleSubmitOtp,
    formState: { errors: otpErrors },
    reset: resetOtp,
    setValue: setOtpValue,
    watch: watchOtp,
  } = useForm<OtpSchemaType>({
    resolver: zodResolver(otpSchema),
    defaultValues: { email: presetEmail || '', otp: '' },
  })

  const otpEmail = watchOtp('email')
  const checkoutPlanId = checkoutPlan && isPricingPlanId(checkoutPlan) ? checkoutPlan : null
  const afterAuthPath = paidWelcome
    ? '/dashboard?welcome=1'
    : checkoutPlanId
      ? continueCheckoutPath(checkoutPlanId)
      : LANDING_PLANS_PATH

  useEffect(() => {
    if (!wantsReauth) return
    const supabase = createClient()
    void supabase.auth.signOut()
  }, [wantsReauth])

  const goToApp = () => {
    router.push(afterAuthPath)
    router.refresh()
  }

  const sendOtp = async (email: string) => {
    const supabase = createClient()
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: appAuthCallbackUrl(),
      },
    })
    if (otpError) throw otpError
  }

  const onSendOtp = async (data: EmailSchemaType) => {
    setIsLoading(true)
    setError(null)
    setInfo(null)
    showActionLoading('Sending code…')

    try {
      await sendOtp(data.email)
      hideActionLoading()
      setIsVerifyOtp(true)
      setInfo(`We sent a 6-digit code to ${data.email}. Enter it below to continue.`)
      resetOtp({ email: data.email, otp: '' })
    } catch (err) {
      hideActionLoading()
      setError(err instanceof Error ? err.message : 'Could not send the code. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const onVerifyOtp = async (data: OtpSchemaType) => {
    setIsLoading(true)
    setError(null)
    setInfo(null)
    showActionLoading('Verifying…')

    const supabase = createClient()
    const token = data.otp.trim()
    const fallbackName = data.email.split('@')[0]

    try {
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email: data.email,
        token,
        type: 'email',
      })

      if (verifyError) {
        const { data: signupVerify, error: signupError } = await supabase.auth.verifyOtp({
          email: data.email,
          token,
          type: 'signup',
        })

        if (signupError) {
          hideActionLoading()
          setError(signupError.message || verifyError.message)
          return
        }

        if (signupVerify.user) {
          await ensureProfileClient({
            fullName: signupVerify.user.user_metadata?.full_name || fallbackName,
          })
        }

        goToApp()
        return
      }

      if (verifyData.user) {
        await ensureProfileClient({
          fullName: verifyData.user.user_metadata?.full_name || fallbackName,
        })
      }

      goToApp()
    } catch {
      hideActionLoading()
      setError('Invalid or expired code. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOtp = async () => {
    const email = otpEmail || getValues('email')
    if (!email) {
      setError('Enter your email first.')
      return
    }

    setIsResending(true)
    setError(null)

    try {
      await sendOtp(email)
      setInfo(`A new code was sent to ${email}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code. Try again in a moment.')
    } finally {
      setIsResending(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    setError(null)
    setInfo(null)
    showActionLoading('Connecting to Google…')

    try {
      await startGoogleSignIn(afterAuthPath)
    } catch (err) {
      hideActionLoading()
      const message = err instanceof Error ? err.message : 'Could not start Google sign-in. Please try again.'
      const msg = message.toLowerCase()
      if (msg.includes('provider is not enabled') || msg.includes('unsupported provider')) {
        setError(
          'Google sign-in is not enabled yet. In Supabase → Authentication → Providers, turn on Google and add your Client ID / Secret.'
        )
      } else {
        setError(message)
      }
      setIsGoogleLoading(false)
    }
  }

  const backToSignIn = () => {
    const email = otpEmail || getValues('email')
    setIsVerifyOtp(false)
    setError(null)
    setInfo(null)
    reset({ email: email || '' })
    resetOtp({ email: email || '', otp: '' })
  }

  if (isVerifyOtp) {
    return (
      <div className="iphone-auth-screen">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-primary/15 rounded-[24px] flex items-center justify-center mb-4 border border-primary/20">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Check your email</h2>
          <p className="text-sm text-muted-foreground mt-1 text-center max-w-[280px]">
            Enter the 6-digit code we sent
            {checkoutPlanId ? ' to continue to website checkout' : ' to continue to pricing'}
          </p>
        </div>

        <form onSubmit={handleSubmitOtp(onVerifyOtp)} className="space-y-4">
          {error && (
            <div className="rounded-[16px] bg-destructive/10 border border-destructive/20 px-4 py-3">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {info && (
            <div className="rounded-[16px] bg-primary/10 border border-primary/20 px-4 py-3">
              <p className="text-xs text-primary">{info}</p>
            </div>
          )}

          <input type="hidden" {...registerOtp('email')} />

          <div>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="email"
                value={otpEmail}
                readOnly
                className="w-full h-[52px] bg-muted border border-border rounded-[24px] pl-12 pr-4 text-muted-foreground text-sm cursor-default"
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                maxLength={8}
                {...registerOtp('otp', {
                  onChange: (e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 8)
                    setOtpValue('otp', digits, { shouldValidate: true })
                  },
                })}
                className="w-full h-[52px] bg-muted border border-border rounded-[24px] pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors text-sm tracking-[0.35em] font-mono text-center"
              />
            </div>
            {otpErrors.otp && (
              <p className="text-xs text-destructive mt-1.5 ml-4">{otpErrors.otp.message}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-[52px] bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-[24px] flex items-center justify-center gap-2 border-0 shadow-lg shadow-primary/10 transition-transform"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify and continue'}
          </Button>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={backToSignIn}
              className="text-xs text-muted-foreground font-semibold flex items-center gap-1 cursor-pointer hover:text-foreground"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <button
              type="button"
              onClick={() => void handleResendOtp()}
              disabled={isResending}
              className="text-xs text-primary font-bold cursor-pointer hover:underline disabled:opacity-50"
            >
              {isResending ? 'Sending…' : 'Resend code'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="iphone-auth-screen">
      <div className="flex flex-col items-center mb-10">
        <div className="w-16 h-16 rounded-[24px] overflow-hidden mb-4 border border-border">
          <BrandLogo size={64} className="rounded-[24px]" priority />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {paidWelcome
            ? 'Welcome to Hybrid Pro'
            : wantsReauth
              ? 'Use a different email'
              : checkoutPlanId
                ? 'Sign in to checkout'
                : 'Sign in'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1 text-center">
          {paidWelcome
            ? 'Payment confirmed. Sign in with Google or the same email to open the app.'
            : wantsReauth
              ? 'Sign in with the email you want on checkout. That address will be locked on the payment form.'
              : checkoutPlanId
                ? 'Continue with Google or email. You’ll return to website checkout with this address locked.'
                : 'Continue with Google or email to choose a plan'}
        </p>
      </div>

      {paidWelcome && (
        <div className="mb-4 rounded-[18px] border border-primary/30 bg-primary/10 px-4 py-3 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Payment successful
          </p>
          <p className="mt-1 text-sm text-foreground">
            Your plan is active. Sign in to start training.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-[16px] bg-destructive/10 border border-destructive/20 px-4 py-3">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {info && (
        <div className="mb-4 rounded-[16px] bg-primary/10 border border-primary/20 px-4 py-3">
          <p className="text-xs text-primary">{info}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleGoogleSignIn()}
        disabled={isLoading || isGoogleLoading}
        className="w-full h-[52px] bg-muted border border-border hover:bg-card text-foreground font-semibold rounded-[24px] flex items-center justify-center gap-3 transition-transform cursor-pointer disabled:opacity-50"
      >
        {isGoogleLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <GoogleMark />
            Continue with Google
          </>
        )}
      </button>

      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-4 text-muted-foreground">Or email</span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSendOtp)} className="space-y-4">
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
          {errors.email && <p className="text-xs text-destructive mt-1.5 ml-4">{errors.email.message}</p>}
        </div>

        <Button
          type="submit"
          disabled={isLoading || isGoogleLoading}
          className="w-full h-[52px] bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-[24px] flex items-center justify-center gap-2 border-0 shadow-lg shadow-primary/10 transition-transform"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send OTP'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-8">
        Need a plan first?{' '}
        <Link href={LANDING_PLANS_PATH} className="text-primary font-bold hover:underline">
          View pricing
        </Link>
      </p>
    </div>
  )
}
