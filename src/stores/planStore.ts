'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { WEEKDAY_LABELS } from '@/data/exercises'

export type PlanExercise = {
  id: string
  exerciseId: string
  name: string
  category: string
  equipment: string
  primaryMuscle: string
  secondaryMuscles: string[]
  targetSets: number
  targetReps: number
  restSeconds: number
  order: number
  notes?: string
}

export type PlanDay = {
  id: string
  name: string
  muscleFocus: string
  dayOfWeek: number | null // 1–7 Mon–Sun
  order: number
  exercises: PlanExercise[]
  /** Explicit rest day (typically 0 exercises). */
  isRestDay?: boolean
}

export type WorkoutPlan = {
  id: string
  name: string
  description: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  days: PlanDay[]
}

type CreatePlanInput = {
  name: string
  description?: string
  withWeekTemplate?: boolean
}

type AddDayInput = {
  planId: string
  name: string
  muscleFocus?: string
  dayOfWeek?: number | null
}

type AddExerciseInput = {
  planId: string
  dayId: string
  exerciseId: string
  name: string
  category: string
  equipment: string
  primaryMuscle: string
  secondaryMuscles?: string[]
  targetSets?: number
  targetReps?: number
}

type PlanState = {
  plans: WorkoutPlan[]
  createPlan: (input: CreatePlanInput) => string
  updatePlan: (planId: string, fields: Partial<Pick<WorkoutPlan, 'name' | 'description'>>) => void
  deletePlan: (planId: string) => void
  setActivePlan: (planId: string) => void
  addDay: (input: AddDayInput) => string
  updateDay: (
    planId: string,
    dayId: string,
    fields: Partial<Pick<PlanDay, 'name' | 'muscleFocus' | 'dayOfWeek' | 'isRestDay'>>
  ) => void
  deleteDay: (planId: string, dayId: string) => void
  /** Ensure Mon–Sun slots exist as empty placeholders when missing. */
  ensureWeekdaySlots: (planId: string) => void
  /**
   * Move/swap workout content between two days.
   * Weekday identity (dayOfWeek + Monday…Sunday name) stays on each slot.
   */
  swapDayWorkouts: (planId: string, fromDayId: string, toDayId: string) => void
  /** Clear a weekday slot back to empty placeholder, or delete a custom day. */
  clearOrRemoveDay: (planId: string, dayId: string) => void
  reorderDays: (planId: string, dayIds: string[]) => void
  addExerciseToDay: (input: AddExerciseInput) => string
  updateDayExercise: (
    planId: string,
    dayId: string,
    exerciseRowId: string,
    fields: Partial<Pick<PlanExercise, 'targetSets' | 'targetReps' | 'restSeconds' | 'notes'>>
  ) => void
  removeDayExercise: (planId: string, dayId: string, exerciseRowId: string) => void
  reorderDayExercises: (planId: string, dayId: string, exerciseRowIds: string[]) => void
  /** Replace target days' exercises with a deep copy of the source day's workout. */
  repeatDayToDays: (planId: string, sourceDayId: string, targetDayIds: string[]) => void
  getActivePlan: () => WorkoutPlan | null
  getPlan: (planId: string) => WorkoutPlan | undefined
  getDay: (planId: string, dayId: string) => PlanDay | undefined
  getTodayDay: () => { plan: WorkoutPlan; day: PlanDay } | null
}

function uid() {
  return crypto.randomUUID()
}

function nowIso() {
  return new Date().toISOString()
}

function seedChestDay(): PlanDay {
  return {
    id: 'seed-day-push',
    name: 'Monday',
    muscleFocus: 'Chest + Triceps',
    dayOfWeek: 1,
    order: 0,
    exercises: [
      {
        id: 'seed-ex-push-1',
        exerciseId: 'bench-press',
        name: 'Bench Press',
        category: 'Chest',
        equipment: 'Barbell',
        primaryMuscle: 'chest',
        secondaryMuscles: ['triceps', 'shoulders'],
        targetSets: 4,
        targetReps: 10,
        restSeconds: 120,
        order: 0,
      },
      {
        id: 'seed-ex-push-2',
        exerciseId: 'incline-press',
        name: 'Incline Press',
        category: 'Chest',
        equipment: 'Barbell',
        primaryMuscle: 'chest',
        secondaryMuscles: ['shoulders', 'triceps'],
        targetSets: 4,
        targetReps: 10,
        restSeconds: 90,
        order: 1,
      },
      {
        id: 'seed-ex-push-3',
        exerciseId: 'cable-fly',
        name: 'Cable Fly',
        category: 'Chest',
        equipment: 'Cable',
        primaryMuscle: 'chest',
        secondaryMuscles: [],
        targetSets: 3,
        targetReps: 12,
        restSeconds: 60,
        order: 2,
      },
    ],
  }
}

const defaultPlans: WorkoutPlan[] = [
  {
    id: 'seed-ppl',
    name: 'Push / Pull / Legs',
    description: 'Classic 3-day split starter template',
    isActive: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    days: [
      seedChestDay(),
      {
        id: 'seed-day-pull',
        name: 'Wednesday',
        muscleFocus: 'Back + Biceps',
        dayOfWeek: 3,
        order: 1,
        exercises: [
          {
            id: 'seed-ex-pull-1',
            exerciseId: 'pullups',
            name: 'Pull-Ups',
            category: 'Back',
            equipment: 'Bodyweight',
            primaryMuscle: 'back',
            secondaryMuscles: ['biceps'],
            targetSets: 4,
            targetReps: 8,
            restSeconds: 120,
            order: 0,
          },
          {
            id: 'seed-ex-pull-2',
            exerciseId: 'barbell-row',
            name: 'Barbell Row',
            category: 'Back',
            equipment: 'Barbell',
            primaryMuscle: 'back',
            secondaryMuscles: ['biceps'],
            targetSets: 4,
            targetReps: 10,
            restSeconds: 90,
            order: 1,
          },
          {
            id: 'seed-ex-pull-3',
            exerciseId: 'bicep-curls',
            name: 'Dumbbell Bicep Curl',
            category: 'Arms',
            equipment: 'Dumbbells',
            primaryMuscle: 'biceps',
            secondaryMuscles: [],
            targetSets: 3,
            targetReps: 12,
            restSeconds: 60,
            order: 2,
          },
        ],
      },
      {
        id: 'seed-day-legs',
        name: 'Friday',
        muscleFocus: 'Legs + Abs',
        dayOfWeek: 5,
        order: 2,
        exercises: [
          {
            id: 'seed-ex-legs-1',
            exerciseId: 'squats',
            name: 'Barbell Squat',
            category: 'Legs',
            equipment: 'Barbell',
            primaryMuscle: 'legs',
            secondaryMuscles: ['glutes'],
            targetSets: 4,
            targetReps: 8,
            restSeconds: 150,
            order: 0,
          },
          {
            id: 'seed-ex-legs-2',
            exerciseId: 'romanian-deadlift',
            name: 'Romanian Deadlift',
            category: 'Legs',
            equipment: 'Barbell',
            primaryMuscle: 'legs',
            secondaryMuscles: ['glutes', 'back'],
            targetSets: 3,
            targetReps: 10,
            restSeconds: 120,
            order: 1,
          },
          {
            id: 'seed-ex-legs-3',
            exerciseId: 'hanging-leg-raise',
            name: 'Hanging Leg Raise',
            category: 'Abs',
            equipment: 'Bodyweight',
            primaryMuscle: 'abs',
            secondaryMuscles: [],
            targetSets: 3,
            targetReps: 12,
            restSeconds: 60,
            order: 2,
          },
        ],
      },
    ],
  },
]

function mapPlan(
  plans: WorkoutPlan[],
  planId: string,
  updater: (plan: WorkoutPlan) => WorkoutPlan
): WorkoutPlan[] {
  return plans.map((p) => (p.id === planId ? { ...updater(p), updatedAt: nowIso() } : p))
}

function emptyWeekdaySlot(dayOfWeek: number, order: number): PlanDay {
  return {
    id: uid(),
    name: WEEKDAY_LABELS[dayOfWeek - 1],
    muscleFocus: '',
    dayOfWeek,
    order,
    exercises: [],
    isRestDay: false,
  }
}

/** Keep Mon–Sun labels on weekday slots; swap only the workout payload. */
function workoutPayload(day: PlanDay) {
  return {
    muscleFocus: day.muscleFocus,
    exercises: day.exercises.map((ex) => ({
      ...ex,
      secondaryMuscles: [...(ex.secondaryMuscles ?? [])],
    })),
    isRestDay: Boolean(day.isRestDay),
  }
}

function withWeekdayIdentity(day: PlanDay, payload: ReturnType<typeof workoutPayload>): PlanDay {
  const name =
    day.dayOfWeek != null
      ? WEEKDAY_LABELS[day.dayOfWeek - 1]
      : payload.isRestDay
        ? 'Rest Day'
        : day.name
  return {
    ...day,
    name,
    muscleFocus: payload.isRestDay && day.dayOfWeek != null ? 'Rest' : payload.muscleFocus,
    exercises: payload.exercises,
    isRestDay: payload.isRestDay,
  }
}

function sortPlanDays(days: PlanDay[]): PlanDay[] {
  const weekdays = days
    .filter((d) => d.dayOfWeek != null)
    .sort((a, b) => (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0))
  const customs = days
    .filter((d) => d.dayOfWeek == null)
    .sort((a, b) => a.order - b.order)
  return [...weekdays, ...customs].map((d, i) => ({ ...d, order: i }))
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      plans: defaultPlans,

      createPlan: ({ name, description = '', withWeekTemplate = false }) => {
        const id = uid()
        const days: PlanDay[] = withWeekTemplate
          ? WEEKDAY_LABELS.map((label, i) => ({
              id: uid(),
              name: label,
              muscleFocus: '',
              dayOfWeek: i + 1,
              order: i,
              exercises: [],
            }))
          : []

        const plan: WorkoutPlan = {
          id,
          name: name.trim() || 'Untitled Plan',
          description: description.trim(),
          isActive: get().plans.length === 0,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          days,
        }

        set((state) => ({
          plans: plan.isActive
            ? [...state.plans.map((p) => ({ ...p, isActive: false })), plan]
            : [...state.plans, plan],
        }))

        return id
      },

      updatePlan: (planId, fields) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (p) => ({ ...p, ...fields })),
        })),

      deletePlan: (planId) =>
        set((state) => {
          const remaining = state.plans.filter((p) => p.id !== planId)
          if (remaining.length && !remaining.some((p) => p.isActive)) {
            remaining[0] = { ...remaining[0], isActive: true }
          }
          return { plans: remaining }
        }),

      setActivePlan: (planId) =>
        set((state) => ({
          plans: state.plans.map((p) => ({
            ...p,
            isActive: p.id === planId,
            updatedAt: p.id === planId ? nowIso() : p.updatedAt,
          })),
        })),

      addDay: ({ planId, name, muscleFocus = '', dayOfWeek = null }) => {
        const dayId = uid()
        set((state) => ({
          plans: mapPlan(state.plans, planId, (plan) => ({
            ...plan,
            days: [
              ...plan.days,
              {
                id: dayId,
                name: name.trim() || `Day ${plan.days.length + 1}`,
                muscleFocus: muscleFocus.trim(),
                dayOfWeek,
                order: plan.days.length,
                exercises: [],
              },
            ],
          })),
        }))
        return dayId
      },

      updateDay: (planId, dayId, fields) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (plan) => ({
            ...plan,
            days: plan.days.map((d) => (d.id === dayId ? { ...d, ...fields } : d)),
          })),
        })),

      deleteDay: (planId, dayId) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (plan) => ({
            ...plan,
            days: sortPlanDays(plan.days.filter((d) => d.id !== dayId)),
          })),
        })),

      ensureWeekdaySlots: (planId) =>
        set((state) => {
          const plan = state.plans.find((p) => p.id === planId)
          if (!plan) return {}

          const have = new Set(
            plan.days
              .map((d) => d.dayOfWeek)
              .filter((d): d is number => typeof d === 'number' && d >= 1 && d <= 7)
          )
          const missing: PlanDay[] = []
          for (let dow = 1; dow <= 7; dow++) {
            if (!have.has(dow)) missing.push(emptyWeekdaySlot(dow, dow - 1))
          }

          const withNames = plan.days.map((d) =>
            d.dayOfWeek != null
              ? {
                  ...d,
                  name: WEEKDAY_LABELS[d.dayOfWeek - 1],
                }
              : d
          )
          const sorted = sortPlanDays([...withNames, ...missing])
          const unchanged =
            missing.length === 0 &&
            sorted.length === plan.days.length &&
            sorted.every(
              (d, i) =>
                d.id === plan.days[i]?.id &&
                d.order === plan.days[i]?.order &&
                d.name === plan.days[i]?.name
            )
          if (unchanged) return {}

          return {
            plans: state.plans.map((p) =>
              p.id === planId ? { ...p, days: sorted, updatedAt: nowIso() } : p
            ),
          }
        }),

      swapDayWorkouts: (planId, fromDayId, toDayId) => {
        if (fromDayId === toDayId) return
        set((state) => ({
          plans: mapPlan(state.plans, planId, (plan) => {
            const from = plan.days.find((d) => d.id === fromDayId)
            const to = plan.days.find((d) => d.id === toDayId)
            if (!from || !to) return plan
            const fromPayload = workoutPayload(from)
            const toPayload = workoutPayload(to)
            return {
              ...plan,
              days: sortPlanDays(
                plan.days.map((d) => {
                  if (d.id === fromDayId) return withWeekdayIdentity(d, toPayload)
                  if (d.id === toDayId) return withWeekdayIdentity(d, fromPayload)
                  return d
                })
              ),
            }
          }),
        }))
      },

      clearOrRemoveDay: (planId, dayId) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (plan) => {
            const day = plan.days.find((d) => d.id === dayId)
            if (!day) return plan
            if (day.dayOfWeek != null) {
              return {
                ...plan,
                days: sortPlanDays(
                  plan.days.map((d) =>
                    d.id === dayId
                      ? {
                          ...d,
                          name: WEEKDAY_LABELS[d.dayOfWeek! - 1],
                          muscleFocus: '',
                          exercises: [],
                          isRestDay: false,
                        }
                      : d
                  )
                ),
              }
            }
            return {
              ...plan,
              days: sortPlanDays(plan.days.filter((d) => d.id !== dayId)),
            }
          }),
        })),

      reorderDays: (planId, dayIds) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (plan) => {
            const byId = Object.fromEntries(plan.days.map((d) => [d.id, d]))
            return {
              ...plan,
              days: dayIds
                .map((id, order) => (byId[id] ? { ...byId[id], order } : null))
                .filter(Boolean) as PlanDay[],
            }
          }),
        })),

      addExerciseToDay: (input) => {
        const rowId = uid()
        set((state) => ({
          plans: mapPlan(state.plans, input.planId, (plan) => ({
            ...plan,
            days: plan.days.map((day) => {
              if (day.id !== input.dayId) return day
              if (day.exercises.some((e) => e.exerciseId === input.exerciseId)) return day
              return {
                ...day,
                isRestDay: false,
                exercises: [
                  ...day.exercises,
                  {
                    id: rowId,
                    exerciseId: input.exerciseId,
                    name: input.name,
                    category: input.category,
                    equipment: input.equipment,
                    primaryMuscle: input.primaryMuscle,
                    secondaryMuscles: input.secondaryMuscles ?? [],
                    targetSets: input.targetSets ?? 3,
                    targetReps: input.targetReps ?? 10,
                    restSeconds: 90,
                    order: day.exercises.length,
                  },
                ],
              }
            }),
          })),
        }))
        return rowId
      },

      updateDayExercise: (planId, dayId, exerciseRowId, fields) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (plan) => ({
            ...plan,
            days: plan.days.map((day) =>
              day.id !== dayId
                ? day
                : {
                    ...day,
                    exercises: day.exercises.map((ex) =>
                      ex.id === exerciseRowId ? { ...ex, ...fields } : ex
                    ),
                  }
            ),
          })),
        })),

      removeDayExercise: (planId, dayId, exerciseRowId) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (plan) => ({
            ...plan,
            days: plan.days.map((day) =>
              day.id !== dayId
                ? day
                : {
                    ...day,
                    exercises: day.exercises
                      .filter((ex) => ex.id !== exerciseRowId)
                      .map((ex, i) => ({ ...ex, order: i })),
                  }
            ),
          })),
        })),

      reorderDayExercises: (planId, dayId, exerciseRowIds) =>
        set((state) => ({
          plans: mapPlan(state.plans, planId, (plan) => ({
            ...plan,
            days: plan.days.map((day) => {
              if (day.id !== dayId) return day
              const byId = Object.fromEntries(day.exercises.map((ex) => [ex.id, ex]))
              return {
                ...day,
                exercises: exerciseRowIds
                  .map((id, order) => (byId[id] ? { ...byId[id], order } : null))
                  .filter(Boolean) as PlanExercise[],
              }
            }),
          })),
        })),

      repeatDayToDays: (planId, sourceDayId, targetDayIds) => {
        const targets = [...new Set(targetDayIds)].filter((id) => id !== sourceDayId)
        if (targets.length === 0) return

        set((state) => ({
          plans: mapPlan(state.plans, planId, (plan) => {
            const source = plan.days.find((d) => d.id === sourceDayId)
            if (!source || source.exercises.length === 0) return plan

            const targetSet = new Set(targets)
            return {
              ...plan,
              days: plan.days.map((day) => {
                if (!targetSet.has(day.id)) return day
                return {
                  ...day,
                  muscleFocus: source.muscleFocus,
                  isRestDay: false,
                  exercises: source.exercises.map((ex, i) => ({
                    ...ex,
                    id: uid(),
                    secondaryMuscles: [...(ex.secondaryMuscles ?? [])],
                    order: i,
                  })),
                }
              }),
            }
          }),
        }))
      },

      getActivePlan: () => get().plans.find((p) => p.isActive) ?? get().plans[0] ?? null,

      getPlan: (planId) => get().plans.find((p) => p.id === planId),

      getDay: (planId, dayId) => get().getPlan(planId)?.days.find((d) => d.id === dayId),

      getTodayDay: () => {
        const plan = get().getActivePlan()
        if (!plan) return null
        // JS: Sunday=0 → convert to Mon=1 … Sun=7
        const jsDay = new Date().getDay()
        const dayOfWeek = jsDay === 0 ? 7 : jsDay
        const day =
          plan.days.find((d) => d.dayOfWeek === dayOfWeek) ??
          plan.days.find((d) => d.name.toLowerCase() === WEEKDAY_LABELS[dayOfWeek - 1].toLowerCase())
        if (!day) return null
        return { plan, day }
      },
    }),
    {
      name: 'gymtrack-workout-plans',
      onRehydrateStorage: () => (state) => {
        if (!state?.plans?.length) return
        // Defer so actions are fully bound after rehydrate
        queueMicrotask(() => {
          for (const plan of usePlanStore.getState().plans) {
            usePlanStore.getState().ensureWeekdaySlots(plan.id)
          }
        })
      },
    }
  )
)
