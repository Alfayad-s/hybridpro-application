'use client'

import { useCallback, useMemo } from 'react'
import { formatDateKey } from '@/lib/challenges/dates'
import type { ChallengeGeneratorInput } from '@/lib/challenges/types'
import { getGroupRecovery, RECOVERY_GROUPS } from '@/lib/muscle-recovery'
import { getActiveStreakDays } from '@/lib/workout-analytics'
import { useBodyCompositionStore } from '@/stores/bodyCompositionStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useMealStore } from '@/stores/mealStore'
import { usePlanStore } from '@/stores/planStore'
import { useProgressStore } from '@/stores/progressStore'
import { useRecoveryStore } from '@/stores/recoveryStore'

export function useChallengeContext(): ChallengeGeneratorInput {
  const plans = usePlanStore((s) => s.plans)
  const workouts = useHistoryStore((s) => s.workouts)
  const reports = useBodyCompositionStore((s) => s.reports)
  const lastTrained = useRecoveryStore((s) => s.lastTrained)
  const proteinGoal = useMealStore((s) => s.dailyProteinGoal)
  const calorieGoal = useMealStore((s) => s.dailyCalorieGoal)
  const waterGoal = useMealStore((s) => s.dailyWaterGoalMl)
  const goalWeight = useProgressStore((s) => s.goalWeight)
  const bodyWeightLog = useProgressStore((s) => s.bodyWeightLog)

  return useMemo(() => {
    const today = formatDateKey(new Date())
    const activePlan = plans.find((p) => p.isActive) ?? plans[0]
    const dow = new Date().getDay()
    const dayOfWeek = dow === 0 ? 7 : dow
    const todayDay =
      activePlan?.days.find((d) => d.dayOfWeek === dayOfWeek && !d.isRestDay) ??
      activePlan?.days.find((d) => !d.isRestDay) ??
      null

    const scores = RECOVERY_GROUPS.map(
      (g) => getGroupRecovery(g, lastTrained, Date.now()).recoveredPct * 100
    )
    const recoveryScore = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 70

    const latest = reports[0] ?? null
    const latestWeight = bodyWeightLog[0]?.weight ?? latest?.weight ?? null

    let goal = 'general fitness'
    if (goalWeight != null && latestWeight != null && goalWeight < latestWeight) {
      goal = 'fat loss'
    } else if (goalWeight != null && latestWeight != null && goalWeight > latestWeight) {
      goal = 'muscle gain'
    }

    return {
      goal,
      todayWorkout: todayDay
        ? `${todayDay.name}${todayDay.muscleFocus ? ` (${todayDay.muscleFocus})` : ''}`
        : null,
      workoutHistory: workouts.slice(0, 8).map((w) => ({
        name: w.name,
        date: w.completedAt?.slice(0, 10) ?? today,
        exercises: w.exercises?.length,
      })),
      latestBIA: latest
        ? {
            weight: latest.weight,
            bodyFatPercent: latest.bodyFatPercent,
            skeletalMuscleMass: latest.skeletalMuscleMass,
            bodyScore: latest.bodyScore,
          }
        : null,
      recovery: {
        score: recoveryScore,
        note: recoveryScore < 45 ? 'Fatigued — prioritize recovery' : 'Ready to train',
      },
      streak: getActiveStreakDays(workouts),
      weight: latestWeight,
      bodyFat: latest?.bodyFatPercent ?? null,
      muscleMass: latest?.skeletalMuscleMass ?? null,
      proteinTarget: proteinGoal || 150,
      waterTarget: waterGoal || 3000,
      calorieTarget: calorieGoal || undefined,
      todayDate: today,
      yesterdayTitles: [],
      skippedYesterday: false,
    }
  }, [
    plans,
    workouts,
    reports,
    lastTrained,
    proteinGoal,
    calorieGoal,
    waterGoal,
    goalWeight,
    bodyWeightLog,
  ])
}

export function useTodayDateKey() {
  return useCallback(() => formatDateKey(new Date()), [])
}
