'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import {
  summarizePlannedSlot,
  useMealPlanStore,
} from '@/stores/mealPlanStore'
import { WEEKDAY_LABELS } from '@/data/exercises'

export default function MealPlanDayPage() {
  const { planId, dayId } = useParams<{ planId: string; dayId: string }>()
  const router = useRouter()
  const plan = useMealPlanStore((s) => s.plans.find((p) => p.id === planId))
  const day = plan?.days.find((d) => d.id === dayId)
  const updateSlot = useMealPlanStore((s) => s.updateSlot)
  const addPlannedItem = useMealPlanStore((s) => s.addPlannedItem)
  const removePlannedItem = useMealPlanStore((s) => s.removePlannedItem)

  const [activeSlotId, setActiveSlotId] = useState<string | null>(null)
  const [itemName, setItemName] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')

  const sortedSlots = useMemo(
    () => (day ? [...day.slots].sort((a, b) => a.order - b.order) : []),
    [day]
  )

  if (!plan || !day) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Day not found.</p>
        <button
          type="button"
          onClick={() => router.push(planId ? `/meal-plans/${planId}` : '/meal-plans')}
          className="text-sm font-bold text-primary"
        >
          Back
        </button>
      </div>
    )
  }

  const weekday =
    day.dayOfWeek >= 1 && day.dayOfWeek <= 7
      ? WEEKDAY_LABELS[day.dayOfWeek - 1]
      : day.name

  const resetItemForm = () => {
    setItemName('')
    setCalories('')
    setProtein('')
    setCarbs('')
    setFat('')
  }

  const handleAddItem = (slotId: string) => {
    if (!itemName.trim()) return
    addPlannedItem(plan.id, day.id, slotId, {
      name: itemName.trim(),
      calories: Number(calories) || 0,
      proteinG: Number(protein) || 0,
      carbsG: Number(carbs) || 0,
      fatG: Number(fat) || 0,
    })
    resetItemForm()
    setActiveSlotId(null)
  }

  return (
    <div className="p-5 space-y-5 pb-12">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(`/meal-plans/${plan.id}`)}
          className="p-2 bg-card border border-border rounded-xl text-foreground cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">{weekday}</h1>
          <p className="text-xs text-muted-foreground">
            {plan.name} · {sortedSlots.length} meal slots
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {sortedSlots.map((slot) => {
          const summary = summarizePlannedSlot(slot)
          const isAdding = activeSlotId === slot.id
          return (
            <div
              key={slot.id}
              className="bg-card border border-border rounded-[22px] p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <input
                  value={slot.label}
                  onChange={(e) =>
                    updateSlot(plan.id, day.id, slot.id, { label: e.target.value })
                  }
                  className="flex-1 bg-transparent text-sm font-bold text-foreground focus:outline-none border-b border-transparent focus:border-primary"
                />
                {summary.calories > 0 && (
                  <span className="text-[11px] font-semibold text-muted-foreground tabular-nums shrink-0">
                    {summary.calories} kcal · {summary.proteinG}g P
                  </span>
                )}
              </div>

              {slot.items.length === 0 ? (
                <p className="text-xs text-muted-foreground">No planned foods yet.</p>
              ) : (
                <ul className="space-y-2">
                  {slot.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-[14px] bg-muted/60 border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">
                          {item.calories} kcal · P {item.proteinG} · C {item.carbsG} · F{' '}
                          {item.fatG}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          removePlannedItem(plan.id, day.id, slot.id, item.id)
                        }
                        className="p-1.5 rounded-lg text-destructive cursor-pointer"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {isAdding ? (
                <div className="space-y-2 pt-1 border-t border-border">
                  <input
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Food name"
                    className="w-full h-10 bg-muted border border-border rounded-[12px] px-3 text-sm focus:outline-none focus:border-primary"
                  />
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: 'kcal', value: calories, set: setCalories },
                      { label: 'P', value: protein, set: setProtein },
                      { label: 'C', value: carbs, set: setCarbs },
                      { label: 'F', value: fat, set: setFat },
                    ].map((field) => (
                      <div key={field.label}>
                        <label className="text-[9px] font-bold text-muted-foreground ml-0.5">
                          {field.label}
                        </label>
                        <input
                          inputMode="numeric"
                          value={field.value}
                          onChange={(e) => field.set(e.target.value)}
                          className="w-full h-9 bg-muted border border-border rounded-[10px] px-2 text-xs tabular-nums focus:outline-none focus:border-primary"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSlotId(null)
                        resetItemForm()
                      }}
                      className="flex-1 h-9 rounded-[12px] border border-border bg-muted text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!itemName.trim()}
                      onClick={() => handleAddItem(slot.id)}
                      className="flex-1 h-9 rounded-[12px] bg-primary text-primary-foreground text-xs font-bold disabled:opacity-40 cursor-pointer"
                    >
                      Save food
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    resetItemForm()
                    setActiveSlotId(slot.id)
                  }}
                  className="w-full h-9 rounded-[12px] border border-dashed border-border text-xs font-semibold text-muted-foreground flex items-center justify-center gap-1.5 cursor-pointer hover:text-foreground"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add planned food
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
