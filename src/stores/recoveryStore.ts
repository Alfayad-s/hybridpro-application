'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  buildRecoveryFromWorkouts,
  type MuscleRecoveryMap,
  type RecoveryMuscleId,
} from '@/lib/muscle-recovery'
import type { CompletedWorkout } from '@/stores/historyStore'

export type MuscleTrainingRecord = {
  date: string
  volumeKg: number
}

type RecoveryState = {
  /** Fine-grained last-trained map keyed by RecoveryMuscleId (and legacy group keys). */
  lastTrained: MuscleRecoveryMap
  recordSession: (
    muscles: { muscle: RecoveryMuscleId; volumeKg: number }[],
    date?: string
  ) => void
  /** Rebuild recovery map from workout history (clears fatigue when history is empty). */
  rebuildFromWorkouts: (workouts: CompletedWorkout[]) => void
  reset: () => void
}

export const useRecoveryStore = create<RecoveryState>()(
  persist(
    (set) => ({
      lastTrained: {},

      recordSession: (muscles, date) =>
        set((state) => {
          if (muscles.length === 0) return {}
          const when = date ?? new Date().toISOString()
          const next = { ...state.lastTrained }
          for (const { muscle, volumeKg } of muscles) {
            next[muscle] = { date: when, volumeKg }
          }
          return { lastTrained: next }
        }),

      rebuildFromWorkouts: (workouts) =>
        set({ lastTrained: buildRecoveryFromWorkouts(workouts) }),

      reset: () => set({ lastTrained: {} }),
    }),
    {
      name: 'gymtrack-recovery',
      version: 2,
      migrate: () => ({ lastTrained: {} }),
    }
  )
)
