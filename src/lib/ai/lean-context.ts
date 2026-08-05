import type { AgentContext } from '@/lib/ai/agent-types'
import { buildAgentCalendar } from '@/lib/ai/calendar'

/**
 * Ultra-compact snapshot for the LLM (validation still uses the full context).
 * Keeps tokens under Groq free-tier TPM (~6k).
 */
export function leanContextForModel(context: AgentContext) {
  const generatedAt = Date.parse(context.generatedAt)
  const calendar = buildAgentCalendar(
    Number.isFinite(generatedAt) ? new Date(generatedAt) : new Date()
  )
  const activePlan =
    context.plans.find((plan) => plan.isActive) ?? context.plans[0] ?? null

  return {
    generatedAt: context.generatedAt,
    calendar: {
      todayIso: calendar.todayIso,
      todayWeekday: calendar.todayWeekday,
      todayName: calendar.todayName,
      tomorrowWeekday: calendar.tomorrowWeekday,
      tomorrowName: calendar.tomorrowName,
      dayOfWeek: '1=Mon … 7=Sun',
    },
    activePlanId: activePlan?.id ?? null,
    profile: context.profile,
    settings: context.settings,
    restTimer: context.restTimer,
    recovery: context.recovery.map((r) => ({
      group: r.group,
      status: r.status,
      progress: r.progress,
      // Keep only fatigued/recovering detail muscles to save tokens
      muscles: (r.muscles ?? [])
        .filter((m) => m.status !== 'Ready')
        .map((m) => ({ label: m.label, status: m.status, progress: m.progress })),
    })),
    progress: {
      goalWeight: context.progress.goalWeight,
      recentBodyWeight: context.progress.recentBodyWeight.slice(0, 3),
    },
    plans: context.plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      isActive: plan.isActive,
      days: plan.days.map((day) => ({
        id: day.id,
        name: day.name,
        muscleFocus: day.muscleFocus,
        dayOfWeek: day.dayOfWeek,
        exercises: day.exercises.map((ex) => ({
          rowId: ex.rowId,
          exerciseId: ex.exerciseId,
          name: ex.name,
          sets: ex.targetSets,
          reps: ex.targetReps,
        })),
      })),
    })),
    activeWorkout: context.activeWorkout
      ? {
          id: context.activeWorkout.id,
          name: context.activeWorkout.name,
          exercises: context.activeWorkout.exercises.map((ex) => ({
            exerciseId: ex.exerciseId,
            name: ex.name,
            done: `${ex.completedSets}/${ex.setCount}`,
          })),
        }
      : null,
    recentHistory: context.recentHistory.slice(0, 3).map((w) => ({
      id: w.id,
      name: w.name,
      completedAt: w.completedAt,
    })),
    historyIds: context.historyIds.slice(0, 15),
    customExercises: context.customExercises.slice(0, 20).map((ex) => ({
      id: ex.id,
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      equipment: ex.equipment,
      difficulty: ex.difficulty,
    })),
    muscleGroups: context.muscleGroups.slice(0, 20),
    exerciseCatalog: context.exerciseCatalog.slice(0, 30).map((ex) => ({
      id: ex.id,
      name: ex.name,
      muscleGroup: ex.muscleGroup,
    })),
    meals: context.meals
      ? {
          today: context.meals.today,
          goals: {
            calories: context.meals.dailyCalorieGoal,
            proteinG: context.meals.dailyProteinGoal,
            carbsG: context.meals.dailyCarbsGoal,
            fatG: context.meals.dailyFatGoal,
            waterMl: context.meals.dailyWaterGoalMl,
          },
          waterTotalMl: context.meals.waterTotalMl,
          todaysMeals: context.meals.todaysMeals.slice(0, 6).map((m) => ({
            id: m.id,
            type: m.type,
            name: m.name,
            calories: m.calories,
            proteinG: m.proteinG,
          })),
          recentWater: context.meals.recentWater.slice(0, 4),
          activeMealPlan: context.meals.activeMealPlan ?? null,
        }
      : undefined,
  }
}
