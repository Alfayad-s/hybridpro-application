'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { format } from 'date-fns'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type MealEntry = {
  id: string
  date: string // yyyy-MM-dd
  type: MealType
  name: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  notes?: string
  imageUrl?: string
  /** When logged from an active meal-plan slot */
  planSlotId?: string
  createdAt: string
}

export type WaterEntry = {
  id: string
  date: string // yyyy-MM-dd
  amountMl: number
  createdAt: string
}

type MealState = {
  meals: MealEntry[]
  waterLogs: WaterEntry[]
  dailyCalorieGoal: number
  dailyProteinGoal: number
  dailyCarbsGoal: number
  dailyFatGoal: number
  dailyWaterGoalMl: number
  addMeal: (input: Omit<MealEntry, 'id' | 'createdAt'>) => string
  updateMeal: (id: string, patch: Partial<Omit<MealEntry, 'id' | 'createdAt'>>) => void
  deleteMeal: (id: string) => void
  addWater: (amountMl: number, date?: string) => string
  removeWater: (id: string) => void
  setGoals: (goals: {
    dailyCalorieGoal?: number
    dailyProteinGoal?: number
    dailyCarbsGoal?: number
    dailyFatGoal?: number
    dailyWaterGoalMl?: number
  }) => void
  getMealsForDate: (date: string) => MealEntry[]
  getWaterForDate: (date: string) => WaterEntry[]
  getWaterTotalMl: (date: string) => number
}

function newId(prefix = 'meal') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

export const WATER_QUICK_AMOUNTS_ML = [250, 500, 750, 1000] as const

export function todayKey() {
  return format(new Date(), 'yyyy-MM-dd')
}

/** Pick meal type from local clock (breakfast → lunch → dinner → snack). */
export function mealTypeFromTime(date = new Date()): MealType {
  const hour = date.getHours()
  if (hour < 11) return 'breakfast'
  if (hour < 15) return 'lunch'
  if (hour < 21) return 'dinner'
  return 'snack'
}

export const useMealStore = create<MealState>()(
  persist(
    (set, get) => ({
      meals: [],
      waterLogs: [],
      dailyCalorieGoal: 2500,
      dailyProteinGoal: 160,
      dailyCarbsGoal: 250,
      dailyFatGoal: 70,
      dailyWaterGoalMl: 3000,

      addMeal: (input) => {
        const id = newId('meal')
        const entry: MealEntry = {
          ...input,
          id,
          name: input.name.trim(),
          calories: Math.max(0, Math.round(input.calories)),
          proteinG: Math.max(0, Math.round(input.proteinG)),
          carbsG: Math.max(0, Math.round(input.carbsG)),
          fatG: Math.max(0, Math.round(input.fatG)),
          notes: input.notes?.trim() || undefined,
          imageUrl: input.imageUrl?.trim() || undefined,
          planSlotId: input.planSlotId?.trim() || undefined,
          createdAt: new Date().toISOString(),
        }
        set((state) => ({ meals: [entry, ...state.meals].slice(0, 500) }))
        return id
      },

      updateMeal: (id, patch) => {
        set((state) => ({
          meals: state.meals.map((meal) =>
            meal.id === id
              ? {
                  ...meal,
                  ...patch,
                  ...(patch.name != null ? { name: patch.name.trim() } : {}),
                  ...(patch.calories != null
                    ? { calories: Math.max(0, Math.round(patch.calories)) }
                    : {}),
                  ...(patch.proteinG != null
                    ? { proteinG: Math.max(0, Math.round(patch.proteinG)) }
                    : {}),
                  ...(patch.carbsG != null
                    ? { carbsG: Math.max(0, Math.round(patch.carbsG)) }
                    : {}),
                  ...(patch.fatG != null
                    ? { fatG: Math.max(0, Math.round(patch.fatG)) }
                    : {}),
                }
              : meal
          ),
        }))
      },

      deleteMeal: (id) => {
        set((state) => ({ meals: state.meals.filter((m) => m.id !== id) }))
      },

      addWater: (amountMl, date) => {
        const ml = Math.max(0, Math.round(amountMl))
        if (ml <= 0) return ''
        const id = newId('water')
        const entry: WaterEntry = {
          id,
          date: date ?? todayKey(),
          amountMl: ml,
          createdAt: new Date().toISOString(),
        }
        set((state) => ({
          waterLogs: [entry, ...state.waterLogs].slice(0, 1000),
        }))
        return id
      },

      removeWater: (id) => {
        set((state) => ({
          waterLogs: state.waterLogs.filter((w) => w.id !== id),
        }))
      },

      setGoals: (goals) => {
        set((state) => ({
          dailyCalorieGoal: goals.dailyCalorieGoal ?? state.dailyCalorieGoal,
          dailyProteinGoal: goals.dailyProteinGoal ?? state.dailyProteinGoal,
          dailyCarbsGoal: goals.dailyCarbsGoal ?? state.dailyCarbsGoal,
          dailyFatGoal: goals.dailyFatGoal ?? state.dailyFatGoal,
          dailyWaterGoalMl: goals.dailyWaterGoalMl ?? state.dailyWaterGoalMl,
        }))
      },

      getMealsForDate: (date) => get().meals.filter((m) => m.date === date),
      getWaterForDate: (date) => get().waterLogs.filter((w) => w.date === date),
      getWaterTotalMl: (date) =>
        get()
          .waterLogs.filter((w) => w.date === date)
          .reduce((sum, w) => sum + w.amountMl, 0),
    }),
    { name: 'gymtrack-meals' }
  )
)

export function summarizeMeals(meals: MealEntry[]) {
  return meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.calories,
      proteinG: acc.proteinG + meal.proteinG,
      carbsG: acc.carbsG + meal.carbsG,
      fatG: acc.fatG + meal.fatG,
      count: acc.count + 1,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, count: 0 }
  )
}

export function formatWaterAmount(ml: number): string {
  if (ml >= 1000) {
    const liters = ml / 1000
    return `${Number.isInteger(liters) ? liters : liters.toFixed(1)}L`
  }
  return `${ml}ml`
}
