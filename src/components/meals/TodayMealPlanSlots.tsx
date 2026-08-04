'use client'

import { useRouter } from 'next/navigation'
import { Check, ChevronRight, Plus, UtensilsCrossed } from 'lucide-react'
import {
  summarizePlannedSlot,
  type MealPlan,
  type MealPlanDay,
  type MealPlanSlot,
} from '@/stores/mealPlanStore'
import type { MealEntry, MealType } from '@/stores/mealStore'
import { MEAL_TYPE_LABELS } from '@/stores/mealStore'

function labelToMealType(label: string): MealType {
  const lower = label.trim().toLowerCase()
  if (lower.startsWith('breakfast')) return 'breakfast'
  if (lower.startsWith('lunch')) return 'lunch'
  if (lower.startsWith('dinner')) return 'dinner'
  return 'snack'
}

export function isSlotLogged(
  slot: MealPlanSlot,
  todaysMeals: MealEntry[]
): boolean {
  if (todaysMeals.some((m) => m.planSlotId === slot.id)) return true
  const type = labelToMealType(slot.label)
  // Fallback only when slot has no planned items — prefer planSlotId
  if (slot.items.length > 0) return false
  return todaysMeals.some((m) => m.type === type)
}

type TodayMealPlanSlotsProps = {
  plan: MealPlan
  day: MealPlanDay
  todaysMeals: MealEntry[]
  onLogSlot: (slot: MealPlanSlot, type: MealType) => void
  onLogPlanned: (slot: MealPlanSlot) => void
}

export function TodayMealPlanSlots({
  plan,
  day,
  todaysMeals,
  onLogSlot,
  onLogPlanned,
}: TodayMealPlanSlotsProps) {
  const router = useRouter()
  const slots = [...day.slots].sort((a, b) => a.order - b.order)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Today&apos;s plan
          </p>
          <p className="text-sm font-bold text-foreground">{plan.name}</p>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/meal-plans/${plan.id}/days/${day.id}`)}
          className="text-[11px] font-semibold text-primary flex items-center gap-0.5 cursor-pointer"
        >
          Edit day
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        {slots.map((slot) => {
          const summary = summarizePlannedSlot(slot)
          const done = isSlotLogged(slot, todaysMeals)
          const type = labelToMealType(slot.label)
          return (
            <div
              key={slot.id}
              className={`rounded-[20px] border p-3.5 space-y-2.5 ${
                done
                  ? 'bg-primary/5 border-primary/25'
                  : 'bg-card border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {done && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                    <p className="text-sm font-bold text-foreground">{slot.label}</p>
                  </div>
                  {slot.items.length > 0 ? (
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                      {slot.items.map((i) => i.name).join(' · ')}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      No planned foods · {MEAL_TYPE_LABELS[type]}
                    </p>
                  )}
                </div>
                {summary.calories > 0 && (
                  <span className="text-[10px] font-semibold text-muted-foreground tabular-nums shrink-0">
                    {summary.calories} kcal
                  </span>
                )}
              </div>

              {!done && (
                <div className="flex gap-2">
                  {slot.items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onLogPlanned(slot)}
                      className="flex-1 h-9 rounded-[12px] bg-primary text-primary-foreground text-[11px] font-bold cursor-pointer active:scale-[0.98]"
                    >
                      Log planned
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onLogSlot(slot, type)}
                    className={`${
                      slot.items.length > 0 ? 'flex-1' : 'w-full'
                    } h-9 rounded-[12px] border border-border bg-muted text-[11px] font-bold text-foreground flex items-center justify-center gap-1 cursor-pointer active:scale-[0.98]`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Log
                  </button>
                </div>
              )}

              {done && (
                <p className="text-[10px] font-semibold text-primary">Logged for today</p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function NoMealPlanCard() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => router.push('/meal-plans/new')}
      className="w-full rounded-[20px] border border-dashed border-border bg-card/50 p-4 text-left space-y-2 cursor-pointer active:scale-[0.99]"
    >
      <div className="flex items-center gap-2">
        <UtensilsCrossed className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm font-bold text-foreground">Set up a meal plan</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Create a weekly template with meal slots to follow each day — like a workout split.
      </p>
    </button>
  )
}
