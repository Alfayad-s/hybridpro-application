'use client'

import { useState } from 'react'
import { Drawer } from 'vaul'
import { X } from 'lucide-react'
import { useMealStore } from '@/stores/mealStore'
import { Button } from '@/components/ui/button'

type MealGoalsSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MealGoalsSheet({ open, onOpenChange }: MealGoalsSheetProps) {
  const dailyCalorieGoal = useMealStore((s) => s.dailyCalorieGoal)
  const dailyProteinGoal = useMealStore((s) => s.dailyProteinGoal)
  const dailyCarbsGoal = useMealStore((s) => s.dailyCarbsGoal)
  const dailyFatGoal = useMealStore((s) => s.dailyFatGoal)
  const dailyWaterGoalMl = useMealStore((s) => s.dailyWaterGoalMl)
  const setGoals = useMealStore((s) => s.setGoals)

  const [calories, setCalories] = useState(String(dailyCalorieGoal))
  const [protein, setProtein] = useState(String(dailyProteinGoal))
  const [carbs, setCarbs] = useState(String(dailyCarbsGoal))
  const [fat, setFat] = useState(String(dailyFatGoal))
  const [water, setWater] = useState(String(dailyWaterGoalMl))

  const syncFromStore = () => {
    setCalories(String(useMealStore.getState().dailyCalorieGoal))
    setProtein(String(useMealStore.getState().dailyProteinGoal))
    setCarbs(String(useMealStore.getState().dailyCarbsGoal))
    setFat(String(useMealStore.getState().dailyFatGoal))
    setWater(String(useMealStore.getState().dailyWaterGoalMl))
  }

  const handleSave = () => {
    setGoals({
      dailyCalorieGoal: Math.max(500, Math.round(Number(calories) || dailyCalorieGoal)),
      dailyProteinGoal: Math.max(20, Math.round(Number(protein) || dailyProteinGoal)),
      dailyCarbsGoal: Math.max(20, Math.round(Number(carbs) || dailyCarbsGoal)),
      dailyFatGoal: Math.max(10, Math.round(Number(fat) || dailyFatGoal)),
      dailyWaterGoalMl: Math.max(500, Math.round(Number(water) || dailyWaterGoalMl)),
    })
    onOpenChange(false)
  }

  const inputClass =
    'w-full h-11 bg-muted border border-border rounded-[14px] px-3 text-sm text-foreground tabular-nums focus:outline-none focus:border-primary'

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (next) syncFromStore()
        onOpenChange(next)
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px]" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[70] mx-auto flex max-h-[85dvh] w-full flex-col rounded-t-[28px] border border-border bg-background outline-none sm:max-w-[430px]">
          <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-muted" />
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <Drawer.Title className="text-base font-bold text-foreground">
              Daily targets
            </Drawer.Title>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-xl text-muted-foreground cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 pb-6 space-y-3 overflow-y-auto">
            <p className="text-xs text-muted-foreground">
              Used for progress on Meals and challenges.
            </p>
            {(
              [
                { label: 'Calories (kcal)', value: calories, set: setCalories },
                { label: 'Protein (g)', value: protein, set: setProtein },
                { label: 'Carbs (g)', value: carbs, set: setCarbs },
                { label: 'Fat (g)', value: fat, set: setFat },
                { label: 'Water (ml)', value: water, set: setWater },
              ] as const
            ).map((field) => (
              <div key={field.label}>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
                  {field.label}
                </label>
                <input
                  inputMode="numeric"
                  value={field.value}
                  onChange={(e) => field.set(e.target.value)}
                  className={`mt-1.5 ${inputClass}`}
                />
              </div>
            ))}

            <Button type="button" className="w-full h-12 mt-2" onClick={handleSave}>
              Save targets
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
