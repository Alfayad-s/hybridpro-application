'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dumbbell,
  Flame,
  Play,
  ChevronRight,
  ArrowRight,
  Trophy,
  Clock,
  Scale,
  Check,
  Coffee,
  Award,
  Timer,
  BarChart3,
  Droplets,
  PartyPopper,
  Apple,
  UtensilsCrossed,
  CalendarDays,
  ListChecks,
} from 'lucide-react'
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  getHours,
  parseISO,
  formatDistanceToNow,
} from 'date-fns'
import { useAuthStore } from '@/stores/authStore'
import { useWorkoutStore } from '@/stores/workoutStore'
import { usePlanStore, type PlanDay } from '@/stores/planStore'
import { useProgressStore, computeBodyWeightStats } from '@/stores/progressStore'
import { useRecoveryStore } from '@/stores/recoveryStore'
import { useExerciseStore } from '@/stores/exerciseStore'
import { useHistoryStore, type CompletedWorkout } from '@/stores/historyStore'
import { useProfileStore } from '@/stores/profileStore'
import {
  summarizeMeals,
  todayKey,
  formatWaterAmount,
  useMealStore,
} from '@/stores/mealStore'
import {
  RECOVERY_GROUPS,
  GROUP_MUSCLES,
  STATUS_COLOR,
  getGroupRecovery,
  getMuscleRecovery,
  muscleIdFromSlug,
  muscleSlugToGroup,
  type RecoveryGroup,
  type RecoveryStatus,
} from '@/lib/muscle-recovery'
import {
  getExerciseById,
  WEEKDAY_LABELS,
  type CatalogExercise,
} from '@/data/exercises'
import {
  getGlobalHighlights,
  getActiveStreakDays,
  formatVolumeKg,
} from '@/lib/workout-analytics'
import {
  findPlanDayByWeekday,
  getTomorrowWeekday,
  isWorkoutDay,
  planDaySessionName,
  planDayToSessionExercises,
} from '@/lib/plan-day'
import {
  MuscleMap,
  ZoomableAnatomy,
  WORKOUT_MUSCLES,
  MUSCLE_LABELS,
  highlightsFromMuscles,
} from '@/components/muscle-map'
import type { MuscleHighlights } from '@/components/muscle-map'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import { ChallengesWidget } from '@/components/challenges/challenges-widget'
import { RecoveryGroupSheet } from '@/components/recovery/RecoveryGroupSheet'

const FOCUS_FROM_MUSCLE: Record<string, keyof typeof WORKOUT_MUSCLES> = {
  chest: 'chest',
  back: 'back',
  legs: 'legs',
  glutes: 'legs',
  calves: 'legs',
  shoulders: 'shoulders',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms',
  abs: 'abs',
  core: 'abs',
}

function estimateDurationMinutes(day: PlanDay) {
  if (day.exercises.length === 0) return 0
  const seconds = day.exercises.reduce((total, ex) => {
    const workPerSet = 45
    const rest = ex.restSeconds || 90
    return total + ex.targetSets * (workPerSet + rest)
  }, 0)
  return Math.max(15, Math.round(seconds / 60))
}

function highlightsForToday(
  day: PlanDay,
  customExercises: CatalogExercise[] = []
): {
  highlights: MuscleHighlights
  view: 'front' | 'back'
  labels: string[]
} {
  const primary = new Set<string>()
  const secondary = new Set<string>()
  let frontVotes = 0
  let backVotes = 0

  for (const planEx of day.exercises) {
    const catalog = getExerciseById(planEx.exerciseId, customExercises)
    if (catalog) {
      catalog.anatomy.primary.forEach((m) => primary.add(m))
      catalog.anatomy.secondary.forEach((m) => secondary.add(m))
      if (catalog.anatomy.view === 'back') backVotes += 1
      else frontVotes += 1
    } else {
      const focus = FOCUS_FROM_MUSCLE[planEx.primaryMuscle.toLowerCase()]
      if (focus) WORKOUT_MUSCLES[focus].forEach((id) => primary.add(id))
      if (focus === 'back') backVotes += 1
      else frontVotes += 1
    }
  }

  if (primary.size === 0) {
    const focusLower = day.muscleFocus.toLowerCase()
    if (focusLower.includes('back')) {
      WORKOUT_MUSCLES.back.forEach((id) => primary.add(id))
      backVotes = 1
    } else if (focusLower.includes('chest')) {
      WORKOUT_MUSCLES.chest.forEach((id) => primary.add(id))
    } else if (focusLower.includes('leg')) {
      WORKOUT_MUSCLES.legs.forEach((id) => primary.add(id))
    } else if (focusLower.includes('shoulder')) {
      WORKOUT_MUSCLES.shoulders.forEach((id) => primary.add(id))
    } else if (focusLower.includes('arm')) {
      WORKOUT_MUSCLES.arms.forEach((id) => primary.add(id))
    } else if (focusLower.includes('ab') || focusLower.includes('core')) {
      WORKOUT_MUSCLES.abs.forEach((id) => primary.add(id))
    }
  }

  const highlights: MuscleHighlights = {
    ...highlightsFromMuscles([...secondary], 'var(--primary)', 0.45),
    ...highlightsFromMuscles([...primary], 'var(--primary)', 0.95),
  }

  const labels = Array.from(
    new Set(
      day.exercises
        .map((e) => e.primaryMuscle)
        .filter(Boolean)
        .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
    )
  ).slice(0, 4)

  return {
    highlights,
    view: backVotes > frontVotes ? 'back' : 'front',
    labels,
  }
}

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-muted/80 ${className ?? ''}`}
      aria-hidden
    />
  )
}

function DashboardSkeleton() {
  return (
    <div className="px-5 pt-5 pb-8 space-y-5" aria-busy="true" aria-label="Loading dashboard">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="w-12 h-12 rounded-full shrink-0" />
      </div>

      {/* Today's workout card */}
      <div className="rounded-[24px] border border-border bg-card p-5 space-y-4">
        <Skeleton className="h-3 w-28" />
        <div className="flex gap-4">
          <div className="flex-1 space-y-3">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-4 w-full max-w-[220px]" />
            <div className="flex gap-3">
              <Skeleton className="h-10 w-16" />
              <Skeleton className="h-10 w-20" />
            </div>
          </div>
          <Skeleton className="w-[100px] h-[140px] rounded-[20px] shrink-0" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 flex-1 rounded-[14px]" />
          <Skeleton className="h-11 flex-1 rounded-[14px]" />
        </div>
      </div>

      {/* Active plan */}
      <div className="bg-card border border-border rounded-[20px] p-4 flex items-center justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-4 w-4 rounded" />
      </div>

      {/* Meals */}
      <div className="rounded-[24px] border border-border bg-card p-4 space-y-3">
        <Skeleton className="h-3 w-28" />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-[20px] p-3.5 space-y-2"
          >
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-full" />
          </div>
        ))}
      </div>

      {/* Recovery */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="bg-card border border-border rounded-[24px] p-4 space-y-4">
          <div className="flex justify-center gap-2">
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
          <div className="flex justify-center">
            <Skeleton className="w-[160px] h-[220px] rounded-[24px]" />
          </div>
          <div className="space-y-3 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-2 flex-1 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly activity */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <div className="bg-card border border-border rounded-[24px] p-4">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Skeleton className="h-3 w-6" />
                <Skeleton className="w-10 h-10 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lifetime stats */}
      <div className="grid grid-cols-2 gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-[20px] p-4 space-y-2"
          >
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-14" />
          </div>
        ))}
      </div>
    </div>
  )
}

function areDashboardStoresHydrated() {
  if (typeof window === 'undefined') return false
  const stores = [
    usePlanStore,
    useHistoryStore,
    useProgressStore,
    useRecoveryStore,
    useExerciseStore,
    useProfileStore,
    useWorkoutStore,
    useMealStore,
  ]
  return stores.every((store) => {
    const persistApi = (
      store as unknown as {
        persist?: { hasHydrated?: () => boolean }
      }
    ).persist
    return persistApi?.hasHydrated?.() ?? true
  })
}

function waitForStoreHydration(
  store: unknown
): Promise<void> {
  return new Promise((resolve) => {
    const persistApi = (
      store as {
        persist?: {
          hasHydrated?: () => boolean
          onFinishHydration?: (fn: () => void) => () => void
        }
      }
    ).persist
    if (persistApi?.hasHydrated?.()) {
      resolve()
      return
    }
    const unsub = persistApi?.onFinishHydration?.(() => {
      unsub?.()
      resolve()
    })
    if (!unsub) resolve()
  })
}

function BodyWeightSparkline({ weights }: { weights: number[] }) {
  if (weights.length < 2) {
    return <div className="h-6 mt-1" />
  }

  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const range = Math.max(0.1, max - min)
  const points = weights
    .map((w, i) => {
      const x = (i / (weights.length - 1)) * 64
      const y = 20 - ((w - min) / range) * 16
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg viewBox="0 0 64 24" className="w-full h-6 mt-1" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TimeBars({ minutes }: { minutes: number[] }) {
  const max = Math.max(...minutes, 1)
  return (
    <div className="flex items-end gap-0.5 h-6 mt-1">
      {minutes.map((m, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm ${m > 0 ? 'bg-sky-500/80' : 'bg-muted'}`}
          style={{ height: `${Math.max(m > 0 ? 12 : 8, (m / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

const statusStyles: Record<RecoveryStatus, string> = {
  Ready: 'text-primary',
  Recovering: 'text-warning',
  Fatigued: 'text-destructive',
}

function RecoveryRing({
  percent,
  color,
  size = 40,
  stroke = 3.5,
}: {
  percent: number
  color: string
  size?: number
  stroke?: number
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, percent))
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
          opacity={0.55}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums text-foreground">
        {Math.round(clamped)}
      </span>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const startWorkout = useWorkoutStore((s) => s.startWorkout)
  const activeSession = useWorkoutStore((s) => s.activeSession)
  const plans = usePlanStore((s) => s.plans)
  const bodyWeightLog = useProgressStore((s) => s.bodyWeightLog)
  const goalWeight = useProgressStore((s) => s.goalWeight)
  const lastTrained = useRecoveryStore((s) => s.lastTrained)
  const customExercises = useExerciseStore((s) => s.exercises)
  const workouts = useHistoryStore((s) => s.workouts)
  const meals = useMealStore((s) => s.meals)
  const waterLogs = useMealStore((s) => s.waterLogs)
  const dailyCalorieGoal = useMealStore((s) => s.dailyCalorieGoal)
  const dailyProteinGoal = useMealStore((s) => s.dailyProteinGoal)
  const dailyWaterGoalMl = useMealStore((s) => s.dailyWaterGoalMl)
  const profileAvatarUrl = useProfileStore((s) => s.avatarUrl)
  const authLoading = useAuthStore((s) => s.loading)
  const [bodyView, setBodyView] = useState<'front' | 'back'>('front')
  const [todayMapView, setTodayMapView] = useState<'front' | 'back'>('front')
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null)
  const [selectedMuscleSlug, setSelectedMuscleSlug] = useState<string | null>(null)
  const [recoverySheetGroup, setRecoverySheetGroup] = useState<RecoveryGroup | null>(null)
  const [hydrated, setHydrated] = useState(areDashboardStoresHydrated)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [clock, setClock] = useState(() => new Date())

  useEffect(() => {
    let cancelled = false
    const timeout = setTimeout(() => {
      if (!cancelled) setHydrated(true)
    }, 1500)

    void Promise.all([
      waitForStoreHydration(usePlanStore),
      waitForStoreHydration(useHistoryStore),
      waitForStoreHydration(useProgressStore),
      waitForStoreHydration(useRecoveryStore),
      waitForStoreHydration(useExerciseStore),
      waitForStoreHydration(useProfileStore),
      waitForStoreHydration(useWorkoutStore),
      waitForStoreHydration(useMealStore),
    ]).then(() => {
      if (!cancelled) {
        clearTimeout(timeout)
        setHydrated(true)
      }
    })

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Rebuild recovery from history so deleted sessions clear anatomy fatigue
  useEffect(() => {
    if (!hydrated) return
    useRecoveryStore.getState().rebuildFromWorkouts(workouts)
  }, [hydrated, workouts])

  const activePlan = useMemo(() => plans.find((p) => p.isActive) ?? plans[0] ?? null, [plans])

  const todayDay = useMemo(() => {
    if (!hydrated || !activePlan) return null
    const jsDay = new Date().getDay()
    const dayOfWeek = jsDay === 0 ? 7 : jsDay
    return activePlan.days.find((d) => d.dayOfWeek === dayOfWeek) ?? null
  }, [activePlan, hydrated])

  const tomorrowDay = useMemo(() => {
    if (!hydrated || !activePlan) return null
    return findPlanDayByWeekday(activePlan, getTomorrowWeekday())
  }, [activePlan, hydrated])

  const canTakeTomorrowWorkout = Boolean(tomorrowDay && isWorkoutDay(tomorrowDay))
  const tomorrowWorkoutLabel = useMemo(() => {
    if (!tomorrowDay?.dayOfWeek) return null
    const weekday = WEEKDAY_LABELS[tomorrowDay.dayOfWeek - 1]
    const focus = tomorrowDay.muscleFocus || tomorrowDay.name
    return `${weekday} · ${focus}`
  }, [tomorrowDay])

  const workoutSplit = todayDay?.muscleFocus || todayDay?.name || 'Custom Workout'
  const workoutDayLabel = todayDay
    ? todayDay.dayOfWeek
      ? WEEKDAY_LABELS[todayDay.dayOfWeek - 1]
      : todayDay.name
    : null
  const workoutExerciseCount = todayDay?.exercises.length ?? 0
  const estimatedMinutes = todayDay ? estimateDurationMinutes(todayDay) : 0

  const firstName =
    user?.user_metadata?.full_name?.split(' ')[0] ||
    user?.user_metadata?.name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'Athlete'

  const avatarUrl =
    profileAvatarUrl ||
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined) ||
    null

  const greeting = greetingForHour(getHours(clock))
  const dayKey = format(clock, 'yyyy-MM-dd')
  const now = useMemo(() => new Date(`${dayKey}T12:00:00`), [dayKey])
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  }, [now])

  const historyStats = useMemo(() => {
    if (!hydrated) {
      return {
        streakDays: 0,
        highlights: null as ReturnType<typeof getGlobalHighlights> | null,
        completedDayKeys: new Set<string>(),
        todayMinutes: 0,
        todayVolumeKg: 0,
        todaySets: 0,
        latestToday: null as CompletedWorkout | null,
        todayDone: false,
        weekMinutes: [] as number[],
        totalHours: 0,
      }
    }

    const highlights = getGlobalHighlights(workouts)
    const completedDayKeys = new Set(
      workouts.map((w) => format(parseISO(w.completedAt), 'yyyy-MM-dd'))
    )
    const todayKey = format(now, 'yyyy-MM-dd')
    const todaysWorkouts = workouts.filter(
      (w) => format(parseISO(w.completedAt), 'yyyy-MM-dd') === todayKey
    )
    const todayMinutes = todaysWorkouts.reduce((sum, w) => sum + w.durationMinutes, 0)
    const todayVolumeKg = todaysWorkouts.reduce((sum, w) => sum + w.volumeKg, 0)
    const todaySets = todaysWorkouts.reduce((sum, w) => sum + w.totalSets, 0)
    const latestToday = todaysWorkouts[0] ?? null

    const weekMinutes = weekDays.map((day) => {
      const key = format(day, 'yyyy-MM-dd')
      return workouts
        .filter((w) => format(parseISO(w.completedAt), 'yyyy-MM-dd') === key)
        .reduce((sum, w) => sum + w.durationMinutes, 0)
    })

    const totalHours = Math.round(
      workouts.reduce((sum, w) => sum + w.durationMinutes, 0) / 60
    )

    return {
      streakDays: getActiveStreakDays(workouts),
      highlights,
      completedDayKeys,
      todayMinutes,
      todayVolumeKg,
      todaySets,
      latestToday,
      todayDone: todaysWorkouts.length > 0,
      weekMinutes,
      totalHours,
    }
  }, [hydrated, workouts, now, weekDays])

  const restDayIndexes = useMemo(() => {
    if (!activePlan) return new Set<number>()
    const rest = new Set<number>()
    weekDays.forEach((day, index) => {
      const jsDay = day.getDay()
      const dayOfWeek = jsDay === 0 ? 7 : jsDay
      const planDay = activePlan.days.find((d) => d.dayOfWeek === dayOfWeek)
      if (!planDay || planDay.isRestDay || planDay.exercises.length === 0) {
        rest.add(index)
      }
    })
    return rest
  }, [activePlan, weekDays])

  const weeklyGoal = useMemo(() => {
    if (!activePlan) return 0
    return activePlan.days.filter((d) => d.exercises.length > 0).length
  }, [activePlan])

  const bodyWeightStats = useMemo(() => {
    if (!hydrated || bodyWeightLog.length === 0) {
      return {
        current: null as number | null,
        trend: 'Log in Progress',
        trendClass: 'text-muted-foreground',
        sparkline: [] as number[],
      }
    }

    const stats = computeBodyWeightStats(bodyWeightLog, goalWeight)
    const sparkline = [...bodyWeightLog]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-8)
      .map((e) => e.weight)

    if (stats.weeklyChange == null) {
      return {
        current: stats.current,
        trend: 'Latest log',
        trendClass: 'text-muted-foreground',
        sparkline,
      }
    }
    if (Math.abs(stats.weeklyChange) < 0.05) {
      return {
        current: stats.current,
        trend: 'No change this week',
        trendClass: 'text-muted-foreground',
        sparkline,
      }
    }
    const sign = stats.weeklyChange > 0 ? '+' : ''
    return {
      current: stats.current,
      trend: `${sign}${stats.weeklyChange.toFixed(1)} kg this week`,
      trendClass: stats.weeklyChange > 0 ? 'text-primary' : 'text-sky-500',
      sparkline,
    }
  }, [bodyWeightLog, goalWeight, hydrated])

  const latestPr = historyStats.highlights?.heaviest ?? null

  const mealStats = useMemo(() => {
    if (!hydrated) {
      return { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, count: 0, waterMl: 0 }
    }
    const key = todayKey()
    return {
      ...summarizeMeals(meals.filter((m) => m.date === key)),
      waterMl: useMealStore.getState().getWaterTotalMl(key),
    }
  }, [hydrated, meals, waterLogs])

  const caloriePct = Math.min(
    100,
    Math.round((mealStats.calories / Math.max(1, dailyCalorieGoal)) * 100)
  )
  const proteinPct = Math.min(
    100,
    Math.round((mealStats.proteinG / Math.max(1, dailyProteinGoal)) * 100)
  )
  const waterPct = Math.min(
    100,
    Math.round((mealStats.waterMl / Math.max(1, dailyWaterGoalMl)) * 100)
  )

  const sessionExerciseCount = activeSession?.exercises.length ?? 0
  const sessionCompleted = activeSession
    ? activeSession.exercises.filter((e) => e.sets.some((s) => s.isCompleted)).length
    : 0
  const progressPct =
    activeSession && sessionExerciseCount > 0
      ? Math.round((sessionCompleted / sessionExerciseCount) * 100)
      : 0

  const todayBody = useMemo(() => {
    if (!todayDay) {
      return {
        highlights: {} as MuscleHighlights,
        view: 'front' as const,
        labels: [] as string[],
      }
    }
    return highlightsForToday(todayDay, customExercises)
  }, [todayDay, customExercises])

  useEffect(() => {
    setTodayMapView(todayBody.view)
  }, [todayBody.view])

  const recoveryList = useMemo(() => {
    void nowTick
    return RECOVERY_GROUPS.map((group) => getGroupRecovery(group, lastTrained, Date.now()))
  }, [lastTrained, nowTick])

  const recoveryHighlights = useMemo(() => {
    const map: MuscleHighlights = {}
    for (const item of recoveryList) {
      for (const muscle of item.muscles) {
        const opacity = 0.35 + (1 - muscle.recoveredPct) * 0.6
        const def = GROUP_MUSCLES[item.group].find((m) => m.id === muscle.id)
        for (const slug of def?.mapSlugs ?? [muscle.id]) {
          map[slug] = { color: STATUS_COLOR[muscle.status], opacity }
        }
      }
    }
    return map
  }, [recoveryList])

  const selectedMuscleRecovery = useMemo(() => {
    if (!selectedMuscleSlug) return null
    const id = muscleIdFromSlug(selectedMuscleSlug)
    if (!id) return null
    const record = lastTrained[id]
    return getMuscleRecovery(id, record?.date ?? null, record?.volumeKg ?? 0, Date.now())
  }, [selectedMuscleSlug, lastTrained, nowTick])

  const recoverySheetDetail = useMemo(() => {
    if (!recoverySheetGroup) return null
    return recoveryList.find((item) => item.group === recoverySheetGroup) ?? null
  }, [recoverySheetGroup, recoveryList])

  const openRecoveryGroup = (group: RecoveryGroup) => {
    setRecoverySheetGroup(group)
  }

  const startFromPlanDay = (day: PlanDay | null, nameSuffix?: string) => {
    const session = useWorkoutStore.getState().activeSession
    if (session) {
      router.push('/workout')
      return
    }

    if (day && isWorkoutDay(day)) {
      startWorkout(
        planDaySessionName(day, nameSuffix),
        planDayToSessionExercises(day)
      )
    } else {
      startWorkout('Quick Workout')
    }
    router.push('/workout')
  }

  const handleContinue = () => {
    startFromPlanDay(todayDay && !todayDay.isRestDay ? todayDay : null)
  }

  const handleStartTomorrowWorkout = () => {
    if (!tomorrowDay || !isWorkoutDay(tomorrowDay)) return
    startFromPlanDay(tomorrowDay, 'Tomorrow')
  }

  const lifetimeStats = [
    {
      label: 'Total Workouts',
      value: String(historyStats.highlights?.totalSessions ?? 0),
      icon: Dumbbell,
      color: 'text-primary',
    },
    {
      label: 'Workout Hours',
      value: `${historyStats.totalHours}h`,
      icon: Timer,
      color: 'text-sky-500',
    },
    {
      label: 'Total Volume',
      value: formatVolumeKg(historyStats.highlights?.totalVolume ?? 0),
      icon: BarChart3,
      color: 'text-primary',
    },
    {
      label: 'PRs Achieved',
      value: String(historyStats.highlights?.prCount ?? 0),
      icon: Award,
      color: 'text-warning',
    },
  ]

  if (!hydrated || authLoading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="px-5 pt-5 pb-8 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">
            {greeting} <span aria-hidden>👋</span>
          </p>
          <h1 className="text-[28px] leading-tight font-bold text-foreground tracking-tight truncate mt-0.5">
            {firstName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            <span className="font-medium text-foreground/80 tabular-nums">
              {format(clock, 'h:mm a')}
            </span>
            <span className="mx-1.5 text-border">·</span>
            <span>{format(clock, 'EEEE, d MMMM')}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => router.push('/calendar')}
            className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center cursor-pointer active:scale-95"
            aria-label="Open calendar"
          >
            <CalendarDays className="w-5 h-5 text-foreground" />
          </button>
          <button
            type="button"
            onClick={() => router.push('/profile')}
            className="w-12 h-12 rounded-full bg-card border border-border overflow-hidden flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Profile"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm font-bold text-primary">
                {firstName.slice(0, 1).toUpperCase()}
              </span>
            )}
          </button>
        </div>
      </div>

      <InstallPrompt />
      {/* Streak */}
      {hydrated && historyStats.streakDays > 0 && (
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-warning/25 via-warning/15 to-warning/25 border-2 border-warning/50 px-4 py-2 shadow-[0_0_24px_rgba(245,158,11,0.35)] ring-2 ring-warning/20">
            <Flame className="w-4 h-4 text-warning fill-warning/40 animate-pulse" />
            <span className="text-sm font-extrabold text-warning tracking-wide">
              {historyStats.streakDays} Day Streak
            </span>
            <Flame className="w-4 h-4 text-warning fill-warning/40 animate-pulse" />
          </div>
        </div>
      )}

      {/* Today's Workout */}
      <section
        className={`rounded-[24px] border p-5 overflow-hidden ${
          historyStats.todayDone && !activeSession
            ? 'border-primary/40 bg-gradient-to-br from-primary/20 via-card to-card dark:from-[#1A2A0E] dark:via-[#141419] dark:to-[#0B0B0F]'
            : 'border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card dark:from-[#1A2210] dark:via-[#141419] dark:to-[#0B0B0F]'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 text-primary">
            {historyStats.todayDone && !activeSession ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Dumbbell className="w-3.5 h-3.5" />
            )}
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {historyStats.todayDone && !activeSession
                ? "Today's Workout · Done"
                : "Today's Workout"}
            </span>
          </div>
          {historyStats.todayDone && !activeSession && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 border border-primary/30 px-2 py-0.5 text-[9px] font-bold text-primary uppercase">
              <PartyPopper className="w-3 h-3" />
              Complete
            </span>
          )}
        </div>

        {historyStats.todayDone && !activeSession ? (
          <div className="space-y-4">
            <div className="flex gap-4 items-start">
              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                    <Trophy className="w-6 h-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[24px] font-bold text-foreground tracking-tight leading-tight">
                      Workout crushed!
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {historyStats.latestToday?.name || workoutSplit} is in the books
                      {historyStats.streakDays > 0
                        ? ` · ${historyStats.streakDays}-day streak`
                        : ''}
                      .
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-[16px] bg-background/60 border border-border px-3 py-2.5 text-center">
                    <p className="text-sm font-bold text-foreground tabular-nums">
                      {historyStats.todayMinutes}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Minutes</p>
                  </div>
                  <div className="rounded-[16px] bg-background/60 border border-border px-3 py-2.5 text-center">
                    <p className="text-sm font-bold text-foreground tabular-nums">
                      {historyStats.todaySets}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Sets</p>
                  </div>
                  <div className="rounded-[16px] bg-background/60 border border-border px-3 py-2.5 text-center">
                    <p className="text-sm font-bold text-foreground tabular-nums">
                      {formatVolumeKg(historyStats.todayVolumeKg)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Volume</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-bold text-primary tabular-nums">100%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/80 overflow-hidden">
                    <div className="h-full w-full rounded-full bg-primary" />
                  </div>
                  <p className="text-[11px] text-primary font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    Today&apos;s session finished
                    {historyStats.latestToday
                      ? ` · ${formatDistanceToNow(parseISO(historyStats.latestToday.completedAt), { addSuffix: true })}`
                      : ''}
                  </p>
                </div>
              </div>

              {todayDay && (
                <div className="shrink-0 w-[100px] flex flex-col items-center opacity-90">
                  <MuscleMap
                    view={todayMapView}
                    highlights={todayBody.highlights}
                    defaultFill="var(--muscle-default)"
                    interactive={false}
                    className="max-h-[140px]"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {activePlan && todayDay ? (
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/plans/${activePlan.id}/days/${todayDay.id}`)
                  }
                  className="flex-1 h-[48px] rounded-[16px] border border-border bg-muted text-sm font-bold text-foreground flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                >
                  <ListChecks className="w-3.5 h-3.5" />
                  View Plan
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push('/history')}
                  className="flex-1 h-[48px] rounded-[16px] border border-border bg-muted text-sm font-bold text-foreground cursor-pointer active:scale-[0.98]"
                >
                  View History
                </button>
              )}
              <button
                type="button"
                onClick={handleContinue}
                className="flex-1 h-[48px] rounded-[16px] bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Another Session
              </button>
            </div>
            {canTakeTomorrowWorkout && !activeSession && (
              <button
                type="button"
                onClick={handleStartTomorrowWorkout}
                className="w-full mt-2 h-[44px] rounded-[14px] border border-border bg-muted/60 text-sm font-semibold text-foreground flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-[0.98]"
              >
                <span>Take Tomorrow&apos;s Workout</span>
                {tomorrowWorkoutLabel && (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {tomorrowWorkoutLabel}
                  </span>
                )}
              </button>
            )}
          </div>
        ) : todayDay && !todayDay.isRestDay ? (
          <>
            <div className="flex gap-4">
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  {workoutDayLabel && (
                    <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">
                      {workoutDayLabel}
                      {todayDay.name !== workoutSplit ? ` · ${todayDay.name}` : ''}
                    </p>
                  )}
                  <h2 className="text-[26px] font-bold text-foreground tracking-tight leading-tight">
                    {workoutSplit}
                  </h2>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Dumbbell className="w-3.5 h-3.5 text-primary" />
                    <div>
                      <p className="text-sm font-bold text-foreground tabular-nums">
                        {workoutExerciseCount}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Exercises</p>
                    </div>
                  </div>
                  <div className="w-px h-8 bg-muted/80" />
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <div>
                      <p className="text-sm font-bold text-foreground tabular-nums">
                        ~{estimatedMinutes} min
                      </p>
                      <p className="text-[10px] text-muted-foreground">Estimated</p>
                    </div>
                  </div>
                </div>

                {todayBody.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {todayBody.labels.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-primary/15 border border-primary/25 px-2 py-0.5 text-[9px] font-semibold text-primary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="shrink-0 w-[118px] flex flex-col items-center">
                <div className="flex rounded-full bg-muted/80 dark:bg-black/30 border border-border p-0.5 mb-1.5">
                  {(['front', 'back'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTodayMapView(v)}
                      className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold capitalize cursor-pointer transition-colors ${
                        todayMapView === v
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <MuscleMap
                  view={todayMapView}
                  highlights={todayBody.highlights}
                  defaultFill="var(--muscle-default)"
                  interactive={false}
                  className="max-h-[168px]"
                />
              </div>
            </div>

            {(activeSession || workoutExerciseCount > 0) && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-bold text-primary tabular-nums">{progressPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {activeSession
                    ? `${sessionCompleted} / ${sessionExerciseCount} exercises completed`
                    : `0 / ${workoutExerciseCount} exercises completed`}
                </p>
              </div>
            )}

            <div className="flex gap-2 mt-3">
              {activePlan && todayDay && (
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/plans/${activePlan.id}/days/${todayDay.id}`)
                  }
                  className="flex-1 h-[52px] rounded-[18px] border border-border bg-muted text-sm font-bold text-foreground flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                >
                  <ListChecks className="w-4 h-4" />
                  View Plan
                </button>
              )}
              <button
                type="button"
                onClick={handleContinue}
                className={`${activePlan && todayDay ? 'flex-1' : 'w-full'} h-[52px] bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-[18px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer`}
              >
                <Play className="w-4 h-4 fill-current" />
                {activeSession ? 'Continue' : 'Start Workout'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            {canTakeTomorrowWorkout && !activeSession && (
              <button
                type="button"
                onClick={handleStartTomorrowWorkout}
                className="mt-2 w-full text-center text-xs font-semibold text-primary cursor-pointer active:opacity-70"
              >
                Do tomorrow&apos;s workout instead
                {tomorrowWorkoutLabel ? ` · ${tomorrowWorkoutLabel}` : ''}
              </button>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-4 items-start">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-foreground tracking-tight">
                  {todayDay?.isRestDay || activePlan ? 'Rest Day' : 'No Active Plan'}
                </h2>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {todayDay?.isRestDay
                    ? 'Scheduled rest day. Recover well or start a light custom session.'
                    : activePlan
                      ? 'Nothing scheduled for today. Take a rest or start a custom session.'
                      : "Create or activate a workout plan to see today's split here."}
                </p>
              </div>
              <div className="w-[88px] opacity-40 pointer-events-none">
                <MuscleMap
                  view="front"
                  highlights={{}}
                  defaultFill="var(--muscle-default)"
                  interactive={false}
                  className="max-h-[120px]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {activePlan && todayDay?.isRestDay ? (
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/plans/${activePlan.id}/days/${todayDay.id}`)
                  }
                  className="flex-1 h-11 rounded-[14px] border border-border bg-muted text-sm font-bold text-foreground flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ListChecks className="w-3.5 h-3.5" />
                  View Plan
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push('/plans')}
                  className="flex-1 h-11 rounded-[14px] border border-border bg-muted text-sm font-bold text-foreground cursor-pointer"
                >
                  {activePlan ? 'View Plan' : 'Set Up Plan'}
                </button>
              )}
              <button
                type="button"
                onClick={handleContinue}
                className="flex-1 h-11 rounded-[14px] bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Quick Start
              </button>
            </div>
            {canTakeTomorrowWorkout && !activeSession && (
              <button
                type="button"
                onClick={handleStartTomorrowWorkout}
                className="w-full h-11 rounded-[14px] border border-border bg-muted/60 text-sm font-semibold text-foreground flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-[0.98]"
              >
                <span>Take Tomorrow&apos;s Workout</span>
                {tomorrowWorkoutLabel && (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {tomorrowWorkoutLabel}
                  </span>
                )}
              </button>
            )}
          </div>
        )}
      </section>

      {/* Active plan shortcut */}
      <button
        type="button"
        onClick={() => router.push(activePlan ? `/plans/${activePlan.id}` : '/plans')}
        className="w-full bg-card border border-border rounded-[20px] p-4 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
      >
        <div className="text-left">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Active Plan
          </p>
          <p className="text-sm font-bold text-foreground mt-0.5">
            {activePlan?.name ?? 'Create a workout plan'}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-primary" />
      </button>

      <ChallengesWidget />

      {/* Today's Meals */}
      <button
        type="button"
        onClick={() => router.push('/meals')}
        className="w-full rounded-[24px] border border-primary/25 bg-gradient-to-br from-primary/10 via-transparent to-transparent p-4 text-left cursor-pointer active:scale-[0.99] transition-transform space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-primary">
            <Apple className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Today&apos;s Meals
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary">
            {mealStats.count > 0 ? 'Log more' : 'Log meal'}
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>

        {mealStats.count === 0 ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">No meals logged yet</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Snap a photo or add macros manually
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Calories
                </p>
                <p className="text-xl font-bold text-foreground tabular-nums mt-0.5">
                  {mealStats.calories}
                  <span className="text-xs font-semibold text-muted-foreground">
                    {' '}
                    / {dailyCalorieGoal}
                  </span>
                </p>
                <div className="mt-2 h-2 rounded-full bg-muted/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${caloriePct}%` }}
                  />
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Protein
                </p>
                <p className="text-xl font-bold text-foreground tabular-nums mt-0.5">
                  {mealStats.proteinG}g
                  <span className="text-xs font-semibold text-muted-foreground">
                    {' '}
                    / {dailyProteinGoal}g
                  </span>
                </p>
                <div className="mt-2 h-2 rounded-full bg-muted/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-warning transition-all"
                    style={{ width: `${proteinPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-[14px] bg-background/50 border border-border px-3 py-2 text-center">
                <p className="text-sm font-bold text-foreground tabular-nums">
                  {mealStats.carbsG}g
                </p>
                <p className="text-[10px] text-muted-foreground">Carbs</p>
              </div>
              <div className="rounded-[14px] bg-background/50 border border-border px-3 py-2 text-center">
                <p className="text-sm font-bold text-foreground tabular-nums">
                  {mealStats.fatG}g
                </p>
                <p className="text-[10px] text-muted-foreground">Fat</p>
              </div>
              <div className="rounded-[14px] bg-background/50 border border-border px-3 py-2 text-center">
                <p className="text-sm font-bold text-foreground tabular-nums">
                  {mealStats.count}
                </p>
                <p className="text-[10px] text-muted-foreground">Meals</p>
              </div>
            </div>
          </>
        )}

        <div className="rounded-[14px] bg-sky-500/10 border border-sky-500/20 px-3 py-2.5 flex items-center gap-3">
          <Droplets className="w-4 h-4 text-sky-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                Water
              </p>
              <p className="text-xs font-bold text-foreground tabular-nums">
                {formatWaterAmount(mealStats.waterMl)}
                <span className="text-muted-foreground font-semibold">
                  {' '}
                  / {formatWaterAmount(dailyWaterGoalMl)}
                </span>
              </p>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-muted/80 overflow-hidden">
              <div
                className="h-full rounded-full bg-sky-500 transition-all"
                style={{ width: `${waterPct}%` }}
              />
            </div>
          </div>
        </div>
      </button>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => router.push('/progress')}
          className="bg-card border border-border rounded-[20px] p-3.5 text-left cursor-pointer"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Scale className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Body Weight
            </span>
          </div>
          <p className="text-base font-bold text-foreground">
            {bodyWeightStats.current != null
              ? `${bodyWeightStats.current.toFixed(1)} kg`
              : '—'}
          </p>
          <p className={`text-[10px] font-medium mt-0.5 ${bodyWeightStats.trendClass}`}>
            {bodyWeightStats.trend}
          </p>
          <BodyWeightSparkline weights={bodyWeightStats.sparkline} />
        </button>

        <button
          type="button"
          onClick={() => router.push('/personal-records')}
          className="bg-card border border-border rounded-[20px] p-3.5 text-left cursor-pointer"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Trophy className="w-3.5 h-3.5 text-warning" />
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Latest PR
            </span>
          </div>
          {latestPr ? (
            <>
              <p className="text-sm font-bold text-foreground leading-tight truncate">
                {latestPr.exerciseName}
              </p>
              <p className="text-base font-bold text-foreground mt-0.5">
                {latestPr.heaviestLift.weight} kg
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {formatDistanceToNow(parseISO(latestPr.heaviestLift.date), {
                  addSuffix: true,
                })}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-foreground leading-tight">No PRs yet</p>
              <p className="text-[10px] text-muted-foreground mt-1">Finish workouts to track</p>
            </>
          )}
        </button>

        <div className="bg-card border border-border rounded-[20px] p-3.5">
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="w-3.5 h-3.5 text-sky-500" />
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Workout Time
            </span>
          </div>
          <p className="text-base font-bold text-foreground">
            {historyStats.todayMinutes > 0 ? `${historyStats.todayMinutes} min` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Today</p>
          <TimeBars minutes={historyStats.weekMinutes} />
        </div>
      </div>

      {/* Muscle Recovery */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Muscle Recovery
          </h3>
          <button
            type="button"
            onClick={() => router.push('/recovery')}
            className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
          >
            View Detail
          </button>
        </div>

        <div className="bg-transparent rounded-[24px] p-1 space-y-4">
          <div className="flex items-center justify-center gap-2">
            {(['front', 'back'] as const).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => setBodyView(view)}
                className={`h-8 px-4 rounded-full text-xs font-bold capitalize transition-colors cursor-pointer ${
                  bodyView === view
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                {view}
              </button>
            ))}
          </div>

          <div className="flex justify-center">
            <ZoomableAnatomy className="w-full max-w-[260px]" showHint={false}>
              <MuscleMap
                view={bodyView}
                highlights={recoveryHighlights}
                selected={selectedMuscleSlug}
                defaultFill="var(--muscle-default)"
                className="w-[200px] max-h-[280px]"
                onMuscleClick={(muscle) => {
                  setSelectedMuscleSlug(muscle)
                  setSelectedMuscle(MUSCLE_LABELS[muscle] ?? muscle)
                  const group = muscleSlugToGroup(muscle)
                  if (group) openRecoveryGroup(group)
                }}
              />
            </ZoomableAnatomy>
          </div>

          {selectedMuscleRecovery ? (
            <div className="rounded-[16px] border border-border bg-card/80 px-3.5 py-2.5 space-y-1.5 text-center">
              <p className="text-xs font-bold text-foreground">
                {selectedMuscleRecovery.label}
                <span className="text-muted-foreground font-medium">
                  {' '}
                  · {selectedMuscleRecovery.group}
                </span>
              </p>
              <div className="flex items-center justify-center gap-3 text-[11px]">
                <span className={`font-bold ${statusStyles[selectedMuscleRecovery.status]}`}>
                  {selectedMuscleRecovery.status}
                </span>
                <span className="font-semibold text-foreground tabular-nums">
                  {Math.round(selectedMuscleRecovery.recoveredPct * 100)}%
                </span>
                <span className="text-muted-foreground">{selectedMuscleRecovery.labelStatus}</span>
              </div>
            </div>
          ) : selectedMuscle ? (
            <p className="text-center text-xs text-muted-foreground">{selectedMuscle}</p>
          ) : null}

          <div className="flex items-center justify-center gap-4 text-[10px] font-medium">
            <span className="flex items-center gap-1.5 text-primary">
              <span className="w-2 h-2 rounded-full bg-primary" /> Ready
            </span>
            <span className="flex items-center gap-1.5 text-warning">
              <span className="w-2 h-2 rounded-full bg-warning" /> Recovering
            </span>
            <span className="flex items-center gap-1.5 text-destructive">
              <span className="w-2 h-2 rounded-full bg-destructive" /> Fatigued
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1">
            {recoveryList.map((item) => {
              const pct = Math.round(item.recoveredPct * 100)
              return (
                <button
                  key={item.group}
                  type="button"
                  onClick={() => openRecoveryGroup(item.group)}
                  className="flex flex-col items-center gap-1.5 text-center cursor-pointer active:scale-95"
                >
                  <RecoveryRing percent={pct} color={STATUS_COLOR[item.status]} />
                  <span className="text-[11px] font-semibold text-foreground leading-tight">
                    {item.group}
                  </span>
                  <span className={`text-[9px] font-bold ${statusStyles[item.status]}`}>
                    {item.status}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <RecoveryGroupSheet
          open={recoverySheetGroup != null}
          onOpenChange={(open) => {
            if (!open) setRecoverySheetGroup(null)
          }}
          group={recoverySheetDetail}
        />
      </section>

      {/* Weekly Activity */}
      <section className="space-y-3">
        <div className="flex items-end justify-between px-0.5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Weekly Activity
          </h3>
          <span className="text-[10px] text-muted-foreground">
            {weeklyGoal > 0
              ? `${[...historyStats.completedDayKeys].filter((key) =>
                  weekDays.some((d) => format(d, 'yyyy-MM-dd') === key)
                ).length} / ${weeklyGoal} this week`
              : 'No plan goal'}
          </span>
        </div>
        <div className="bg-card border border-border rounded-[24px] p-4">
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day, index) => {
              const dayKey = format(day, 'yyyy-MM-dd')
              const isToday = isSameDay(day, now)
              const isCompleted = historyStats.completedDayKeys.has(dayKey)
              const isRest = restDayIndexes.has(index) && !isCompleted

              return (
                <div key={day.toISOString()} className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {format(day, 'EEE')}
                  </span>
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border transition-colors ${
                      isCompleted
                        ? 'bg-primary border-primary text-primary-foreground'
                        : isToday
                          ? 'bg-primary/15 border-primary text-primary'
                          : isRest
                            ? 'bg-muted border-border text-muted-foreground'
                            : 'bg-transparent border-border text-muted-foreground'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : isToday ? (
                      <Dumbbell className="w-4 h-4" />
                    ) : isRest ? (
                      <Coffee className="w-3.5 h-3.5" />
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Lifetime stats */}
      <div className="grid grid-cols-2 gap-2.5">
        {lifetimeStats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="bg-card border border-border rounded-[20px] p-4 space-y-2"
            >
              <Icon className={`w-4 h-4 ${stat.color}`} />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </p>
              <p className="text-xl font-bold text-foreground tracking-tight">{stat.value}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
