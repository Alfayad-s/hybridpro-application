'use client'

import { useEffect, useState } from 'react'
import { Drawer } from 'vaul'
import { Check, X } from 'lucide-react'
import { WEEKDAY_LABELS } from '@/data/exercises'
import type { PlanDay } from '@/stores/planStore'
import { Button } from '@/components/ui/button'

type RepeatDayModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Day the user tapped Repeat on */
  anchorDay: PlanDay | null
  /** Other days in the plan (exclude anchor). For fill mode, only days with exercises are useful. */
  otherDays: PlanDay[]
  /**
   * spread — anchor has a workout; pick target days to overwrite
   * fill — anchor is empty/rest; pick a day to copy onto the anchor
   */
  mode: 'spread' | 'fill'
  onConfirm: (selectedIds: string[]) => void
}

export function RepeatDayModal({
  open,
  onOpenChange,
  anchorDay,
  otherDays,
  mode,
  onConfirm,
}: RepeatDayModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const listDays =
    mode === 'fill' ? otherDays.filter((d) => d.exercises.length > 0) : otherDays

  useEffect(() => {
    if (open) setSelected(new Set())
  }, [open, anchorDay?.id, mode])

  const toggle = (dayId: string) => {
    setSelected((prev) => {
      if (mode === 'fill') {
        return new Set([dayId])
      }
      const next = new Set(prev)
      if (next.has(dayId)) next.delete(dayId)
      else next.add(dayId)
      return next
    })
  }

  const handleConfirm = () => {
    if (selected.size === 0) return
    onConfirm([...selected])
    onOpenChange(false)
  }

  const title =
    mode === 'fill'
      ? anchorDay
        ? `Copy onto “${anchorDay.name}”`
        : 'Copy onto day'
      : anchorDay
        ? `Repeat “${anchorDay.name}” onto…`
        : 'Repeat day'

  const subtitle =
    mode === 'fill'
      ? 'Pick a day whose workout will replace this day.'
      : 'Replaces exercises on the selected days with a copy of this workout.'

  const emptyMessage =
    mode === 'fill'
      ? 'No other days with exercises to copy from.'
      : 'No other days in this plan.'

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px]" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[70] mx-auto flex max-h-[85dvh] w-full flex-col rounded-t-[28px] border border-border bg-background outline-none sm:max-w-[430px]">
          <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-muted" />
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <Drawer.Title className="text-base font-bold text-foreground">{title}</Drawer.Title>
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
            <p className="text-xs text-muted-foreground">{subtitle}</p>

            {listDays.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{emptyMessage}</p>
            ) : (
              <ul className="space-y-2">
                {listDays.map((day) => {
                  const isOn = selected.has(day.id)
                  return (
                    <li key={day.id}>
                      <button
                        type="button"
                        onClick={() => toggle(day.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-[16px] border text-left cursor-pointer active:scale-[0.99] transition-colors ${
                          isOn
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-card hover:bg-muted/60'
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                            isOn
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-muted'
                          }`}
                          aria-hidden
                        >
                          {isOn ? <Check className="w-3 h-3" /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-foreground">{day.name}</span>
                            {day.dayOfWeek != null && (
                              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                {WEEKDAY_LABELS[day.dayOfWeek - 1]?.slice(0, 3)}
                              </span>
                            )}
                          </span>
                          <span className="block text-[11px] text-muted-foreground mt-0.5">
                            {day.isRestDay
                              ? 'Rest day'
                              : `${day.exercises.length} exercise${day.exercises.length === 1 ? '' : 's'}`}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 h-12"
                disabled={selected.size === 0}
                onClick={handleConfirm}
              >
                Repeat
              </Button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
