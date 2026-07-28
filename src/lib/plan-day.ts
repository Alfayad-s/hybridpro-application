import { buildAgentCalendar } from '@/lib/ai/calendar'
import type { PlanDay, WorkoutPlan } from '@/stores/planStore'
import type { StartWorkoutExercise } from '@/stores/workoutStore'

export function getTomorrowWeekday(now = new Date()) {
  return buildAgentCalendar(now).tomorrowWeekday
}

export function findPlanDayByWeekday(
  plan: WorkoutPlan | null | undefined,
  dayOfWeek: number
): PlanDay | null {
  if (!plan) return null
  return plan.days.find((d) => d.dayOfWeek === dayOfWeek) ?? null
}

export function isWorkoutDay(day: PlanDay | null | undefined): day is PlanDay {
  if (!day) return false
  if (day.isRestDay) return false
  return day.exercises.length > 0
}

export function planDayToSessionExercises(day: PlanDay): StartWorkoutExercise[] {
  return day.exercises.map((ex) => ({
    exerciseId: ex.exerciseId,
    name: ex.name,
    categoryName: ex.category,
    equipment: ex.equipment,
    targetSets: ex.targetSets,
    targetReps: ex.targetReps,
    restSeconds: ex.restSeconds,
  }))
}

export function planDaySessionName(day: PlanDay, suffix?: string): string {
  const base = day.muscleFocus
    ? `${day.name} · ${day.muscleFocus}`
    : day.name
  return suffix ? `${base} (${suffix})` : base
}

export function findTomorrowPlanDay(
  plan: WorkoutPlan | null | undefined,
  now = new Date()
): PlanDay | null {
  return findPlanDayByWeekday(plan, getTomorrowWeekday(now))
}

export function canTakeTomorrowWorkout(
  plan: WorkoutPlan | null | undefined,
  now = new Date()
): boolean {
  const day = findTomorrowPlanDay(plan, now)
  return isWorkoutDay(day)
}
