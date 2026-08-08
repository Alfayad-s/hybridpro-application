import {
  SYNC_STORE_KEYS,
  type SyncMeta,
  type SyncStoreKey,
  type SyncStoreSlice,
  type UserSyncPayload,
  SYNC_VERSION,
  SYNC_META_KEY,
  emptyLocalPayload,
} from '@/lib/sync/types'
import { usePlanStore } from '@/stores/planStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useWorkoutStore } from '@/stores/workoutStore'
import { useProgressStore } from '@/stores/progressStore'
import { useRecoveryStore } from '@/stores/recoveryStore'
import { useExerciseStore } from '@/stores/exerciseStore'
import { useMuscleGroupStore } from '@/stores/muscleGroupStore'
import { useProfileStore } from '@/stores/profileStore'

const EPOCH = new Date(0).toISOString()

function nowIso() {
  return new Date().toISOString()
}

export function getOrCreateClientId(): string {
  const meta = readSyncMeta()
  if (meta.clientId) return meta.clientId
  const clientId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `client-${Date.now()}`
  writeSyncMeta({ ...meta, clientId })
  return clientId
}

export function readSyncMeta(): SyncMeta {
  if (typeof window === 'undefined') {
    return { userId: null, clientId: '', storeTimestamps: {}, lastSyncedAt: null }
  }
  try {
    const raw = localStorage.getItem(SYNC_META_KEY)
    if (!raw) {
      return {
        userId: null,
        clientId: '',
        storeTimestamps: {},
        lastSyncedAt: null,
      }
    }
    return JSON.parse(raw) as SyncMeta
  } catch {
    return { userId: null, clientId: '', storeTimestamps: {}, lastSyncedAt: null }
  }
}

export function writeSyncMeta(meta: SyncMeta) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta))
}

export function touchStoreTimestamp(key: SyncStoreKey) {
  const meta = readSyncMeta()
  meta.storeTimestamps[key] = nowIso()
  writeSyncMeta(meta)
}

function slice<T>(key: SyncStoreKey, data: T): SyncStoreSlice<T> {
  const meta = readSyncMeta()
  return {
    data,
    updatedAt: meta.storeTimestamps[key] ?? EPOCH,
  }
}

export function collectLocalPayload(): UserSyncPayload {
  const plans = usePlanStore.getState().plans
  const workouts = useHistoryStore.getState().workouts
  const activeSession = useWorkoutStore.getState().activeSession
  const { bodyWeightLog, goalWeight } = useProgressStore.getState()
  const { lastTrained } = useRecoveryStore.getState()
  const exercises = useExerciseStore.getState().exercises
  const groups = useMuscleGroupStore.getState().groups
  const { heightCm, weightUnit, experienceLevel } = useProfileStore.getState()

  return {
    version: SYNC_VERSION,
    stores: {
      plans: slice('plans', plans),
      history: slice('history', workouts),
      activeWorkout: slice('activeWorkout', activeSession),
      progress: slice('progress', { bodyWeightLog, goalWeight }),
      recovery: slice('recovery', { lastTrained }),
      customExercises: slice('customExercises', exercises),
      muscleGroups: slice('muscleGroups', groups),
      profile: slice('profile', { heightCm, weightUnit, experienceLevel }),
    },
  }
}

export { emptyLocalPayload }

function isNewerIso(a: string | undefined, b: string | undefined) {
  const aMs = a ? new Date(a).getTime() : 0
  const bMs = b ? new Date(b).getTime() : 0
  return Number.isFinite(aMs) && aMs > (Number.isFinite(bMs) ? bMs : 0)
}

/**
 * Apply a sync payload, but never overwrite a store slice that the user edited
 * more recently locally (e.g. starting a workout while GET/POST sync is in flight).
 */
export function applyPayloadToStores(payload: UserSyncPayload) {
  const meta = readSyncMeta()
  const local = collectLocalPayload()

  const pick = <K extends SyncStoreKey>(key: K): UserSyncPayload['stores'][K] => {
    const incoming = payload.stores[key]
    const current = local.stores[key]
    const localTouched = meta.storeTimestamps[key]
    // Prefer whatever is newest among: explicit local touch, current slice, incoming slice
    if (
      isNewerIso(localTouched, incoming.updatedAt) ||
      isNewerIso(current.updatedAt, incoming.updatedAt)
    ) {
      return current
    }
    return incoming
  }

  const plans = pick('plans')
  const history = pick('history')
  const activeWorkout = pick('activeWorkout')
  const progress = pick('progress')
  const customExercises = pick('customExercises')
  const muscleGroups = pick('muscleGroups')
  const profile = pick('profile')

  usePlanStore.setState({ plans: plans.data })
  // Always keep Mon–Sun placeholders so drag targets survive remote merges
  let ensuredExtraSlots = false
  for (const plan of usePlanStore.getState().plans) {
    const before = plan.days.length
    usePlanStore.getState().ensureWeekdaySlots(plan.id)
    const after = usePlanStore.getState().plans.find((p) => p.id === plan.id)?.days.length ?? before
    if (after > before) ensuredExtraSlots = true
  }
  useHistoryStore.setState({ workouts: history.data })
  useWorkoutStore.setState({ activeSession: activeWorkout.data })
  useProgressStore.setState({
    bodyWeightLog: progress.data.bodyWeightLog,
    goalWeight: progress.data.goalWeight,
  })
  // History is the source of truth for recovery fatigue
  useRecoveryStore.getState().rebuildFromWorkouts(history.data)
  useExerciseStore.setState({
    exercises: customExercises.data,
  })
  useMuscleGroupStore.setState({
    groups: muscleGroups.data,
  })
  useProfileStore.setState({
    heightCm: profile.data.heightCm,
    weightUnit: profile.data.weightUnit,
    experienceLevel: profile.data.experienceLevel,
  })

  meta.storeTimestamps.plans = ensuredExtraSlots ? nowIso() : plans.updatedAt
  meta.storeTimestamps.history = history.updatedAt
  meta.storeTimestamps.activeWorkout = activeWorkout.updatedAt
  meta.storeTimestamps.progress = progress.updatedAt
  meta.storeTimestamps.customExercises = customExercises.updatedAt
  meta.storeTimestamps.muscleGroups = muscleGroups.updatedAt
  meta.storeTimestamps.profile = profile.updatedAt
  // Recovery was rebuilt from history — keep its stamp aligned
  meta.storeTimestamps.recovery = history.updatedAt
  meta.lastSyncedAt = nowIso()
  writeSyncMeta(meta)
}

export function markAllStoresTouched() {
  const ts = nowIso()
  const meta = readSyncMeta()
  for (const key of SYNC_STORE_KEYS) {
    meta.storeTimestamps[key] = ts
  }
  writeSyncMeta(meta)
}

export function setSyncUserId(userId: string | null) {
  const meta = readSyncMeta()
  meta.userId = userId
  writeSyncMeta(meta)
}

export function clearSyncMeta() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SYNC_META_KEY)
}
