import type { CompletedWorkout } from '@/stores/historyStore'
import type { WorkoutPlan } from '@/stores/planStore'
import type { ActiveSession } from '@/stores/workoutStore'
import type { BodyWeightEntry } from '@/stores/progressStore'
import type { CustomMuscleGroup } from '@/stores/muscleGroupStore'
import type { CatalogExercise } from '@/data/exercises'
import type { MuscleRecoveryMap } from '@/lib/muscle-recovery'

export const SYNC_VERSION = 1 as const

export const SYNC_STORE_KEYS = [
  'plans',
  'history',
  'activeWorkout',
  'progress',
  'recovery',
  'customExercises',
  'muscleGroups',
  'profile',
] as const

export type SyncStoreKey = (typeof SYNC_STORE_KEYS)[number]

export type SyncStoreSlice<T> = {
  data: T
  updatedAt: string
}

export type UserSyncPayload = {
  version: typeof SYNC_VERSION
  stores: {
    plans: SyncStoreSlice<WorkoutPlan[]>
    history: SyncStoreSlice<CompletedWorkout[]>
    activeWorkout: SyncStoreSlice<ActiveSession | null>
    progress: SyncStoreSlice<{
      bodyWeightLog: BodyWeightEntry[]
      goalWeight: number | null
    }>
    recovery: SyncStoreSlice<{
      lastTrained: MuscleRecoveryMap
    }>
    customExercises: SyncStoreSlice<CatalogExercise[]>
    muscleGroups: SyncStoreSlice<CustomMuscleGroup[]>
    profile: SyncStoreSlice<{
      heightCm: number | null
      weightUnit: 'kg' | 'lbs'
      experienceLevel: string | null
    }>
  }
}

export type SyncMeta = {
  userId: string | null
  clientId: string
  storeTimestamps: Partial<Record<SyncStoreKey, string>>
  lastSyncedAt: string | null
}

export const SYNC_META_KEY = 'gymtrack-sync-meta'

const EPOCH = new Date(0).toISOString()

export function emptyLocalPayload(): UserSyncPayload {
  return {
    version: SYNC_VERSION,
    stores: {
      plans: { data: [], updatedAt: EPOCH },
      history: { data: [], updatedAt: EPOCH },
      activeWorkout: { data: null, updatedAt: EPOCH },
      progress: { data: { bodyWeightLog: [], goalWeight: null }, updatedAt: EPOCH },
      recovery: { data: { lastTrained: {} }, updatedAt: EPOCH },
      customExercises: { data: [], updatedAt: EPOCH },
      muscleGroups: { data: [], updatedAt: EPOCH },
      profile: {
        data: { heightCm: null, weightUnit: 'kg', experienceLevel: null },
        updatedAt: EPOCH,
      },
    },
  }
}

export function mergePayloads(
  a: UserSyncPayload | null | undefined,
  b: UserSyncPayload | null | undefined
): UserSyncPayload {
  const base = emptyLocalPayload()
  if (!a && !b) return base
  if (!a) return b!
  if (!b) return a

  const stores: UserSyncPayload['stores'] = { ...base.stores }
  for (const key of SYNC_STORE_KEYS) {
    const left = a.stores[key]
    const right = b.stores[key]
    if (!left) {
      ;(stores as Record<string, typeof right>)[key] = right
    } else if (!right) {
      ;(stores as Record<string, typeof left>)[key] = left
    } else {
      ;(stores as Record<string, typeof left>)[key] =
        new Date(right.updatedAt).getTime() > new Date(left.updatedAt).getTime()
          ? right
          : left
    }
  }

  return { version: SYNC_VERSION, stores }
}
