'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { WEEKDAY_LABELS } from '@/data/exercises'

export type PlannedMealItem = {
  id: string
  name: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  notes?: string
}

export type MealPlanSlot = {
  id: string
  order: number
  label: string
  items: PlannedMealItem[]
}

export type MealPlanDay = {
  id: string
  dayOfWeek: number // 1–7 Mon–Sun
  name: string
  order: number
  slots: MealPlanSlot[]
}

export type MealPlan = {
  id: string
  name: string
  description: string
  isActive: boolean
  mealsPerDay: number
  createdAt: string
  updatedAt: string
  days: MealPlanDay[]
}

const SLOT_LABELS = [
  'Breakfast',
  'Lunch',
  'Dinner',
  'Snack',
  'Snack 2',
  'Snack 3',
  'Meal 7',
  'Meal 8',
] as const

function uid() {
  return crypto.randomUUID()
}

function clampMealsPerDay(n: number) {
  return Math.min(8, Math.max(2, Math.round(n) || 4))
}

export function defaultSlotLabel(index: number): string {
  return SLOT_LABELS[index] ?? `Meal ${index + 1}`
}

function buildSlots(mealsPerDay: number): MealPlanSlot[] {
  const count = clampMealsPerDay(mealsPerDay)
  return Array.from({ length: count }, (_, i) => ({
    id: uid(),
    order: i,
    label: defaultSlotLabel(i),
    items: [],
  }))
}

function buildWeekDays(mealsPerDay: number): MealPlanDay[] {
  return WEEKDAY_LABELS.map((name, i) => ({
    id: uid(),
    dayOfWeek: i + 1,
    name,
    order: i,
    slots: buildSlots(mealsPerDay),
  }))
}

function resizeSlots(existing: MealPlanSlot[], mealsPerDay: number): MealPlanSlot[] {
  const count = clampMealsPerDay(mealsPerDay)
  const sorted = [...existing].sort((a, b) => a.order - b.order)
  if (sorted.length === count) {
    return sorted.map((s, i) => ({ ...s, order: i }))
  }
  if (sorted.length > count) {
    return sorted.slice(0, count).map((s, i) => ({ ...s, order: i }))
  }
  const next = sorted.map((s, i) => ({ ...s, order: i }))
  for (let i = sorted.length; i < count; i++) {
    next.push({
      id: uid(),
      order: i,
      label: defaultSlotLabel(i),
      items: [],
    })
  }
  return next
}

function touch(plan: MealPlan): MealPlan {
  return { ...plan, updatedAt: new Date().toISOString() }
}

function summarizeSlotItems(items: PlannedMealItem[]) {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      proteinG: acc.proteinG + item.proteinG,
      carbsG: acc.carbsG + item.carbsG,
      fatG: acc.fatG + item.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  )
}

export function summarizePlannedSlot(slot: MealPlanSlot) {
  return summarizeSlotItems(slot.items)
}

export function summarizePlannedDay(day: MealPlanDay) {
  return day.slots.reduce(
    (acc, slot) => {
      const s = summarizeSlotItems(slot.items)
      return {
        calories: acc.calories + s.calories,
        proteinG: acc.proteinG + s.proteinG,
        carbsG: acc.carbsG + s.carbsG,
        fatG: acc.fatG + s.fatG,
        itemCount: acc.itemCount + slot.items.length,
      }
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, itemCount: 0 }
  )
}

type MealPlanState = {
  plans: MealPlan[]
  createPlan: (input: {
    name: string
    description?: string
    mealsPerDay?: number
    withWeekTemplate?: boolean
  }) => string
  updatePlan: (
    planId: string,
    fields: Partial<Pick<MealPlan, 'name' | 'description'>>
  ) => void
  deletePlan: (planId: string) => void
  setActivePlan: (planId: string) => void
  setMealsPerDay: (planId: string, mealsPerDay: number) => void
  updateSlot: (
    planId: string,
    dayId: string,
    slotId: string,
    fields: Partial<Pick<MealPlanSlot, 'label'>>
  ) => void
  addPlannedItem: (
    planId: string,
    dayId: string,
    slotId: string,
    item: Omit<PlannedMealItem, 'id'>
  ) => string
  updatePlannedItem: (
    planId: string,
    dayId: string,
    slotId: string,
    itemId: string,
    fields: Partial<Omit<PlannedMealItem, 'id'>>
  ) => void
  removePlannedItem: (
    planId: string,
    dayId: string,
    slotId: string,
    itemId: string
  ) => void
  getActivePlan: () => MealPlan | null
  getPlan: (planId: string) => MealPlan | undefined
  getDay: (planId: string, dayId: string) => MealPlanDay | undefined
  getTodayDay: () => { plan: MealPlan; day: MealPlanDay } | null
}

export const useMealPlanStore = create<MealPlanState>()(
  persist(
    (set, get) => ({
      plans: [],

      createPlan: ({ name, description = '', mealsPerDay = 4, withWeekTemplate = true }) => {
        const id = uid()
        const count = clampMealsPerDay(mealsPerDay)
        const now = new Date().toISOString()
        const plan: MealPlan = {
          id,
          name: name.trim() || 'Meal Plan',
          description: description.trim(),
          isActive: get().plans.length === 0,
          mealsPerDay: count,
          createdAt: now,
          updatedAt: now,
          days: withWeekTemplate ? buildWeekDays(count) : [],
        }
        set((state) => ({
          plans: plan.isActive
            ? [plan, ...state.plans.map((p) => ({ ...p, isActive: false }))]
            : [plan, ...state.plans],
        }))
        return id
      },

      updatePlan: (planId, fields) => {
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === planId
              ? touch({
                  ...p,
                  ...(fields.name != null ? { name: fields.name.trim() } : {}),
                  ...(fields.description != null
                    ? { description: fields.description.trim() }
                    : {}),
                })
              : p
          ),
        }))
      },

      deletePlan: (planId) => {
        set((state) => {
          const remaining = state.plans.filter((p) => p.id !== planId)
          if (remaining.length > 0 && !remaining.some((p) => p.isActive)) {
            remaining[0] = { ...remaining[0], isActive: true }
          }
          return { plans: remaining }
        })
      },

      setActivePlan: (planId) => {
        set((state) => ({
          plans: state.plans.map((p) => ({
            ...p,
            isActive: p.id === planId,
            updatedAt: p.id === planId ? new Date().toISOString() : p.updatedAt,
          })),
        }))
      },

      setMealsPerDay: (planId, mealsPerDay) => {
        const count = clampMealsPerDay(mealsPerDay)
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === planId
              ? touch({
                  ...p,
                  mealsPerDay: count,
                  days: p.days.map((d) => ({
                    ...d,
                    slots: resizeSlots(d.slots, count),
                  })),
                })
              : p
          ),
        }))
      },

      updateSlot: (planId, dayId, slotId, fields) => {
        set((state) => ({
          plans: state.plans.map((p) => {
            if (p.id !== planId) return p
            return touch({
              ...p,
              days: p.days.map((d) => {
                if (d.id !== dayId) return d
                return {
                  ...d,
                  slots: d.slots.map((s) =>
                    s.id === slotId
                      ? {
                          ...s,
                          ...(fields.label != null
                            ? { label: fields.label.trim() || s.label }
                            : {}),
                        }
                      : s
                  ),
                }
              }),
            })
          }),
        }))
      },

      addPlannedItem: (planId, dayId, slotId, item) => {
        const id = uid()
        const planned: PlannedMealItem = {
          id,
          name: item.name.trim(),
          calories: Math.max(0, Math.round(item.calories)),
          proteinG: Math.max(0, Math.round(item.proteinG)),
          carbsG: Math.max(0, Math.round(item.carbsG)),
          fatG: Math.max(0, Math.round(item.fatG)),
          notes: item.notes?.trim() || undefined,
        }
        set((state) => ({
          plans: state.plans.map((p) => {
            if (p.id !== planId) return p
            return touch({
              ...p,
              days: p.days.map((d) => {
                if (d.id !== dayId) return d
                return {
                  ...d,
                  slots: d.slots.map((s) =>
                    s.id === slotId ? { ...s, items: [...s.items, planned] } : s
                  ),
                }
              }),
            })
          }),
        }))
        return id
      },

      updatePlannedItem: (planId, dayId, slotId, itemId, fields) => {
        set((state) => ({
          plans: state.plans.map((p) => {
            if (p.id !== planId) return p
            return touch({
              ...p,
              days: p.days.map((d) => {
                if (d.id !== dayId) return d
                return {
                  ...d,
                  slots: d.slots.map((s) => {
                    if (s.id !== slotId) return s
                    return {
                      ...s,
                      items: s.items.map((it) =>
                        it.id === itemId
                          ? {
                              ...it,
                              ...(fields.name != null
                                ? { name: fields.name.trim() }
                                : {}),
                              ...(fields.calories != null
                                ? {
                                    calories: Math.max(
                                      0,
                                      Math.round(fields.calories)
                                    ),
                                  }
                                : {}),
                              ...(fields.proteinG != null
                                ? {
                                    proteinG: Math.max(
                                      0,
                                      Math.round(fields.proteinG)
                                    ),
                                  }
                                : {}),
                              ...(fields.carbsG != null
                                ? {
                                    carbsG: Math.max(
                                      0,
                                      Math.round(fields.carbsG)
                                    ),
                                  }
                                : {}),
                              ...(fields.fatG != null
                                ? {
                                    fatG: Math.max(0, Math.round(fields.fatG)),
                                  }
                                : {}),
                              ...(fields.notes !== undefined
                                ? {
                                    notes: fields.notes?.trim() || undefined,
                                  }
                                : {}),
                            }
                          : it
                      ),
                    }
                  }),
                }
              }),
            })
          }),
        }))
      },

      removePlannedItem: (planId, dayId, slotId, itemId) => {
        set((state) => ({
          plans: state.plans.map((p) => {
            if (p.id !== planId) return p
            return touch({
              ...p,
              days: p.days.map((d) => {
                if (d.id !== dayId) return d
                return {
                  ...d,
                  slots: d.slots.map((s) =>
                    s.id === slotId
                      ? { ...s, items: s.items.filter((it) => it.id !== itemId) }
                      : s
                  ),
                }
              }),
            })
          }),
        }))
      },

      getActivePlan: () => {
        const plans = get().plans
        return plans.find((p) => p.isActive) ?? plans[0] ?? null
      },

      getPlan: (planId) => get().plans.find((p) => p.id === planId),

      getDay: (planId, dayId) =>
        get().plans.find((p) => p.id === planId)?.days.find((d) => d.id === dayId),

      getTodayDay: () => {
        const plan = get().getActivePlan()
        if (!plan) return null
        const jsDay = new Date().getDay()
        const dayOfWeek = jsDay === 0 ? 7 : jsDay
        const day =
          plan.days.find((d) => d.dayOfWeek === dayOfWeek) ??
          plan.days.find(
            (d) =>
              d.name.toLowerCase() === WEEKDAY_LABELS[dayOfWeek - 1].toLowerCase()
          )
        if (!day) return null
        return { plan, day }
      },
    }),
    { name: 'gymtrack-meal-plans' }
  )
)
