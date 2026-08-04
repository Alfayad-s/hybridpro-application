'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  Apple,
  Coffee,
  Cookie,
  Droplets,
  Loader2,
  Plus,
  Settings2,
  Trash2,
  UtensilsCrossed,
  Moon,
  ChevronRight,
} from 'lucide-react'
import {
  MEAL_TYPE_LABELS,
  WATER_QUICK_AMOUNTS_ML,
  formatWaterAmount,
  mealTypeFromTime,
  summarizeMeals,
  todayKey,
  useMealStore,
  type MealType,
} from '@/stores/mealStore'
import { useMealPlanStore, type MealPlanSlot } from '@/stores/mealPlanStore'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { MealLogSheet } from '@/components/meals/MealLogSheet'
import { MealGoalsSheet } from '@/components/meals/MealGoalsSheet'
import {
  NoMealPlanCard,
  TodayMealPlanSlots,
} from '@/components/meals/TodayMealPlanSlots'

const TYPE_ICON: Record<MealType, typeof Coffee> = {
  breakfast: Coffee,
  lunch: UtensilsCrossed,
  dinner: Moon,
  snack: Cookie,
}

function waitForHydration() {
  return new Promise<void>((resolve) => {
    let pending = 2
    const done = () => {
      pending -= 1
      if (pending <= 0) resolve()
    }

    const waitStore = (store: {
      persist?: {
        hasHydrated?: () => boolean
        onFinishHydration?: (fn: () => void) => () => void
      }
    }) => {
      if (store.persist?.hasHydrated?.()) {
        done()
        return
      }
      const unsub = store.persist?.onFinishHydration?.(() => {
        unsub?.()
        done()
      })
      if (!unsub) done()
    }

    waitStore(useMealStore)
    waitStore(useMealPlanStore)
    setTimeout(() => resolve(), 800)
  })
}

async function uploadMealPhoto(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  form.append('mealKey', `draft-${Date.now().toString(36)}`)

  const res = await fetch('/api/meals/media', {
    method: 'POST',
    body: form,
  })
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!res.ok || !data.url) {
    throw new Error(data.error || 'Failed to upload photo')
  }
  return data.url
}

async function analyzeMeal(input: { imageUrl?: string; description?: string; hint?: string }) {
  const res = await fetch('/api/ai/analyze-meal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageUrl: input.imageUrl || undefined,
      description: input.description?.trim() || undefined,
      hint: input.hint?.trim() || undefined,
    }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    suggestion?: {
      name: string
      calories: number
      proteinG: number
      carbsG: number
      fatG: number
      notes?: string
      confidence?: string
    }
    error?: string
  }
  if (!res.ok || !data.suggestion) {
    throw new Error(data.error || 'AI could not estimate this meal')
  }
  return data.suggestion
}

export default function MealsPage() {
  const router = useRouter()
  const meals = useMealStore((s) => s.meals)
  const waterLogs = useMealStore((s) => s.waterLogs)
  const dailyCalorieGoal = useMealStore((s) => s.dailyCalorieGoal)
  const dailyProteinGoal = useMealStore((s) => s.dailyProteinGoal)
  const dailyCarbsGoal = useMealStore((s) => s.dailyCarbsGoal)
  const dailyFatGoal = useMealStore((s) => s.dailyFatGoal)
  const dailyWaterGoalMl = useMealStore((s) => s.dailyWaterGoalMl)
  const addMeal = useMealStore((s) => s.addMeal)
  const deleteMeal = useMealStore((s) => s.deleteMeal)
  const addWater = useMealStore((s) => s.addWater)
  const removeWater = useMealStore((s) => s.removeWater)
  const getWaterTotalMl = useMealStore((s) => s.getWaterTotalMl)
  const mealPlans = useMealPlanStore((s) => s.plans)
  const getTodayDay = useMealPlanStore((s) => s.getTodayDay)
  const user = useAuthStore((s) => s.user)

  const [hydrated, setHydrated] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showGoals, setShowGoals] = useState(false)
  const [pendingSlotId, setPendingSlotId] = useState<string | null>(null)
  const [type, setType] = useState<MealType>(() => mealTypeFromTime())
  const [name, setName] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [aiNote, setAiNote] = useState<string | null>(null)
  const [customWater, setCustomWater] = useState('')
  const [waterBusy, setWaterBusy] = useState(false)
  const [waterNote, setWaterNote] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const date = todayKey()

  useEffect(() => {
    let cancelled = false
    waitForHydration().then(() => {
      if (!cancelled) setHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const todayPlan = useMemo(() => {
    if (!hydrated) return null
    return getTodayDay()
  }, [hydrated, mealPlans, getTodayDay])

  const activeMealPlan = useMemo(() => {
    if (!hydrated) return null
    return mealPlans.find((p) => p.isActive) ?? mealPlans[0] ?? null
  }, [hydrated, mealPlans])

  const todaysMeals = useMemo(
    () => (hydrated ? meals.filter((m) => m.date === date) : []),
    [hydrated, meals, date]
  )

  const todaysWater = useMemo(
    () => (hydrated ? waterLogs.filter((w) => w.date === date) : []),
    [hydrated, waterLogs, date]
  )

  const waterTotalMl = useMemo(
    () => (hydrated ? getWaterTotalMl(date) : 0),
    [hydrated, getWaterTotalMl, date, waterLogs]
  )

  const totals = useMemo(() => summarizeMeals(todaysMeals), [todaysMeals])
  const caloriePct = Math.min(100, Math.round((totals.calories / dailyCalorieGoal) * 100))
  const proteinPct = Math.min(100, Math.round((totals.proteinG / dailyProteinGoal) * 100))
  const carbsPct = Math.min(100, Math.round((totals.carbsG / Math.max(1, dailyCarbsGoal)) * 100))
  const fatPct = Math.min(100, Math.round((totals.fatG / Math.max(1, dailyFatGoal)) * 100))
  const waterPct = Math.min(
    100,
    Math.round((waterTotalMl / Math.max(1, dailyWaterGoalMl)) * 100)
  )

  const syncWaterToChallenges = async (totalMl: number) => {
    if (!user) return
    try {
      const { syncMetricProgressAction } = await import(
        '@/server/actions/challenge.actions'
      )
      const updated = await syncMetricProgressAction({
        todayDate: date,
        metric: 'water',
        value: totalMl,
      })
      const completed = updated.filter((c) => c.status === 'completed')
      if (completed.length) {
        setWaterNote(
          `Hydration challenge complete · +${completed[0].xpReward} XP`
        )
      } else if (updated.length) {
        setWaterNote('Challenge progress updated')
      }
    } catch {
      /* challenges optional if offline / unauthorized */
    }
  }

  const syncProteinToChallenges = async (proteinG: number) => {
    if (!user) return
    try {
      const { syncMetricProgressAction } = await import(
        '@/server/actions/challenge.actions'
      )
      await syncMetricProgressAction({
        todayDate: date,
        metric: 'protein',
        value: proteinG,
      })
    } catch {
      /* optional */
    }
  }

  const handleLogWater = async (amountMl: number) => {
    if (amountMl <= 0 || waterBusy) return
    setWaterBusy(true)
    setWaterNote(null)
    try {
      addWater(amountMl, date)
      const nextTotal = useMealStore.getState().getWaterTotalMl(date)
      await syncWaterToChallenges(nextTotal)
    } finally {
      setWaterBusy(false)
    }
  }

  const handleRemoveWater = async (id: string) => {
    removeWater(id)
    const nextTotal = useMealStore.getState().getWaterTotalMl(date)
    await syncWaterToChallenges(nextTotal)
  }

  const openForm = (opts?: { type?: MealType; slotId?: string; prefill?: MealPlanSlot }) => {
    setType(opts?.type ?? mealTypeFromTime())
    setPendingSlotId(opts?.slotId ?? null)
    if (opts?.prefill?.items[0]) {
      const first = opts.prefill.items[0]
      setName(first.name)
      setCalories(String(first.calories))
      setProtein(String(first.proteinG))
      setCarbs(String(first.carbsG))
      setFat(String(first.fatG))
    }
    setShowForm(true)
    setPhotoError(null)
    setAiNote(null)
  }

  const resetForm = () => {
    setName('')
    setCalories('')
    setProtein('')
    setCarbs('')
    setFat('')
    setImageUrl('')
    setType(mealTypeFromTime())
    setPendingSlotId(null)
    setPhotoError(null)
    setAiNote(null)
    setShowForm(false)
  }

  const handleLogPlanned = (slot: MealPlanSlot) => {
    if (slot.items.length === 0) return
    const typeGuess =
      slot.label.toLowerCase().startsWith('breakfast')
        ? 'breakfast'
        : slot.label.toLowerCase().startsWith('lunch')
          ? 'lunch'
          : slot.label.toLowerCase().startsWith('dinner')
            ? 'dinner'
            : 'snack'
    for (const item of slot.items) {
      addMeal({
        date,
        type: typeGuess,
        name: item.name,
        calories: item.calories,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
        notes: item.notes,
        planSlotId: slot.id,
      })
    }
    const nextProtein = summarizeMeals(
      useMealStore.getState().getMealsForDate(date)
    ).proteinG
    void syncProteinToChallenges(nextProtein)
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const mealId = addMeal({
      date,
      type,
      name: name.trim(),
      calories: Number(calories) || 0,
      proteinG: Number(protein) || 0,
      carbsG: Number(carbs) || 0,
      fatG: Number(fat) || 0,
      imageUrl: imageUrl || undefined,
      notes: aiNote || undefined,
      planSlotId: pendingSlotId || undefined,
    })
    void import('@/lib/ai/rag/client-index').then(({ indexRagSource }) => {
      indexRagSource({
        sourceType: 'meal',
        sourceId: mealId,
        meal: {
          id: mealId,
          name: name.trim(),
          description: aiNote || undefined,
          mealType: type,
          loggedAt: date,
          calories: Number(calories) || 0,
          protein: Number(protein) || 0,
          carbs: Number(carbs) || 0,
          fat: Number(fat) || 0,
        },
      })
    })
    const nextProtein =
      summarizeMeals(useMealStore.getState().getMealsForDate(date)).proteinG
    void syncProteinToChallenges(nextProtein)
    resetForm()
  }

  const handlePhotoPick = async (file: File | undefined) => {
    if (!file) return
    if (!user) {
      setPhotoError('Sign in to take a photo and let AI log the meal.')
      return
    }

    setPhotoError(null)
    setAiNote(null)
    setUploading(true)
    try {
      const url = await uploadMealPhoto(file)
      setImageUrl(url)
      setType(mealTypeFromTime())

      setAnalyzing(true)
      const suggestion = await analyzeMeal({ imageUrl: url, hint: name })
      setName(suggestion.name)
      setCalories(String(suggestion.calories))
      setProtein(String(suggestion.proteinG))
      setCarbs(String(suggestion.carbsG))
      setFat(String(suggestion.fatG))
      if (suggestion.notes) setAiNote(suggestion.notes)
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Photo or AI analysis failed')
    } finally {
      setUploading(false)
      setAnalyzing(false)
    }
  }

  const handleAnalyzeAgain = async () => {
    if (!imageUrl || !user) return
    setPhotoError(null)
    setAnalyzing(true)
    try {
      const suggestion = await analyzeMeal({ imageUrl, hint: name })
      setName(suggestion.name)
      setCalories(String(suggestion.calories))
      setProtein(String(suggestion.proteinG))
      setCarbs(String(suggestion.carbsG))
      setFat(String(suggestion.fatG))
      if (suggestion.notes) setAiNote(suggestion.notes)
      setType(mealTypeFromTime())
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'AI analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleEstimateFromText = async () => {
    const description = name.trim()
    if (!description) {
      setPhotoError('Type what you ate first (e.g. 2 eggs, toast, banana).')
      return
    }
    if (!user) {
      setPhotoError('Sign in to estimate macros with AI.')
      return
    }

    setPhotoError(null)
    setAiNote(null)
    setAnalyzing(true)
    try {
      const suggestion = await analyzeMeal({ description })
      setName(suggestion.name)
      setCalories(String(suggestion.calories))
      setProtein(String(suggestion.proteinG))
      setCarbs(String(suggestion.carbsG))
      setFat(String(suggestion.fatG))
      if (suggestion.notes) setAiNote(suggestion.notes)
      setType(mealTypeFromTime())
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'AI estimate failed')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="p-5 space-y-5 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Meals</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {format(new Date(), 'EEEE, MMM d')} · track today’s fuel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGoals(true)}
            className="h-10 w-10 rounded-[14px] border border-border bg-card text-muted-foreground flex items-center justify-center cursor-pointer active:scale-95"
            aria-label="Edit daily targets"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => (showForm ? resetForm() : openForm())}
            className="h-10 px-3 rounded-[14px] bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            Log meal
          </button>
        </div>
      </div>

      <MealGoalsSheet open={showGoals} onOpenChange={setShowGoals} />

      <MealLogSheet
        open={showForm}
        onOpenChange={(open) => {
          if (!open) resetForm()
          else setShowForm(true)
        }}
        type={type}
        onTypeChange={setType}
        name={name}
        onNameChange={setName}
        calories={calories}
        onCaloriesChange={setCalories}
        protein={protein}
        onProteinChange={setProtein}
        carbs={carbs}
        onCarbsChange={setCarbs}
        fat={fat}
        onFatChange={setFat}
        imageUrl={imageUrl}
        onClearImage={() => {
          setImageUrl('')
          setAiNote(null)
        }}
        uploading={uploading}
        analyzing={analyzing}
        photoError={photoError}
        aiNote={aiNote}
        onSubmit={handleAdd}
        onPhotoPick={handlePhotoPick}
        onAnalyzeAgain={handleAnalyzeAgain}
        onEstimateFromText={handleEstimateFromText}
        onCancel={resetForm}
      />

      {!hydrated ? (
        <div className="space-y-3 animate-pulse" aria-busy="true">
          <div className="h-28 rounded-[24px] bg-muted/80" />
          <div className="h-40 rounded-[24px] bg-muted/80" />
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() =>
              router.push(activeMealPlan ? `/meal-plans/${activeMealPlan.id}` : '/meal-plans')
            }
            className="w-full bg-card border border-border rounded-[20px] p-4 flex items-center justify-between cursor-pointer active:scale-[0.99]"
          >
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Meal Plan
              </p>
              <p className="text-sm font-bold text-foreground mt-0.5">
                {activeMealPlan?.name ?? 'Create a weekly meal plan'}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-primary" />
          </button>

          <section className="rounded-[24px] border border-primary/25 bg-gradient-to-br from-primary/10 via-transparent to-transparent p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-primary">
                <Apple className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Today</span>
              </div>
              <button
                type="button"
                onClick={() => setShowGoals(true)}
                className="text-[10px] font-semibold text-primary cursor-pointer"
              >
                Edit targets
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Calories
                </p>
                <p className="text-2xl font-bold text-foreground tabular-nums mt-0.5">
                  {totals.calories}
                  <span className="text-sm font-semibold text-muted-foreground">
                    {' '}
                    / {dailyCalorieGoal}
                  </span>
                </p>
                <div className="mt-2 h-2 rounded-full bg-muted/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${caloriePct}%` }}
                  />
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Protein
                </p>
                <p className="text-2xl font-bold text-foreground tabular-nums mt-0.5">
                  {totals.proteinG}g
                  <span className="text-sm font-semibold text-muted-foreground">
                    {' '}
                    / {dailyProteinGoal}g
                  </span>
                </p>
                <div className="mt-2 h-2 rounded-full bg-muted/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-warning transition-all"
                    style={{ width: `${proteinPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-[14px] bg-background/50 border border-border px-3 py-2">
                <p className="text-sm font-bold text-foreground tabular-nums">
                  {totals.carbsG}g
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {' '}
                    / {dailyCarbsGoal}
                  </span>
                </p>
                <p className="text-[10px] text-muted-foreground">Carbs</p>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all"
                    style={{ width: `${carbsPct}%` }}
                  />
                </div>
              </div>
              <div className="rounded-[14px] bg-background/50 border border-border px-3 py-2">
                <p className="text-sm font-bold text-foreground tabular-nums">
                  {totals.fatG}g
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {' '}
                    / {dailyFatGoal}
                  </span>
                </p>
                <p className="text-[10px] text-muted-foreground">Fat</p>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-orange-400 transition-all"
                    style={{ width: `${fatPct}%` }}
                  />
                </div>
              </div>
              <div className="rounded-[14px] bg-background/50 border border-border px-3 py-2 text-center">
                <p className="text-sm font-bold text-foreground tabular-nums">{totals.count}</p>
                <p className="text-[10px] text-muted-foreground">Meals</p>
              </div>
            </div>
          </section>

          {todayPlan ? (
            <TodayMealPlanSlots
              plan={todayPlan.plan}
              day={todayPlan.day}
              todaysMeals={todaysMeals}
              onLogSlot={(slot, mealType) =>
                openForm({
                  type: mealType,
                  slotId: slot.id,
                  prefill: slot.items.length ? slot : undefined,
                })
              }
              onLogPlanned={handleLogPlanned}
            />
          ) : (
            <NoMealPlanCard />
          )}

          <section className="rounded-[24px] border border-sky-500/25 bg-gradient-to-br from-sky-500/10 via-transparent to-transparent p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sky-500">
                <Droplets className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Water intake
                </span>
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                {waterPct}% of goal
              </span>
            </div>

            <div>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {formatWaterAmount(waterTotalMl)}
                <span className="text-sm font-semibold text-muted-foreground">
                  {' '}
                  / {formatWaterAmount(dailyWaterGoalMl)}
                </span>
              </p>
              <div className="mt-2 h-2.5 rounded-full bg-muted/80 overflow-hidden">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all"
                  style={{ width: `${waterPct}%` }}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {WATER_QUICK_AMOUNTS_ML.map((ml) => (
                <button
                  key={ml}
                  type="button"
                  disabled={waterBusy}
                  onClick={() => void handleLogWater(ml)}
                  className="h-10 px-3.5 rounded-full bg-sky-500/15 border border-sky-500/25 text-xs font-bold text-sky-600 dark:text-sky-400 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  +{formatWaterAmount(ml)}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                const ml = Number(customWater)
                if (!ml) return
                void handleLogWater(ml).then(() => setCustomWater(''))
              }}
              className="flex gap-2"
            >
              <input
                value={customWater}
                onChange={(e) => setCustomWater(e.target.value.replace(/[^\d]/g, ''))}
                inputMode="numeric"
                placeholder="Custom ml"
                className="flex-1 h-11 bg-background/60 border border-border rounded-[14px] px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-sky-500"
              />
              <Button
                type="submit"
                disabled={waterBusy || !customWater}
                className="h-11 px-4 rounded-[14px] bg-sky-500 text-white font-bold border-0"
              >
                {waterBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
              </Button>
            </form>

            {waterNote && (
              <p className="text-[11px] text-sky-600 dark:text-sky-400 font-medium">
                {waterNote}
              </p>
            )}

            {todaysWater.length > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-border/50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Today&apos;s logs
                </p>
                {todaysWater.slice(0, 8).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-2 rounded-[12px] bg-background/50 border border-border/40 px-3 py-2"
                  >
                    <p className="text-xs text-foreground">
                      <span className="font-bold">{formatWaterAmount(entry.amountMl)}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        · {format(new Date(entry.createdAt), 'h:mm a')}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleRemoveWater(entry.id)}
                      className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 cursor-pointer"
                      aria-label="Remove water log"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-0.5">
              Logged today
            </h2>

            {todaysMeals.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-border p-8 text-center space-y-2">
                <UtensilsCrossed className="w-8 h-8 text-muted-foreground mx-auto opacity-60" />
                <p className="text-sm font-bold text-foreground">No meals yet</p>
                <p className="text-xs text-muted-foreground">
                  Snap a photo or log macros manually.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {todaysMeals.map((meal) => {
                  const Icon = TYPE_ICON[meal.type]
                  const confirming = pendingDeleteId === meal.id
                  return (
                    <div
                      key={meal.id}
                      className="bg-card border border-border rounded-[20px] p-4 flex gap-3 items-start"
                    >
                      {meal.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={meal.imageUrl}
                          alt=""
                          className="w-10 h-10 rounded-xl object-cover border border-border shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">
                              {meal.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {MEAL_TYPE_LABELS[meal.type]}
                              {' · '}
                              {format(new Date(meal.createdAt), 'h:mm a')}
                            </p>
                          </div>
                          {confirming ? (
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  deleteMeal(meal.id)
                                  setPendingDeleteId(null)
                                }}
                                className="h-8 px-2.5 rounded-xl bg-destructive text-white text-[10px] font-bold cursor-pointer"
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDeleteId(null)}
                                className="h-8 px-2.5 rounded-xl bg-muted text-muted-foreground text-[10px] font-bold cursor-pointer"
                              >
                                Keep
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPendingDeleteId(meal.id)}
                              className="p-2 rounded-xl text-destructive hover:bg-destructive/10 cursor-pointer"
                              aria-label="Delete meal"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-muted-foreground">
                          <span>
                            <span className="font-bold text-foreground">{meal.calories}</span> kcal
                          </span>
                          <span>
                            <span className="font-bold text-foreground">{meal.proteinG}g</span> P
                          </span>
                          <span>
                            <span className="font-bold text-foreground">{meal.carbsG}g</span> C
                          </span>
                          <span>
                            <span className="font-bold text-foreground">{meal.fatG}g</span> F
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
