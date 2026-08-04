'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Plus,
  Star,
  ChevronRight,
  Trash2,
  Dumbbell,
  Coffee,
  Copy,
} from 'lucide-react'
import { usePlanStore } from '@/stores/planStore'
import { WEEKDAY_LABELS } from '@/data/exercises'
import { RepeatDayModal } from '@/components/plans/RepeatDayModal'

export default function PlanDetailPage() {
  const { planId } = useParams<{ planId: string }>()
  const router = useRouter()
  const plan = usePlanStore((s) => s.plans.find((p) => p.id === planId))
  const setActivePlan = usePlanStore((s) => s.setActivePlan)
  const updatePlan = usePlanStore((s) => s.updatePlan)
  const addDay = usePlanStore((s) => s.addDay)
  const updateDay = usePlanStore((s) => s.updateDay)
  const deleteDay = usePlanStore((s) => s.deleteDay)
  const deletePlan = usePlanStore((s) => s.deletePlan)
  const repeatDayToDays = usePlanStore((s) => s.repeatDayToDays)

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [showAddDay, setShowAddDay] = useState(false)
  const [dayName, setDayName] = useState('')
  const [muscleFocus, setMuscleFocus] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState<number | ''>('')
  const [repeatSourceDayId, setRepeatSourceDayId] = useState<string | null>(null)

  const sortedDays = useMemo(
    () => (plan ? [...plan.days].sort((a, b) => a.order - b.order) : []),
    [plan]
  )

  const repeatSourceDay = useMemo(
    () => (repeatSourceDayId ? sortedDays.find((d) => d.id === repeatSourceDayId) ?? null : null),
    [repeatSourceDayId, sortedDays]
  )

  const repeatOtherDays = useMemo(
    () => (repeatSourceDayId ? sortedDays.filter((d) => d.id !== repeatSourceDayId) : []),
    [repeatSourceDayId, sortedDays]
  )

  const repeatMode =
    repeatSourceDay && repeatSourceDay.exercises.length > 0 ? 'spread' : 'fill'

  if (!plan) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Plan not found.</p>
        <button
          type="button"
          onClick={() => router.push('/plans')}
          className="text-sm font-bold text-primary"
        >
          Back to plans
        </button>
      </div>
    )
  }

  const handleAddDay = () => {
    if (!dayName.trim() && dayOfWeek === '') return
    const name =
      dayName.trim() ||
      (typeof dayOfWeek === 'number' ? WEEKDAY_LABELS[dayOfWeek - 1] : `Day ${plan.days.length + 1}`)
    const id = addDay({
      planId: plan.id,
      name,
      muscleFocus,
      dayOfWeek: typeof dayOfWeek === 'number' ? dayOfWeek : null,
    })
    setShowAddDay(false)
    setDayName('')
    setMuscleFocus('')
    setDayOfWeek('')
    router.push(`/plans/${plan.id}/days/${id}`)
  }

  const markAsRestDay = (dayId: string) => {
    updateDay(plan.id, dayId, {
      isRestDay: true,
      name: 'Rest Day',
      muscleFocus: 'Rest',
    })
  }

  const unmarkRestDay = (dayId: string, dayOfWeekValue: number | null) => {
    updateDay(plan.id, dayId, {
      isRestDay: false,
      name:
        dayOfWeekValue != null
          ? WEEKDAY_LABELS[dayOfWeekValue - 1] ?? 'Workout Day'
          : 'Workout Day',
      muscleFocus: '',
    })
  }

  return (
    <div className="p-5 space-y-5 pb-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.push('/plans')}
            className="p-2 bg-card border border-border rounded-xl text-foreground cursor-pointer active:scale-95 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
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
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
                className="w-full bg-transparent text-xl font-bold text-foreground outline-none border-b border-primary"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setNameDraft(plan.name)
                  setEditingName(true)
                }}
                className="text-xl font-bold text-foreground tracking-tight truncate text-left cursor-pointer"
              >
                {plan.name}
              </button>
            )}
            <p className="text-xs text-muted-foreground truncate">
              {plan.description || 'Tap name to rename'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {!plan.isActive ? (
          <button
            type="button"
            onClick={() => setActivePlan(plan.id)}
            className="flex-1 h-11 rounded-[16px] bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Star className="w-4 h-4" />
            Set as Active Plan
          </button>
        ) : (
          <div className="flex-1 h-11 rounded-[16px] bg-primary/15 border border-primary/25 text-primary text-sm font-bold flex items-center justify-center gap-1.5">
            Active Plan
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            if (confirm(`Delete "${plan.name}"?`)) {
              deletePlan(plan.id)
              router.replace('/plans')
            }
          }}
          className="h-11 w-11 rounded-[16px] bg-destructive/10 text-destructive flex items-center justify-center cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between px-0.5">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Workout Days
        </h2>
        <button
          type="button"
          onClick={() => setShowAddDay((v) => !v)}
          className="text-xs font-bold text-primary flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Day
        </button>
      </div>

      {showAddDay && (
        <div className="bg-card border border-border rounded-[24px] p-4 space-y-3">
          <input
            value={dayName}
            onChange={(e) => setDayName(e.target.value)}
            placeholder="Day name (e.g. Monday)"
            className="w-full h-11 bg-muted border border-border rounded-[16px] px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
          <input
            value={muscleFocus}
            onChange={(e) => setMuscleFocus(e.target.value)}
            placeholder="Muscle focus (e.g. Chest + Triceps)"
            className="w-full h-11 bg-muted border border-border rounded-[16px] px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
          <select
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(e.target.value ? Number(e.target.value) : '')}
            className="w-full h-11 bg-muted border border-border rounded-[16px] px-3 text-sm text-foreground focus:outline-none focus:border-primary"
          >
            <option value="">No weekday link</option>
            {WEEKDAY_LABELS.map((label, i) => (
              <option key={label} value={i + 1}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddDay}
            className="w-full h-11 rounded-[16px] bg-primary text-primary-foreground font-bold text-sm cursor-pointer"
          >
            Add Day
          </button>
        </div>
      )}

      {sortedDays.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-border p-8 text-center space-y-2">
          <Dumbbell className="w-7 h-7 text-muted-foreground mx-auto" />
          <p className="text-sm font-semibold text-foreground">No days yet</p>
          <p className="text-xs text-muted-foreground">Add Monday, Push Day, or any custom day.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedDays.map((day) => {
            const showRestMark = day.exercises.length === 0 && !day.isRestDay

            return (
              <div
                key={day.id}
                className={`bg-card border rounded-[24px] overflow-hidden ${
                  day.isRestDay ? 'border-sky-500/30' : 'border-border'
                }`}
              >
                <button
                  type="button"
                  onClick={() => router.push(`/plans/${plan.id}/days/${day.id}`)}
                  className="w-full p-4 flex items-center justify-between gap-3 text-left cursor-pointer hover:bg-muted/60"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-foreground">{day.name}</h3>
                      {day.dayOfWeek && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                          {WEEKDAY_LABELS[day.dayOfWeek - 1]?.slice(0, 3)}
                        </span>
                      )}
                      {day.isRestDay && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 border border-sky-500/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-500">
                          <Coffee className="w-3 h-3" />
                          Rest
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-primary font-semibold">
                      {day.isRestDay
                        ? 'Recovery · no training'
                        : day.muscleFocus || 'No muscle focus'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {day.isRestDay
                        ? 'Rest day'
                        : `${day.exercises.length} exercise${day.exercises.length === 1 ? '' : 's'}${
                            day.exercises.length > 0
                              ? ` · ${day.exercises
                                  .slice(0, 2)
                                  .map((e) => e.name)
                                  .join(', ')}${day.exercises.length > 2 ? '…' : ''}`
                              : ''
                          }`}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
                <div className="px-4 pb-3 flex items-center gap-3 flex-wrap">
                  {sortedDays.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setRepeatSourceDayId(day.id)
                      }}
                      className="h-8 px-3 rounded-full bg-muted border border-border text-[11px] font-bold text-foreground flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Repeat day
                    </button>
                  )}
                  {showRestMark && (
                    <button
                      type="button"
                      onClick={() => markAsRestDay(day.id)}
                      className="h-8 px-3 rounded-full bg-sky-500/15 border border-sky-500/25 text-[11px] font-bold text-sky-500 flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Coffee className="w-3.5 h-3.5" />
                      Mark as rest day
                    </button>
                  )}
                  {day.isRestDay && day.exercises.length === 0 && (
                    <button
                      type="button"
                      onClick={() => unmarkRestDay(day.id, day.dayOfWeek)}
                      className="text-[11px] font-semibold text-muted-foreground cursor-pointer"
                    >
                      Unmark rest day
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Remove ${day.name}?`)) deleteDay(plan.id, day.id)
                    }}
                    className="text-[11px] font-semibold text-destructive cursor-pointer"
                  >
                    Remove day
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <RepeatDayModal
        open={repeatSourceDayId != null}
        onOpenChange={(open) => {
          if (!open) setRepeatSourceDayId(null)
        }}
        anchorDay={repeatSourceDay}
        otherDays={repeatOtherDays}
        mode={repeatMode}
        onConfirm={(selectedIds) => {
          if (!repeatSourceDayId) return
          if (repeatMode === 'spread') {
            repeatDayToDays(plan.id, repeatSourceDayId, selectedIds)
          } else {
            const fromId = selectedIds[0]
            if (fromId) repeatDayToDays(plan.id, fromId, [repeatSourceDayId])
          }
          setRepeatSourceDayId(null)
        }}
      />
    </div>
  )
}
