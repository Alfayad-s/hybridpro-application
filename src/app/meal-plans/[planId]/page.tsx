'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ChevronRight,
  Star,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react'
import {
  summarizePlannedDay,
  useMealPlanStore,
} from '@/stores/mealPlanStore'
import { WEEKDAY_LABELS } from '@/data/exercises'

export default function MealPlanDetailPage() {
  const { planId } = useParams<{ planId: string }>()
  const router = useRouter()
  const plan = useMealPlanStore((s) => s.plans.find((p) => p.id === planId))
  const setActivePlan = useMealPlanStore((s) => s.setActivePlan)
  const updatePlan = useMealPlanStore((s) => s.updatePlan)
  const setMealsPerDay = useMealPlanStore((s) => s.setMealsPerDay)
  const deletePlan = useMealPlanStore((s) => s.deletePlan)

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  const sortedDays = useMemo(
    () => (plan ? [...plan.days].sort((a, b) => a.order - b.order) : []),
    [plan]
  )

  if (!plan) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Meal plan not found.</p>
        <button
          type="button"
          onClick={() => router.push('/meal-plans')}
          className="text-sm font-bold text-primary"
        >
          Back to meal plans
        </button>
      </div>
    )
  }

  return (
    <div className="p-5 space-y-5 pb-10">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.push('/meal-plans')}
            className="p-2 bg-card border border-border rounded-xl text-foreground cursor-pointer active:scale-95 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          {editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => {
                if (nameDraft.trim()) updatePlan(plan.id, { name: nameDraft.trim() })
                setEditingName(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (nameDraft.trim()) updatePlan(plan.id, { name: nameDraft.trim() })
                  setEditingName(false)
                }
              }}
              className="flex-1 h-10 bg-muted border border-border rounded-[14px] px-3 text-base font-bold text-foreground focus:outline-none focus:border-primary"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameDraft(plan.name)
                setEditingName(true)
              }}
              className="text-left min-w-0 cursor-pointer"
            >
              <h1 className="text-xl font-bold text-foreground tracking-tight truncate">
                {plan.name}
              </h1>
              <p className="text-[11px] text-muted-foreground">
                {plan.mealsPerDay} meals/day · tap name to edit
              </p>
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Delete "${plan.name}"?`)) {
              deletePlan(plan.id)
              router.push('/meal-plans')
            }
          }}
          className="p-2 rounded-xl bg-destructive/10 border border-destructive/15 text-destructive cursor-pointer shrink-0"
          aria-label="Delete plan"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {!plan.isActive && (
        <button
          type="button"
          onClick={() => setActivePlan(plan.id)}
          className="w-full h-11 rounded-[16px] bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Star className="w-4 h-4" />
          Set as active meal plan
        </button>
      )}

      {plan.isActive && (
        <div className="rounded-[16px] bg-primary/10 border border-primary/20 px-4 py-3 text-xs font-semibold text-primary">
          Active — today&apos;s slots on Meals pull from this plan.
        </div>
      )}

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 ml-1">
          Meals per day
        </p>
        <div className="flex gap-2 flex-wrap">
          {[2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setMealsPerDay(plan.id, n)}
              className={`h-10 min-w-[40px] px-3 rounded-[12px] border text-sm font-bold cursor-pointer ${
                plan.mealsPerDay === n
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted border-border text-foreground'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
          Week days
        </p>
        {sortedDays.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-border p-6 text-center">
            <UtensilsCrossed className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No days in this plan.</p>
          </div>
        ) : (
          sortedDays.map((day) => {
            const summary = summarizePlannedDay(day)
            const weekday =
              day.dayOfWeek >= 1 && day.dayOfWeek <= 7
                ? WEEKDAY_LABELS[day.dayOfWeek - 1]
                : day.name
            return (
              <button
                key={day.id}
                type="button"
                onClick={() => router.push(`/meal-plans/${plan.id}/days/${day.id}`)}
                className="w-full bg-card border border-border rounded-[20px] p-4 flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">{weekday}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {day.slots.length} slots · {summary.itemCount} foods
                    {summary.calories > 0 ? ` · ${summary.calories} kcal` : ''}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
