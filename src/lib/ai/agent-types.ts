import { z } from 'zod'

export type AgentRiskLevel = 'low' | 'medium' | 'high'

export const AGENT_ACTION_NAMES = [
  // Plans
  'create_plan',
  'update_plan',
  'delete_plan',
  'set_active_plan',
  'add_plan_day',
  'update_plan_day',
  'delete_plan_day',
  'add_exercise_to_day',
  'update_plan_exercise',
  'remove_plan_exercise',
  // Workout session
  'start_workout',
  'cancel_workout',
  'finish_workout',
  'add_workout_exercise',
  'remove_workout_exercise',
  'add_set',
  'update_set',
  'complete_set',
  'rename_workout',
  'set_workout_notes',
  // History
  'remove_history_workout',
  'clear_history',
  // Progress
  'add_body_weight',
  'remove_body_weight',
  'set_goal_weight',
  // Custom exercises
  'create_custom_exercise',
  'update_custom_exercise',
  'delete_custom_exercise',
  // Muscle groups
  'create_muscle_group',
  'update_muscle_group',
  'delete_muscle_group',
  // Profile & settings
  'set_profile',
  'set_height',
  'set_weight_unit',
  'set_theme',
  // Rest timer
  'start_rest_timer',
  'stop_rest_timer',
  'set_rest_duration',
  // Meals & water
  'log_meal',
  'update_meal',
  'delete_meal',
  'add_water',
  'remove_water',
  'set_meal_goals',
] as const

export type AgentActionName = (typeof AGENT_ACTION_NAMES)[number]

export type AgentProposalStatus =
  | 'pending'
  | 'executing'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

const nonEmptyString = z.string().trim().min(1).max(500)
const optionalString = z.string().trim().max(500).optional()
const idString = z.string().trim().min(1).max(120)

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const
const ANATOMY_BASE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Legs',
  'Core',
  'Glutes',
  'Full Body',
] as const

type AnatomyBaseGroup = (typeof ANATOMY_BASE_GROUPS)[number]
type Difficulty = (typeof DIFFICULTIES)[number]

function coerceDifficulty(value: unknown): Difficulty {
  if (typeof value !== 'string') return 'intermediate'
  const n = value.toLowerCase().trim()
  if (n.startsWith('begin') || n === 'easy' || n === 'novice') return 'beginner'
  if (n.startsWith('adv') || n === 'hard' || n === 'expert') return 'advanced'
  return 'intermediate'
}

function coerceAnatomyBase(value: unknown, fallback: AnatomyBaseGroup = 'Full Body'): AnatomyBaseGroup {
  if (typeof value !== 'string') return fallback
  const n = value.trim().toLowerCase()
  const match = ANATOMY_BASE_GROUPS.find((g) => g.toLowerCase() === n)
  return match ?? fallback
}

function inferMuscleGroupFromText(text: string): AnatomyBaseGroup {
  const n = text.toLowerCase()
  if (/chest|bench|fly|pec|push.?up|dip/.test(n)) return 'Chest'
  if (/back|row|pull.?up|lat|deadlift|shrug/.test(n)) return 'Back'
  if (/shoulder|delt|overhead|lateral raise|face pull/.test(n)) return 'Shoulders'
  if (/bicep|tricep|curl|arm|forearm/.test(n)) return 'Arms'
  if (/leg|squat|lunge|quad|hamstring|calf|rdl/.test(n)) return 'Legs'
  if (/glute|hip thrust|kickback/.test(n)) return 'Glutes'
  if (/core|ab|plank|crunch|oblique/.test(n)) return 'Core'
  return 'Full Body'
}

function inferEquipment(name: string, explicit: unknown): string {
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim().slice(0, 80)
  const n = name.toLowerCase()
  if (/cable/.test(n)) return 'Cable'
  if (/dumbbell|db\b/.test(n)) return 'Dumbbell'
  if (/barbell|bb\b/.test(n)) return 'Barbell'
  if (/kettle/.test(n)) return 'Kettlebell'
  if (/machine|smith|leg press/.test(n)) return 'Machine'
  if (/band/.test(n)) return 'Resistance Band'
  if (/bodyweight|pull.?up|push.?up|dip|plank/.test(n)) return 'Bodyweight'
  return 'Other'
}

/** Fill / normalize missing fields before schema validation (models often omit enums). */
export function coerceActionParams(
  action: AgentActionName,
  params: unknown
): Record<string, unknown> {
  const raw =
    params && typeof params === 'object' && !Array.isArray(params)
      ? { ...(params as Record<string, unknown>) }
      : {}

  if (action === 'create_custom_exercise') {
    const name = typeof raw.name === 'string' ? raw.name.trim() : ''
    const inferredGroup = inferMuscleGroupFromText(
      [name, typeof raw.muscleGroup === 'string' ? raw.muscleGroup : ''].join(' ')
    )
    if (typeof raw.muscleGroup !== 'string' || !raw.muscleGroup.trim()) {
      raw.muscleGroup = inferredGroup
    }
    raw.equipment = inferEquipment(name, raw.equipment)
    raw.difficulty = coerceDifficulty(raw.difficulty)
    raw.anatomyBaseGroup = coerceAnatomyBase(
      raw.anatomyBaseGroup ?? raw.muscleGroup,
      inferredGroup
    )
    if (!Array.isArray(raw.instructions)) {
      raw.instructions = []
    }
  }

  if (action === 'update_custom_exercise') {
    if (typeof raw.name === 'string') raw.name = raw.name.trim()
    if (typeof raw.muscleGroup === 'string') raw.muscleGroup = raw.muscleGroup.trim()
    if (typeof raw.equipment === 'string') raw.equipment = raw.equipment.trim()
    if (raw.difficulty != null) raw.difficulty = coerceDifficulty(raw.difficulty)
    if (raw.anatomyBaseGroup != null) {
      raw.anatomyBaseGroup = coerceAnatomyBase(raw.anatomyBaseGroup)
    }
    if (raw.instructions != null && !Array.isArray(raw.instructions)) {
      raw.instructions = [String(raw.instructions)]
    }
  }

  if (action === 'create_muscle_group') {
    const name = typeof raw.name === 'string' ? raw.name.trim() : ''
    raw.anatomyBaseGroup = coerceAnatomyBase(
      raw.anatomyBaseGroup,
      inferMuscleGroupFromText(name)
    )
  }

  if (action === 'update_muscle_group' && raw.anatomyBaseGroup != null) {
    raw.anatomyBaseGroup = coerceAnatomyBase(raw.anatomyBaseGroup)
  }

  if (action === 'start_workout') {
    if (typeof raw.name === 'string') raw.name = raw.name.trim()
    else if (raw.name == null) delete raw.name
  }

  if (action === 'log_meal') {
    if (typeof raw.name === 'string') raw.name = raw.name.trim()
    if (typeof raw.type === 'string') {
      const t = raw.type.toLowerCase().trim()
      if (t.startsWith('break')) raw.type = 'breakfast'
      else if (t.startsWith('lun')) raw.type = 'lunch'
      else if (t.startsWith('din')) raw.type = 'dinner'
      else if (t.startsWith('sn')) raw.type = 'snack'
    }
    for (const key of ['calories', 'proteinG', 'carbsG', 'fatG'] as const) {
      if (typeof raw[key] === 'string') {
        const n = Number(raw[key])
        if (Number.isFinite(n)) raw[key] = n
      }
    }
  }

  if (action === 'add_water' && typeof raw.amountMl === 'string') {
    const n = Number(raw.amountMl)
    if (Number.isFinite(n)) raw.amountMl = n
  }

  if (action === 'add_plan_day' || action === 'update_plan_day') {
    if (raw.dayOfWeek !== undefined && raw.dayOfWeek !== null) {
      // Numbers stay; string weekdays / today / tomorrow resolved in prefill with calendar.
      if (typeof raw.dayOfWeek === 'string') {
        const n = Number(raw.dayOfWeek.trim())
        if (Number.isFinite(n) && n >= 1 && n <= 7) raw.dayOfWeek = Math.round(n)
      }
    }
  }

  return raw
}

const actionSchemas: Record<AgentActionName, z.ZodType<Record<string, unknown>>> = {
  create_plan: z.object({
    name: nonEmptyString,
    description: z.string().trim().max(1000).optional(),
    withWeekTemplate: z.boolean().optional(),
  }),
  update_plan: z.object({
    planId: idString,
    name: optionalString,
    description: z.string().trim().max(1000).optional(),
  }),
  delete_plan: z.object({ planId: idString }),
  set_active_plan: z.object({ planId: idString }),
  add_plan_day: z.object({
    planId: idString,
    name: nonEmptyString,
    muscleFocus: z.string().trim().max(200).optional(),
    dayOfWeek: z.number().int().min(1).max(7).nullable().optional(),
  }),
  update_plan_day: z.object({
    planId: idString,
    dayId: idString,
    name: optionalString,
    muscleFocus: z.string().trim().max(200).optional(),
    dayOfWeek: z.number().int().min(1).max(7).nullable().optional(),
  }),
  delete_plan_day: z.object({ planId: idString, dayId: idString }),
  add_exercise_to_day: z.object({
    planId: idString,
    dayId: idString,
    exerciseId: idString,
    targetSets: z.number().int().min(1).max(20).optional(),
    targetReps: z.number().int().min(1).max(100).optional(),
  }),
  update_plan_exercise: z.object({
    planId: idString,
    dayId: idString,
    exerciseRowId: idString,
    targetSets: z.number().int().min(1).max(20).optional(),
    targetReps: z.number().int().min(1).max(100).optional(),
    restSeconds: z.number().int().min(0).max(600).optional(),
    notes: z.string().trim().max(500).optional(),
  }),
  remove_plan_exercise: z.object({
    planId: idString,
    dayId: idString,
    exerciseRowId: idString,
  }),
  start_workout: z.object({
    name: z.string().trim().max(500).optional(),
  }),
  cancel_workout: z.object({}),
  finish_workout: z.object({}),
  add_workout_exercise: z.object({
    exerciseId: idString,
    targetSets: z.number().int().min(1).max(20).optional(),
    targetReps: z.number().int().min(1).max(100).optional(),
    restSeconds: z.number().int().min(0).max(600).optional(),
  }),
  remove_workout_exercise: z.object({ exerciseId: idString }),
  add_set: z.object({ exerciseId: idString }),
  update_set: z.object({
    exerciseId: idString,
    setIndex: z.number().int().min(0).max(50),
    weight: z.string().trim().max(20).optional(),
    reps: z.number().int().min(0).max(200).optional(),
    type: z.enum(['warmup', 'normal', 'dropset', 'failure']).optional(),
  }),
  complete_set: z.object({
    exerciseId: idString,
    setIndex: z.number().int().min(0).max(50),
  }),
  rename_workout: z.object({ name: nonEmptyString }),
  set_workout_notes: z.object({ notes: z.string().trim().max(2000) }),
  remove_history_workout: z.object({ workoutId: idString }),
  clear_history: z.object({}),
  add_body_weight: z.object({
    weight: z.number().min(20).max(500),
    date: z.string().trim().max(40).optional(),
  }),
  remove_body_weight: z.object({ entryId: idString }),
  set_goal_weight: z.object({
    weight: z.number().min(20).max(500).nullable(),
  }),
  create_custom_exercise: z.object({
    name: nonEmptyString,
    muscleGroup: z.string().trim().min(1).max(80).default('Full Body'),
    equipment: z.string().trim().min(1).max(80).default('Other'),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
    instructions: z.array(z.string().trim().max(500)).max(20).optional(),
    anatomyBaseGroup: z
      .enum(['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Glutes', 'Full Body'])
      .optional(),
  }),
  update_custom_exercise: z.object({
    exerciseId: z.string().trim().max(120).optional(),
    name: z.string().trim().max(500).optional(),
    muscleGroup: z.string().trim().max(80).optional(),
    equipment: z.string().trim().max(80).optional(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    instructions: z.array(z.string().trim().max(500)).max(20).optional(),
    anatomyBaseGroup: z
      .enum(['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Glutes', 'Full Body'])
      .optional(),
  }),
  delete_custom_exercise: z.object({
    exerciseId: z.string().trim().max(120).optional(),
    name: z.string().trim().max(500).optional(),
  }),
  create_muscle_group: z.object({
    name: nonEmptyString,
    anatomyBaseGroup: z
      .enum(['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Glutes', 'Full Body'])
      .default('Full Body'),
  }),
  update_muscle_group: z.object({
    groupId: idString,
    name: optionalString,
    anatomyBaseGroup: z
      .enum(['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Glutes', 'Full Body'])
      .optional(),
  }),
  delete_muscle_group: z.object({
    groupId: idString,
    reassignToGroup: nonEmptyString,
  }),
  set_profile: z.object({
    fullName: z.string().trim().max(120).nullable().optional(),
    experienceLevel: z.string().trim().max(80).nullable().optional(),
  }),
  set_height: z.object({
    heightCm: z.number().min(50).max(300).nullable(),
  }),
  set_weight_unit: z.object({ unit: z.enum(['kg', 'lbs']) }),
  set_theme: z.object({ theme: z.enum(['light', 'dark']) }),
  start_rest_timer: z.object({
    durationSeconds: z.number().int().min(5).max(600).optional(),
  }),
  stop_rest_timer: z.object({}),
  set_rest_duration: z.object({
    durationSeconds: z.number().int().min(5).max(600),
  }),
  log_meal: z.object({
    name: nonEmptyString,
    type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
    calories: z.number().min(0).max(10000).optional(),
    proteinG: z.number().min(0).max(1000).optional(),
    carbsG: z.number().min(0).max(1000).optional(),
    fatG: z.number().min(0).max(1000).optional(),
    notes: z.string().trim().max(500).optional(),
    date: z.string().trim().max(40).optional(),
  }),
  update_meal: z.object({
    mealId: idString,
    name: optionalString,
    type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
    calories: z.number().min(0).max(10000).optional(),
    proteinG: z.number().min(0).max(1000).optional(),
    carbsG: z.number().min(0).max(1000).optional(),
    fatG: z.number().min(0).max(1000).optional(),
    notes: z.string().trim().max(500).optional(),
  }),
  delete_meal: z.object({
    mealId: z.string().trim().max(120).optional(),
    name: z.string().trim().max(500).optional(),
  }),
  add_water: z.object({
    amountMl: z.number().int().min(50).max(5000),
    date: z.string().trim().max(40).optional(),
  }),
  remove_water: z.object({
    entryId: idString,
  }),
  set_meal_goals: z.object({
    dailyCalorieGoal: z.number().int().min(500).max(10000).optional(),
    dailyProteinGoal: z.number().int().min(20).max(500).optional(),
    dailyCarbsGoal: z.number().int().min(20).max(1000).optional(),
    dailyFatGoal: z.number().int().min(10).max(500).optional(),
    dailyWaterGoalMl: z.number().int().min(500).max(10000).optional(),
  }),
}

export const MAX_AGENT_ACTIONS = 40

/** Normalize exercise names for duplicate detection. */
export function normalizeExerciseName(name: string) {
  return name
    .toLowerCase()
    .replace(/dumbells?/g, 'dumbbell')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\b(raises?)\b/g, 'raise')
    .replace(/\b(flys?|flies)\b/g, 'fly')
    .replace(/\b(pulls?)\b/g, 'pull')
    .replace(/\b(presses?)\b/g, 'press')
    .replace(/\b(curls?)\b/g, 'curl')
    .replace(/\s+/g, ' ')
    .trim()
}

export function exerciseNamesMatch(a: string, b: string) {
  const left = normalizeExerciseName(a)
  const right = normalizeExerciseName(b)
  if (!left || !right) return false
  // Exact name only — "Incline Barbell Bench Press" ≠ "Bench Press"
  return left === right
}

export function findExistingExerciseName(
  name: string,
  catalog: Array<{ name: string }>,
  custom: Array<{ name: string }>
) {
  const pools = [...custom, ...catalog]
  return pools.find((ex) => exerciseNamesMatch(name, ex.name))?.name ?? null
}

export type AgentAction = {
  action: AgentActionName
  params: Record<string, unknown>
  label: string
  risk: AgentRiskLevel
}

export type AgentProposal = {
  id: string
  summary: string
  actions: AgentAction[]
  status: AgentProposalStatus
  error?: string
}

export type AgentContext = {
  generatedAt: string
  plans: Array<{
    id: string
    name: string
    isActive: boolean
    dayCount: number
    days: Array<{
      id: string
      name: string
      muscleFocus: string
      dayOfWeek: number | null
      exercises: Array<{
        rowId: string
        exerciseId: string
        name: string
        targetSets: number
        targetReps: number
      }>
    }>
  }>
  activeWorkout: {
    id: string
    name: string
    exerciseCount: number
    exercises: Array<{
      exerciseId: string
      name: string
      setCount: number
      completedSets: number
      sets: Array<{
        setIndex: number
        weight: string
        reps: number
        isCompleted: boolean
      }>
    }>
  } | null
  recentHistory: Array<{
    id: string
    name: string
    completedAt: string
    totalSets: number
    volumeKg: number
  }>
  historyIds: string[]
  progress: {
    goalWeight: number | null
    recentBodyWeight: Array<{ id: string; date: string; weight: number }>
  }
  recovery: Array<{
    group: string
    status: string
    progress: number
    muscles?: Array<{ id: string; label: string; status: string; progress: number }>
  }>
  customExercises: Array<{
    id: string
    name: string
    muscleGroup: string
    equipment: string
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    instructions: string[]
  }>
  muscleGroups: Array<{ id: string; name: string; anatomyBaseGroup: string }>
  profile: {
    fullName: string | null
    experienceLevel: string | null
    heightCm: number | null
    weightUnit: 'kg' | 'lbs'
  }
  settings: { theme: 'light' | 'dark' }
  restTimer: {
    isActive: boolean
    secondsRemaining: number
    duration: number
  }
  exerciseCatalog: Array<{
    id: string
    name: string
    muscleGroup: string
    equipment: string
    isCustom?: boolean
    instructions?: string[]
  }>
  meals: {
    today: string
    dailyCalorieGoal: number
    dailyProteinGoal: number
    dailyCarbsGoal: number
    dailyFatGoal: number
    dailyWaterGoalMl: number
    waterTotalMl: number
    todaysMeals: Array<{
      id: string
      type: string
      name: string
      calories: number
      proteinG: number
      carbsG: number
      fatG: number
    }>
    recentWater: Array<{ id: string; amountMl: number }>
    activeMealPlan?: {
      id: string
      name: string
      mealsPerDay: number
      todayDayName: string
      slotCount: number
      plannedItemCount: number
    } | null
  }
}

export type AgentChatResponse =
  | { type: 'text'; content: string }
  | { type: 'proposal'; content: string; proposal: Omit<AgentProposal, 'status'> }

export function parseActionParams(
  action: AgentActionName,
  params: unknown
): { ok: true; params: Record<string, unknown> } | { ok: false; error: string } {
  const schema = actionSchemas[action]
  if (!schema) return { ok: false, error: `Unknown action: ${action}` }
  const coerced = coerceActionParams(action, params)
  const result = schema.safeParse(coerced)
  if (!result.success) {
    return { ok: false, error: result.error.issues.map((i) => i.message).join('; ') }
  }
  return { ok: true, params: result.data as Record<string, unknown> }
}

export function riskForAction(action: AgentActionName): AgentRiskLevel {
  switch (action) {
    case 'delete_plan':
    case 'delete_plan_day':
    case 'remove_plan_exercise':
    case 'cancel_workout':
    case 'remove_workout_exercise':
    case 'remove_history_workout':
    case 'clear_history':
    case 'delete_custom_exercise':
    case 'delete_muscle_group':
    case 'delete_meal':
    case 'remove_water':
      return 'high'
    case 'finish_workout':
    case 'update_plan':
    case 'update_plan_day':
    case 'update_plan_exercise':
    case 'update_custom_exercise':
    case 'update_muscle_group':
    case 'set_profile':
    case 'set_height':
    case 'set_goal_weight':
    case 'add_body_weight':
    case 'remove_body_weight':
    case 'update_meal':
    case 'set_meal_goals':
      return 'medium'
    default:
      return 'low'
  }
}

export function labelForAction(action: AgentActionName, params: Record<string, unknown>): string {
  const p = params as Record<string, string | number | boolean | null | undefined>
  switch (action) {
    case 'create_plan':
      return `Create plan "${p.name}"`
    case 'update_plan':
      return `Update plan ${p.planId}`
    case 'delete_plan':
      return `Delete plan ${p.planId}`
    case 'set_active_plan':
      return `Set active plan ${p.planId}`
    case 'add_plan_day':
      return `Add day "${p.name}" to plan ${p.planId}`
    case 'update_plan_day':
      return `Update day ${p.dayId}`
    case 'delete_plan_day':
      return `Delete day ${p.dayId}`
    case 'add_exercise_to_day':
      return `Add exercise ${p.exerciseId} to day ${p.dayId}`
    case 'update_plan_exercise':
      return `Update exercise row ${p.exerciseRowId}`
    case 'remove_plan_exercise':
      return `Remove exercise row ${p.exerciseRowId}`
    case 'start_workout':
      return `Start workout "${p.name || 'Workout'}"`
    case 'cancel_workout':
      return 'Cancel active workout'
    case 'finish_workout':
      return 'Finish active workout and save to history'
    case 'add_workout_exercise':
      return `Add ${p.exerciseId} to active workout`
    case 'remove_workout_exercise':
      return `Remove ${p.exerciseId} from workout`
    case 'add_set':
      return `Add set to ${p.exerciseId}`
    case 'update_set':
      return `Update set ${p.setIndex} on ${p.exerciseId}`
    case 'complete_set':
      return `Complete set ${p.setIndex} on ${p.exerciseId}`
    case 'rename_workout':
      return `Rename workout to "${p.name}"`
    case 'set_workout_notes':
      return 'Update workout notes'
    case 'remove_history_workout':
      return `Remove history workout ${p.workoutId}`
    case 'clear_history':
      return 'Clear all workout history'
    case 'add_body_weight':
      return `Log body weight ${p.weight} kg`
    case 'remove_body_weight':
      return `Remove body weight entry ${p.entryId}`
    case 'set_goal_weight':
      return p.weight == null ? 'Clear goal weight' : `Set goal weight to ${p.weight} kg`
    case 'create_custom_exercise':
      return `Create exercise "${p.name}"`
    case 'update_custom_exercise':
      return `Update custom exercise ${p.exerciseId}`
    case 'delete_custom_exercise':
      return p.name
        ? `Delete custom exercise "${p.name}"`
        : `Delete custom exercise ${p.exerciseId}`
    case 'create_muscle_group':
      return `Create muscle group "${p.name}"`
    case 'update_muscle_group':
      return `Update muscle group ${p.groupId}`
    case 'delete_muscle_group':
      return `Delete muscle group ${p.groupId} (reassign to ${p.reassignToGroup})`
    case 'set_profile':
      return 'Update profile preferences'
    case 'set_height':
      return p.heightCm == null ? 'Clear height' : `Set height to ${p.heightCm} cm`
    case 'set_weight_unit':
      return `Switch weight unit to ${p.unit}`
    case 'set_theme':
      return `Switch theme to ${p.theme}`
    case 'start_rest_timer':
      return `Start rest timer (${p.durationSeconds ?? 'default'}s)`
    case 'stop_rest_timer':
      return 'Stop rest timer'
    case 'set_rest_duration':
      return `Set default rest duration to ${p.durationSeconds}s`
    case 'log_meal':
      return `Log meal "${p.name}" (${p.calories ?? 0} kcal)`
    case 'update_meal':
      return `Update meal ${p.mealId}`
    case 'delete_meal':
      return p.name ? `Delete meal "${p.name}"` : `Delete meal ${p.mealId}`
    case 'add_water':
      return `Log ${p.amountMl}ml water`
    case 'remove_water':
      return `Remove water entry ${p.entryId}`
    case 'set_meal_goals':
      return 'Update meal / water goals'
    default:
      return action
  }
}
