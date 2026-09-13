'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  User,
  Settings,
  Award,
  Calendar,
  ChevronRight,
  LogOut,
  Loader2,
  ClipboardList,
  Library,
  Scale,
  Ruler,
  Camera,
  ScanLine,
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useProgressStore, computeBodyWeightStats } from '@/stores/progressStore'
import { useProfileStore } from '@/stores/profileStore'
import { Button } from '@/components/ui/button'
import { pushSyncBeforeLogout } from '@/components/sync/SyncProvider'
import { ArHeightMeasureButton } from '@/components/profile/ArHeightMeasure'

export default function ProfilePage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const bodyWeightLog = useProgressStore((s) => s.bodyWeightLog)
  const heightCm = useProfileStore((s) => s.heightCm)
  const setHeightCm = useProfileStore((s) => s.setHeightCm)
  const avatarUrl = useProfileStore((s) => s.avatarUrl)
  const setProfile = useProfileStore((s) => s.setProfile)
  const experienceLevel = useProfileStore((s) => s.experienceLevel)
  const weightUnit = useProfileStore((s) => s.weightUnit)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [showHeightForm, setShowHeightForm] = useState(false)
  const [heightInput, setHeightInput] = useState('')
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setHydrated(true)
  }, [])

  // Keep local profile avatar in sync with auth metadata (Google uses picture)
  useEffect(() => {
    const fromAuth =
      (user?.user_metadata?.avatar_url as string | undefined) ||
      (user?.user_metadata?.picture as string | undefined)
    if (fromAuth && fromAuth !== avatarUrl) {
      setProfile({ avatarUrl: fromAuth })
    }
  }, [user?.user_metadata?.avatar_url, user?.user_metadata?.picture, avatarUrl, setProfile])

  const weightStats = useMemo(
    () => (hydrated ? computeBodyWeightStats(bodyWeightLog, null) : null),
    [hydrated, bodyWeightLog]
  )

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Athlete'

  const levelLabel = experienceLevel
    ? experienceLevel.charAt(0).toUpperCase() + experienceLevel.slice(1) + ' Lifter'
    : 'Athlete'

  const currentWeight = weightStats?.current ?? null
  const weightLabel =
    currentWeight != null
      ? `${currentWeight.toFixed(1)} ${weightUnit}`
      : '—'

  const heightLabel =
    hydrated && heightCm != null ? `${Math.round(heightCm)} cm` : '—'

  const displayAvatar =
    avatarUrl ||
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined) ||
    null

  const profileOptions = [
    { name: 'Body Composition', href: '/body-composition', icon: ScanLine, color: 'text-primary', bg: 'bg-primary/10' },
    { name: 'Workout Plans', href: '/plans', icon: ClipboardList, color: 'text-primary', bg: 'bg-primary/10' },
    { name: 'Exercise Library', href: '/exercises', icon: Library, color: 'text-primary', bg: 'bg-primary/10' },
    { name: 'Personal Records', href: '/personal-records', icon: Award, color: 'text-primary', bg: 'bg-primary/10' },
    { name: 'Workout Calendar', href: '/calendar', icon: Calendar, color: 'text-primary', bg: 'bg-primary/10' },
    { name: 'Settings', href: '/settings', icon: Settings, color: 'text-muted-foreground', bg: 'bg-muted' },
  ]

  const handleLogout = async () => {
    setIsSigningOut(true)
    await pushSyncBeforeLogout()
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    router.push('/login')
    router.refresh()
  }

  const handleSaveHeight = () => {
    const value = parseFloat(heightInput)
    if (!value || value < 50 || value > 300) return
    setHeightCm(value)
    setHeightInput('')
    setShowHeightForm(false)
  }

  const handleAvatarPick = () => {
    setAvatarError(null)
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Image must be under 5MB')
      return
    }

    setIsUploadingAvatar(true)
    setAvatarError(null)

    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body,
      })
      const data = (await res.json()) as { url?: string; error?: string; user?: typeof user }

      if (!res.ok || !data.url) {
        setAvatarError(data.error || 'Upload failed')
        return
      }

      setProfile({ avatarUrl: data.url })
      if (data.user) {
        setUser(data.user)
      } else {
        const supabase = createClient()
        const {
          data: { user: refreshed },
        } = await supabase.auth.getUser()
        if (refreshed) setUser(refreshed)
      }
    } catch {
      setAvatarError('Upload failed. Check your connection and try again.')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Profile Header */}
      <div className="flex flex-col items-center text-center space-y-3 mt-4">
        <div className="relative">
          <button
            type="button"
            onClick={handleAvatarPick}
            disabled={isUploadingAvatar}
            className="w-24 h-24 rounded-full bg-card border border-border flex items-center justify-center relative overflow-hidden cursor-pointer active:scale-95 transition-transform disabled:opacity-70"
            aria-label="Change profile photo"
          >
            {displayAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayAvatar}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-12 h-12 text-muted-foreground" />
            )}
            {isUploadingAvatar && (
              <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            )}
          </button>
          <button
            type="button"
            onClick={handleAvatarPick}
            disabled={isUploadingAvatar}
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary border-2 border-background flex items-center justify-center cursor-pointer active:scale-95 disabled:opacity-70"
            aria-label="Upload profile photo"
          >
            <Camera className="w-3.5 h-3.5 text-primary-foreground" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">{displayName}</h2>
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
            {levelLabel}
          </span>
          {user?.email && (
            <p className="text-xs text-muted-foreground mt-1">{user.email}</p>
          )}
          <button
            type="button"
            onClick={handleAvatarPick}
            disabled={isUploadingAvatar}
            className="mt-2 text-xs font-bold text-primary cursor-pointer hover:underline disabled:opacity-50"
          >
            {isUploadingAvatar ? 'Uploading…' : displayAvatar ? 'Change photo' : 'Add profile photo'}
          </button>
          {avatarError && (
            <p className="text-xs text-destructive mt-1.5 max-w-[260px] mx-auto">{avatarError}</p>
          )}
        </div>
      </div>

      {/* Stats Summary — live weight from Progress log */}
      <div className="bg-card border border-border rounded-[24px] p-5 grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => router.push('/progress')}
          className="space-y-0.5 border-r border-border text-left cursor-pointer pr-2"
        >
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
            <Scale className="w-3 h-3" /> Weight
          </span>
          <h4 className="text-base font-bold text-foreground">{weightLabel}</h4>
          <p className="text-[10px] text-primary font-semibold">
            {currentWeight != null ? 'Latest log · tap to update' : 'Tap to log weight'}
          </p>
        </button>
        <button
          type="button"
          onClick={() => {
            setHeightInput(heightCm != null ? String(heightCm) : '')
            setShowHeightForm((v) => !v)
          }}
          className="space-y-0.5 pl-2 text-left cursor-pointer"
        >
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
            <Ruler className="w-3 h-3" /> Height
          </span>
          <h4 className="text-base font-bold text-foreground">{heightLabel}</h4>
          <p className="text-[10px] text-primary font-semibold">
            {heightCm != null ? 'Tap to edit' : 'Tap to set'}
          </p>
        </button>
      </div>

      {showHeightForm && (
        <div className="bg-card border border-border rounded-[20px] p-4 space-y-3">
          <p className="text-xs font-semibold text-foreground">Height (cm)</p>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={heightInput}
              onChange={(e) => setHeightInput(e.target.value)}
              placeholder="e.g. 180"
              className="flex-1 h-11 bg-muted border border-border rounded-[14px] px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
            <Button
              onClick={handleSaveHeight}
              disabled={!heightInput}
              className="h-11 px-4 rounded-[14px] bg-primary text-primary-foreground font-bold border-0"
            >
              Save
            </Button>
          </div>
          <ArHeightMeasureButton
            onEstimate={(cm) => {
              setHeightInput(String(cm))
            }}
          />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            AR estimate uses on-device pose detection. Confirm the value before saving.
          </p>
        </div>
      )}

      {/* Options List */}
      <div className="bg-card border border-border rounded-[24px] overflow-hidden">
        {profileOptions.map((opt, idx) => {
          const Icon = opt.icon
          return (
            <button
              key={opt.name}
              onClick={() => router.push(opt.href)}
              className={`w-full py-4 px-5 flex justify-between items-center hover:bg-muted transition-colors cursor-pointer text-left ${
                idx !== profileOptions.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${opt.bg} flex items-center justify-center overflow-hidden`}>
                  <Icon className={`w-4 h-4 ${opt.color}`} />
                </div>
                <span className="text-sm font-semibold text-foreground">{opt.name}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          )
        })}
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        disabled={isSigningOut}
        className="w-full h-[52px] bg-destructive/10 hover:bg-destructive/20 border border-destructive/10 rounded-[24px] text-destructive font-bold flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
      >
        {isSigningOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
        Sign Out
      </button>
    </div>
  )
}
