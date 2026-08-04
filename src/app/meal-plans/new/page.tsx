'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useMealPlanStore } from '@/stores/mealPlanStore'

export default function NewMealPlanPage() {
  const router = useRouter()
  const createPlan = useMealPlanStore((s) => s.createPlan)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [mealsPerDay, setMealsPerDay] = useState(4)
  const [withWeekTemplate, setWithWeekTemplate] = useState(true)
  const [saving, setSaving] = useState(false)

  const handleCreate = () => {
    if (!name.trim()) return
    setSaving(true)
    const id = createPlan({
      name: name.trim(),
      description: description.trim(),
      mealsPerDay,
      withWeekTemplate,
    })
    router.replace(`/meal-plans/${id}`)
  }

  return (
    <div className="p-5 space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 bg-card border border-border rounded-xl text-foreground cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-bold text-foreground tracking-tight">New Meal Plan</h1>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
            Plan name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cutting macros"
            className="mt-1.5 w-full h-[52px] bg-muted border border-border rounded-[20px] px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-sm"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional notes"
            rows={3}
            className="mt-1.5 w-full bg-muted border border-border rounded-[20px] px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-sm resize-none"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
            Meals per day
          </label>
          <div className="mt-1.5 flex gap-2 flex-wrap">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMealsPerDay(n)}
                className={`h-11 min-w-[44px] px-3 rounded-[14px] border text-sm font-bold cursor-pointer ${
                  mealsPerDay === n
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted border-border text-foreground'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground ml-1">
            Each day gets this many meal slots (Breakfast, Lunch, …).
          </p>
        </div>

        <button
          type="button"
          onClick={() => setWithWeekTemplate((v) => !v)}
          className={`w-full rounded-[20px] border p-4 text-left transition-colors cursor-pointer ${
            withWeekTemplate ? 'bg-primary/10 border-primary/30' : 'bg-card border-border'
          }`}
        >
          <p className="text-sm font-bold text-foreground">Start with Mon–Sun days</p>
          <p className="text-xs text-muted-foreground mt-1">
            Pre-create seven weekday slots you can fill with planned meals.
          </p>
        </button>
      </div>

      <button
        type="button"
        disabled={!name.trim() || saving}
        onClick={handleCreate}
        className="w-full h-[52px] bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground font-bold rounded-[20px] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
      >
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Meal Plan'}
      </button>
    </div>
  )
}
