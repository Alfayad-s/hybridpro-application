import { WORKOUT_MUSCLES } from '@/components/muscle-map'
import { getExerciseById } from '@/data/exercises'
import { getCustomExercisesSnapshot } from '@/stores/exerciseStore'

export type RecoveryGroup = 'Chest' | 'Back' | 'Legs' | 'Shoulders' | 'Arms' | 'Core'

export const RECOVERY_GROUPS: RecoveryGroup[] = [
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Arms',
  'Core',
]

/** Fine-grained recovery units shown under each group. */
export type RecoveryMuscleId =
  | 'upper-chest'
  | 'chest'
  | 'lower-chest'
  | 'serratus'
  | 'upper-back'
  | 'lower-back'
  | 'trapezius'
  | 'rhomboids'
  | 'quadriceps'
  | 'hamstring'
  | 'gluteal'
  | 'calves'
  | 'adductors'
  | 'hip-flexors'
  | 'front-deltoid'
  | 'deltoids'
  | 'rear-deltoid'
  | 'biceps'
  | 'triceps'
  | 'forearm'
  | 'abs'
  | 'obliques'

export type RecoveryMuscleDef = {
  id: RecoveryMuscleId
  label: string
  /** Recovery window in hours. */
  hours: number
  /** Anatomy / MuscleMap slugs that map to this unit. */
  mapSlugs: readonly string[]
}

/** Detail muscles per parent group (user-facing recovery breakdown). */
export const GROUP_MUSCLES: Record<RecoveryGroup, readonly RecoveryMuscleDef[]> = {
  Chest: [
    { id: 'upper-chest', label: 'Upper Chest', hours: 48, mapSlugs: ['upper-chest'] },
    { id: 'chest', label: 'Mid Chest', hours: 48, mapSlugs: ['chest'] },
    { id: 'lower-chest', label: 'Lower Chest', hours: 48, mapSlugs: ['lower-chest'] },
    { id: 'serratus', label: 'Serratus', hours: 36, mapSlugs: ['serratus'] },
  ],
  Back: [
    { id: 'upper-back', label: 'Lats / Upper Back', hours: 48, mapSlugs: ['upper-back'] },
    { id: 'lower-back', label: 'Lower Back', hours: 48, mapSlugs: ['lower-back'] },
    {
      id: 'trapezius',
      label: 'Traps',
      hours: 48,
      mapSlugs: ['trapezius', 'upper-trapezius', 'lower-trapezius'],
    },
    { id: 'rhomboids', label: 'Rhomboids', hours: 48, mapSlugs: ['rhomboids'] },
  ],
  Legs: [
    {
      id: 'quadriceps',
      label: 'Quads',
      hours: 72,
      mapSlugs: ['quadriceps', 'inner-quad', 'outer-quad'],
    },
    { id: 'hamstring', label: 'Hamstrings', hours: 72, mapSlugs: ['hamstring'] },
    { id: 'gluteal', label: 'Glutes', hours: 72, mapSlugs: ['gluteal'] },
    { id: 'calves', label: 'Calves', hours: 36, mapSlugs: ['calves'] },
    { id: 'adductors', label: 'Adductors', hours: 48, mapSlugs: ['adductors'] },
    { id: 'hip-flexors', label: 'Hip Flexors', hours: 48, mapSlugs: ['hip-flexors'] },
  ],
  Shoulders: [
    { id: 'front-deltoid', label: 'Front Delts', hours: 48, mapSlugs: ['front-deltoid'] },
    { id: 'deltoids', label: 'Side Delts', hours: 48, mapSlugs: ['deltoids'] },
    { id: 'rear-deltoid', label: 'Rear Delts', hours: 48, mapSlugs: ['rear-deltoid'] },
  ],
  Arms: [
    { id: 'biceps', label: 'Biceps', hours: 36, mapSlugs: ['biceps'] },
    { id: 'triceps', label: 'Triceps', hours: 36, mapSlugs: ['triceps'] },
    { id: 'forearm', label: 'Forearms', hours: 24, mapSlugs: ['forearm'] },
  ],
  Core: [
    {
      id: 'abs',
      label: 'Abs',
      hours: 24,
      mapSlugs: ['abs', 'upper-abs', 'lower-abs'],
    },
    { id: 'obliques', label: 'Obliques', hours: 24, mapSlugs: ['obliques'] },
  ],
}

export const ALL_RECOVERY_MUSCLES: RecoveryMuscleDef[] = RECOVERY_GROUPS.flatMap(
  (group) => [...GROUP_MUSCLES[group]]
)

const MUSCLE_BY_ID = Object.fromEntries(
  ALL_RECOVERY_MUSCLES.map((m) => [m.id, m])
) as Record<RecoveryMuscleId, RecoveryMuscleDef>

/** Anatomy slug → recovery muscle id. */
const SLUG_TO_MUSCLE: Record<string, RecoveryMuscleId> = {}
for (const def of ALL_RECOVERY_MUSCLES) {
  for (const slug of def.mapSlugs) {
    SLUG_TO_MUSCLE[slug] = def.id
  }
}

/** Approximate recovery window per muscle group (rollup), in hours. */
export const RECOVERY_HOURS: Record<RecoveryGroup, number> = {
  Chest: 48,
  Back: 48,
  Legs: 72,
  Shoulders: 48,
  Arms: 36,
  Core: 24,
}

/** Maps a recovery group to the anatomy slugs used by the MuscleMap. */
export const GROUP_TO_MAP: Record<RecoveryGroup, readonly string[]> = {
  Chest: WORKOUT_MUSCLES.chest,
  Back: WORKOUT_MUSCLES.back,
  Legs: WORKOUT_MUSCLES.legs,
  Shoulders: WORKOUT_MUSCLES.shoulders,
  Arms: WORKOUT_MUSCLES.arms,
  Core: WORKOUT_MUSCLES.abs,
}

export type RecoveryStatus = 'Fatigued' | 'Recovering' | 'Ready'

export const STATUS_COLOR: Record<RecoveryStatus, string> = {
  Fatigued: 'var(--destructive)',
  Recovering: 'var(--warning)',
  Ready: 'var(--primary)',
}

export type MuscleTrainingSnapshot = {
  date: string
  volumeKg: number
}

export type MuscleRecoveryMap = Partial<Record<RecoveryMuscleId, MuscleTrainingSnapshot>>

/** Maps a catalog muscle group to one or more recovery groups. */
export function catalogGroupToRecovery(group: string | undefined): RecoveryGroup[] {
  switch ((group ?? '').toLowerCase()) {
    case 'chest':
      return ['Chest']
    case 'back':
      return ['Back']
    case 'shoulders':
      return ['Shoulders']
    case 'arms':
      return ['Arms']
    case 'legs':
    case 'glutes':
      return ['Legs']
    case 'core':
      return ['Core']
    case 'full body':
      return ['Back', 'Legs', 'Core']
    default:
      return []
  }
}

export function getMuscleDef(id: RecoveryMuscleId): RecoveryMuscleDef {
  return MUSCLE_BY_ID[id]
}

export function muscleIdFromSlug(slug: string): RecoveryMuscleId | null {
  return SLUG_TO_MUSCLE[slug] ?? null
}

export function groupForMuscle(id: RecoveryMuscleId): RecoveryGroup | null {
  for (const group of RECOVERY_GROUPS) {
    if (GROUP_MUSCLES[group].some((m) => m.id === id)) return group
  }
  return null
}

export function muscleSlugToGroup(slug: string): RecoveryGroup | null {
  const muscle = muscleIdFromSlug(slug)
  if (muscle) return groupForMuscle(muscle)
  for (const group of RECOVERY_GROUPS) {
    if ((GROUP_TO_MAP[group] as readonly string[]).includes(slug)) return group
  }
  return null
}

function resolveMuscleIdsFromSlugs(slugs: readonly string[]): RecoveryMuscleId[] {
  const seen = new Set<RecoveryMuscleId>()
  const out: RecoveryMuscleId[] = []
  for (const slug of slugs) {
    const id = SLUG_TO_MUSCLE[slug]
    if (id && !seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  return out
}

/**
 * Resolves fine-grained recovery muscles for a logged exercise.
 * Prefers catalog anatomy (primary + secondary); falls back to whole group.
 */
export function recoveryMusclesForExercise(
  exerciseId: string,
  fallbackCategory?: string
): RecoveryMuscleId[] {
  const catalog = getExerciseById(exerciseId, getCustomExercisesSnapshot())
  if (catalog) {
    const fromAnatomy = resolveMuscleIdsFromSlugs([
      ...catalog.anatomy.primary,
      ...catalog.anatomy.secondary,
    ])
    if (fromAnatomy.length > 0) return fromAnatomy
  }

  const groups = catalogGroupToRecovery(catalog?.muscleGroup ?? fallbackCategory)
  const seen = new Set<RecoveryMuscleId>()
  const out: RecoveryMuscleId[] = []
  for (const group of groups) {
    for (const muscle of GROUP_MUSCLES[group]) {
      if (!seen.has(muscle.id)) {
        seen.add(muscle.id)
        out.push(muscle.id)
      }
    }
  }
  return out
}

/** @deprecated Prefer recoveryMusclesForExercise — kept for call-site migration. */
export function recoveryGroupsForExercise(
  exerciseId: string,
  fallbackCategory?: string
): RecoveryGroup[] {
  const muscles = recoveryMusclesForExercise(exerciseId, fallbackCategory)
  const groups = new Set<RecoveryGroup>()
  for (const id of muscles) {
    const group = groupForMuscle(id)
    if (group) groups.add(group)
  }
  if (groups.size > 0) return [...groups]
  return catalogGroupToRecovery(fallbackCategory)
}

export type MuscleRecovery = {
  id: RecoveryMuscleId
  group: RecoveryGroup
  label: string
  status: RecoveryStatus
  /** 0 (just trained) → 1 (fully recovered). */
  recoveredPct: number
  lastTrained: string | null
  readyAt: Date | null
  hoursRemaining: number
  recoveryHours: number
  labelStatus: string
  volumeKg: number
}

export type GroupRecovery = {
  group: RecoveryGroup
  status: RecoveryStatus
  /** 0 (just trained) → 1 (fully recovered). Rollup = most fatigued child. */
  recoveredPct: number
  lastTrained: string | null
  readyAt: Date | null
  hoursRemaining: number
  label: string
  muscles: MuscleRecovery[]
}

function formatRemaining(hours: number): string {
  if (hours <= 0) return 'Ready now'
  const totalMinutes = Math.round(hours * 60)
  const days = Math.floor(totalMinutes / (60 * 24))
  const h = Math.floor((totalMinutes % (60 * 24)) / 60)
  if (days > 0) return `Ready in ${days}d ${h}h`
  if (h > 0) {
    const m = totalMinutes % 60
    return m > 0 && h < 3 ? `Ready in ${h}h ${m}m` : `Ready in ${h}h`
  }
  return `Ready in ${totalMinutes % 60}m`
}

function statusFromPct(recoveredPct: number): RecoveryStatus {
  if (recoveredPct >= 1) return 'Ready'
  if (recoveredPct < 0.34) return 'Fatigued'
  return 'Recovering'
}

export function getMuscleRecovery(
  id: RecoveryMuscleId,
  lastTrained: string | null,
  volumeKg = 0,
  now: number = Date.now()
): MuscleRecovery {
  const def = MUSCLE_BY_ID[id]
  const group = groupForMuscle(id) ?? 'Arms'

  if (!lastTrained) {
    return {
      id,
      group,
      label: def.label,
      status: 'Ready',
      recoveredPct: 1,
      lastTrained: null,
      readyAt: null,
      hoursRemaining: 0,
      recoveryHours: def.hours,
      labelStatus: 'Rested',
      volumeKg,
    }
  }

  const elapsedHours = (now - new Date(lastTrained).getTime()) / (1000 * 60 * 60)
  const recoveredPct = Math.max(0, Math.min(1, elapsedHours / def.hours))
  const hoursRemaining = Math.max(0, def.hours - elapsedHours)
  const readyAt = new Date(new Date(lastTrained).getTime() + def.hours * 3600 * 1000)
  const status = statusFromPct(recoveredPct)

  return {
    id,
    group,
    label: def.label,
    status,
    recoveredPct,
    lastTrained,
    readyAt,
    hoursRemaining,
    recoveryHours: def.hours,
    labelStatus: status === 'Ready' ? 'Ready to train' : formatRemaining(hoursRemaining),
    volumeKg,
  }
}

export function getGroupRecovery(
  group: RecoveryGroup,
  lastTrainedMap: MuscleRecoveryMap | Partial<Record<string, MuscleTrainingSnapshot>>,
  now: number = Date.now()
): GroupRecovery {
  const muscles = GROUP_MUSCLES[group].map((def) => {
    const record = lastTrainedMap[def.id]
    return getMuscleRecovery(def.id, record?.date ?? null, record?.volumeKg ?? 0, now)
  })

  // Legacy group-key fallback (pre detail migration) until history rebuilds.
  const legacy = lastTrainedMap[group as unknown as RecoveryMuscleId]
  if (legacy?.date && muscles.every((m) => !m.lastTrained)) {
    const legacyMuscle = getMuscleRecovery(
      GROUP_MUSCLES[group][0].id,
      legacy.date,
      legacy.volumeKg,
      now
    )
    const recoveredPct = legacyMuscle.recoveredPct
    const status = statusFromPct(recoveredPct)
    return {
      group,
      status,
      recoveredPct,
      lastTrained: legacy.date,
      readyAt: legacyMuscle.readyAt,
      hoursRemaining: legacyMuscle.hoursRemaining,
      label: status === 'Ready' ? 'Ready to train' : formatRemaining(legacyMuscle.hoursRemaining),
      muscles: GROUP_MUSCLES[group].map((def) =>
        getMuscleRecovery(def.id, legacy.date, legacy.volumeKg, now)
      ),
    }
  }

  const trained = muscles.filter((m) => m.lastTrained)
  if (trained.length === 0) {
    return {
      group,
      status: 'Ready',
      recoveredPct: 1,
      lastTrained: null,
      readyAt: null,
      hoursRemaining: 0,
      label: 'Rested',
      muscles,
    }
  }

  // Group status follows the most fatigued child.
  const recoveredPct = Math.min(...muscles.map((m) => m.recoveredPct))
  const status = statusFromPct(recoveredPct)
  const mostRecent = trained.reduce((a, b) =>
    new Date(a.lastTrained!).getTime() >= new Date(b.lastTrained!).getTime() ? a : b
  )
  const hoursRemaining = Math.max(...muscles.map((m) => m.hoursRemaining))
  const readyAt =
    hoursRemaining > 0
      ? new Date(now + hoursRemaining * 3600 * 1000)
      : mostRecent.readyAt

  return {
    group,
    status,
    recoveredPct,
    lastTrained: mostRecent.lastTrained,
    readyAt,
    hoursRemaining,
    label: status === 'Ready' ? 'Ready to train' : formatRemaining(hoursRemaining),
    muscles,
  }
}

/**
 * Rebuilds last-trained recovery state from workout history at muscle detail grain.
 */
export function buildRecoveryFromWorkouts(
  workouts: {
    completedAt: string
    exercises: { exerciseId: string; name: string; volumeKg: number }[]
  }[]
): MuscleRecoveryMap {
  const result: MuscleRecoveryMap = {}
  if (workouts.length === 0) return result

  const sorted = [...workouts].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  )

  for (const workout of sorted) {
    const volumeByMuscle = new Map<RecoveryMuscleId, number>()
    for (const ex of workout.exercises) {
      const muscles = recoveryMusclesForExercise(ex.exerciseId, ex.name)
      for (const muscle of muscles) {
        volumeByMuscle.set(muscle, (volumeByMuscle.get(muscle) ?? 0) + ex.volumeKg)
      }
    }
    for (const [muscle, volumeKg] of volumeByMuscle) {
      if (!result[muscle]) {
        result[muscle] = { date: workout.completedAt, volumeKg }
      }
    }
  }

  return result
}
