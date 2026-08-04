'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Check, Trash2, Star, UtensilsCrossed } from 'lucide-react'
import { useMealPlanStore } from '@/stores/mealPlanStore'

export default function MealPlansPage() {
  const router = useRouter()
  const plans = useMealPlanStore((s) => s.plans)
  const setActivePlan = useMealPlanStore((s) => s.setActivePlan)
  const deletePlan = useMealPlanStore((s) => s.deletePlan)

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/meals')}
            className="p-2 bg-card border border-border rounded-xl text-foreground cursor-pointer active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Meal Plans</h1>
            <p className="text-xs text-muted-foreground">Weekly templates for daily meals</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push('/meal-plans/new')}
          className="h-10 px-3 rounded-[14px] bg-primary text-primary-foreground font-bold text-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-border bg-card/50 p-8 text-center space-y-3">
          <UtensilsCrossed className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-semibold text-foreground">No meal plans yet</p>
          <p className="text-xs text-muted-foreground">
            Create a Mon–Sun plan with meal slots to follow each day.
          </p>
          <button
            type="button"
            onClick={() => router.push('/meal-plans/new')}
            className="mt-2 h-11 px-5 rounded-[16px] bg-primary text-primary-foreground font-bold text-sm cursor-pointer"
          >
            Create Meal Plan
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const plannedItems = plan.days.reduce(
              (n, d) => n + d.slots.reduce((m, s) => m + s.items.length, 0),
              0
            )
            return (
              <div
                key={plan.id}
                className="bg-card border border-border rounded-[24px] p-4 space-y-3"
              >
                <button
                  type="button"
                  onClick={() => router.push(`/meal-plans/${plan.id}`)}
                  className="w-full text-left space-y-1 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-foreground">{plan.name}</h3>
                    {plan.isActive && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/25 px-2 py-0.5 text-[10px] font-bold text-primary">
                        <Check className="w-3 h-3" />
                        Active
                      </span>
                    )}
                  </div>
                  {plan.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {plan.description}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {plan.days.length} days · {plan.mealsPerDay} meals/day · {plannedItems}{' '}
                    planned foods
                  </p>
                </button>

                <div className="flex gap-2">
                  {!plan.isActive && (
                    <button
                      type="button"
                      onClick={() => setActivePlan(plan.id)}
                      className="flex-1 h-10 rounded-[14px] bg-primary/15 border border-primary/20 text-primary text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                    >
                      <Star className="w-3.5 h-3.5" />
                      Set Active
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => router.push(`/meal-plans/${plan.id}`)}
                    className="flex-1 h-10 rounded-[14px] bg-muted border border-border text-foreground text-xs font-bold cursor-pointer active:scale-[0.98]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete "${plan.name}"?`)) deletePlan(plan.id)
                    }}
                    className="h-10 w-10 rounded-[14px] bg-destructive/10 border border-destructive/15 text-destructive flex items-center justify-center cursor-pointer active:scale-95"
                    aria-label="Delete plan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
