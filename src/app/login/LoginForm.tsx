'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Mail, Lock, Loader2, User, KeyRound, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { Button } from '@/components/ui/button'
import { createClient } from '@/utils/supabase/client'
import { ensureProfileClient } from '@/lib/auth/ensure-profile-client'
import { appAuthCallbackUrl, setClientAuthNextPath } from '@/lib/auth/oauth-redirect'
import { useActionLoading } from '@/components/feedback/ActionLoading'

const authSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
})

const otpSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  otp: z
    .string()
    .min(6, { message: 'Enter the 6-digit code' })
    .max(8, { message: 'Code is too long' })
    .regex(/^\d+$/, { message: 'Code must be numbers only' }),
})

type AuthSchemaType = z.infer<typeof authSchema>
type OtpSchemaType = z.infer<typeof otpSchema>

type AuthMode = 'signin' | 'signup' | 'verify-otp'

function isEmailNotConfirmed(message: string) {
  const lower = message.toLowerCase()
  return lower.includes('email not confirmed') || lower.includes('not verified')
}

export default function LoginForm() {
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [pendingFullName, setPendingFullName] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showActionLoading, hideActionLoading } = useActionLoading()

  const isSignUp = authMode === 'signup'
  const isVerifyOtp = authMode === 'verify-otp'

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    getValues,
    setValue,
  } = useForm<AuthSchemaType>({
    resolver: zodResolver(authSchema),
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
    defaultValues: { email: '', otp: '' },
  })

  const otpEmail = watchOtp('email')

  useEffect(() => {
    const authError = searchParams.get('error')
    const message = searchParams.get('message')
    if (authError === 'auth_callback_failed') {
      setError(message ? decodeURIComponent(message) : 'Authentication failed. Please try again.')
      return
    }
    if (authError === 'oauth') {
      setError(
        message
          ? decodeURIComponent(message)
          : 'Google sign-in failed. Enable Google in Supabase Auth providers and try again.'
      )
    }
  }, [searchParams])

  const openOtpVerification = (email: string, fullName?: string) => {
    setPendingFullName(fullName ?? null)
    setAuthMode('verify-otp')
    setError(null)
    setInfo(`We sent a 6-digit code to ${email}. Enter it below to verify your email.`)
    resetOtp({ email, otp: '' })
  }

  const onSubmit = async (data: AuthSchemaType) => {
    setIsLoading(true)
    setError(null)
    setInfo(null)
    showActionLoading(isSignUp ? 'Creating your account…' : 'Signing you in…')

    const supabase = createClient()

    try {
      if (isSignUp) {
        const fullName = data.fullName?.trim() || data.email.split('@')[0]
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: appAuthCallbackUrl(),
          },
        })

        if (signUpError) {
          hideActionLoading()
          setError(signUpError.message)
          return
        }

        if (signUpData.user && signUpData.session) {
          await ensureProfileClient({ fullName })
        }

        if (!signUpData.session) {
          hideActionLoading()
          openOtpVerification(data.email, fullName)
          return
        }

        router.push('/dashboard')
        router.refresh()
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        })

        if (signInError) {
          hideActionLoading()
          if (isEmailNotConfirmed(signInError.message)) {
            openOtpVerification(data.email)
            return
          }
          setError(signInError.message)
          return
        }

        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      hideActionLoading()
      setError('Something went wrong. Please try again.')
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
            fullName:
              pendingFullName ||
              signupVerify.user.user_metadata?.full_name ||
              data.email.split('@')[0],
          })
        }

        router.push('/dashboard')
        router.refresh()
        return
      }

      if (verifyData.user) {
        await ensureProfileClient({
          fullName:
            pendingFullName ||
            verifyData.user.user_metadata?.full_name ||
            data.email.split('@')[0],
        })
      }

      router.push('/dashboard')
      router.refresh()
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

    const supabase = createClient()

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: appAuthCallbackUrl(),
        },
      })

      if (resendError) {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false,
          },
        })

        if (otpError) {
          setError(otpError.message)
          return
        }
      }

      setInfo(`A new code was sent to ${email}.`)
    } catch {
      setError('Could not resend code. Try again in a moment.')
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
      const statusRes = await fetch('/api/auth/google/status', { cache: 'no-store' })
      const status = (await statusRes.json().catch(() => null)) as
        | { enabled?: boolean; error?: string }
        | null
      if (!statusRes.ok || !status?.enabled) {
        hideActionLoading()
        setError(
          status?.error ||
            'Google sign-in is not enabled yet. In Supabase → Authentication → Providers, turn on Google and add your Client ID / Secret.'
        )
        setIsGoogleLoading(false)
        return
      }

      setClientAuthNextPath('/dashboard')
      const supabase = createClient()
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: appAuthCallbackUrl(),
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
          skipBrowserRedirect: true,
        },
      })

      if (oauthError) {
        hideActionLoading()
        const msg = oauthError.message.toLowerCase()
        if (msg.includes('provider is not enabled') || msg.includes('unsupported provider')) {
          setError(
            'Google sign-in is not enabled yet. In Supabase → Authentication → Providers, turn on Google and add your Client ID / Secret.'
          )
        } else {
          setError(oauthError.message)
        }
        setIsGoogleLoading(false)
        return
      }

      if (!data.url) {
        hideActionLoading()
        setError('Could not start Google sign-in. Check your Supabase Google provider settings.')
        setIsGoogleLoading(false)
        return
      }

      window.location.assign(data.url)
    } catch {
      hideActionLoading()
      setError('Could not start Google sign-in. Please try again.')
      setIsGoogleLoading(false)
    }
  }

  const backToSignIn = () => {
    const email = otpEmail || getValues('email')
    setAuthMode('signin')
    setError(null)
    setInfo(null)
    setPendingFullName(null)
    reset({ email: email || '', password: '', fullName: '' })
    resetOtp({ email: '', otp: '' })
  }

  const toggleSignUpMode = () => {
    setAuthMode((prev) => (prev === 'signup' ? 'signin' : 'signup'))
    setError(null)
    setInfo(null)
    reset()
  }

  if (isVerifyOtp) {
    return (
      <div className="flex flex-col min-h-screen px-6 py-12 justify-center bg-background">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-primary/15 rounded-[24px] flex items-center justify-center mb-4 border border-primary/20">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Verify your email</h2>
          <p className="text-sm text-muted-foreground mt-1 text-center max-w-[280px]">
            Enter the 6-digit code we sent to your inbox
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
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify Email'}
          </Button>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={backToSignIn}
              className="text-xs text-muted-foreground font-semibold flex items-center gap-1 cursor-pointer hover:text-foreground"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to sign in
            </button>
            <button
              type="button"
              onClick={handleResendOtp}
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
    <div className="flex flex-col min-h-screen px-6 py-12 justify-center bg-background">
      <div className="flex flex-col items-center mb-10">
        <div className="w-16 h-16 rounded-[24px] overflow-hidden mb-4 border border-border">
          <BrandLogo size={64} className="rounded-[24px]" priority />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {isSignUp ? 'Create an account' : 'Welcome back'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1 text-center">
          {isSignUp ? 'Sign up to start tracking your lifts' : 'Sign in to access your workout metrics'}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

        {isSignUp && (
          <div>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Full name"
                autoComplete="name"
                {...register('fullName')}
                className="w-full h-[52px] bg-muted border border-border rounded-[24px] pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors text-sm"
              />
            </div>
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
          {errors.email && <p className="text-xs text-destructive mt-1.5 ml-4">{errors.email.message}</p>}
        </div>

        <div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              {...register('password')}
              className="w-full h-[52px] bg-muted border border-border rounded-[24px] pl-12 pr-12 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive mt-1.5 ml-4">{errors.password.message}</p>
          )}
        </div>

        {!isSignUp && (
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const email = getValues('email')
                if (!email) {
                  setError('Enter your email first, then verify with OTP.')
                  return
                }
                openOtpVerification(email)
              }}
              className="text-xs text-muted-foreground font-semibold hover:text-primary cursor-pointer"
            >
              Verify with OTP
            </button>
            <Link
              href="/forgot-password"
              className="text-xs text-primary font-semibold hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        )}

        <Button
          type="submit"
          disabled={isLoading || isGoogleLoading}
          className="w-full h-[52px] bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-[24px] flex items-center justify-center gap-2 border-0 shadow-lg shadow-primary/10 transition-transform"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isSignUp ? (
            'Sign Up'
          ) : (
            'Sign In'
          )}
        </Button>
      </form>

      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-4 text-muted-foreground">Or continue with</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading || isGoogleLoading}
        className="w-full h-[52px] bg-muted border border-border hover:bg-card text-foreground font-semibold rounded-[24px] flex items-center justify-center gap-3 transition-transform cursor-pointer disabled:opacity-50"
      >
        {isGoogleLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
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
            Continue with Google
          </>
        )}
      </button>

      <p className="text-center text-[11px] text-muted-foreground mt-3 px-4">
        Continuing with Google creates or signs into your Hybrid Pro account.
      </p>

      <p className="text-center text-sm text-muted-foreground mt-8">
        {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button
          type="button"
          onClick={toggleSignUpMode}
          className="text-primary font-bold hover:underline cursor-pointer"
        >
          {isSignUp ? 'Sign In' : 'Sign Up'}
        </button>
      </p>
    </div>
  )
}
