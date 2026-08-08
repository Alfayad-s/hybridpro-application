'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  ArrowLeft,
  Plus,
  Star,
  ChevronRight,
  Trash2,
  Dumbbell,
  Coffee,
  Copy,
  GripVertical,
} from 'lucide-react'
import { usePlanStore, type PlanDay } from '@/stores/planStore'
import { WEEKDAY_LABELS } from '@/data/exercises'
import { RepeatDayModal } from '@/components/plans/RepeatDayModal'

function daySubtitle(day: PlanDay): string {
  if (day.isRestDay) return 'Recovery · no training'
  if (day.muscleFocus.trim()) return day.muscleFocus
  if (day.exercises.length === 0) return 'Empty · drop a workout here'
  return 'No muscle focus'
}

function dayMeta(day: PlanDay): string {
  if (day.isRestDay) return 'Rest day'
  if (day.exercises.length === 0) return 'Hold another day and drop it here'
  const preview = day.exercises
    .slice(0, 2)
    .map((e) => e.name)
    .join(', ')
  const more = day.exercises.length > 2 ? '…' : ''
  return `${day.exercises.length} exercise${day.exercises.length === 1 ? '' : 's'} · ${preview}${more}`
}

function isEmptyDay(day: PlanDay) {
  return !day.isRestDay && day.exercises.length === 0
}

type DayCardBodyProps = {
  day: PlanDay
  showRestMark: boolean
  canRepeat: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  /** Source slot while dragging — keep visible at low opacity */
  isDragging?: boolean
  /** Another workout is hovering this slot */
  isOver?: boolean
  onOpen: () => void
  onRepeat: () => void
  onMarkRest: () => void
  onUnmarkRest: () => void
  onRemove: () => void
}

function DayCardBody({
  day,
  showRestMark,
  canRepeat,
  dragHandleProps,
  isDragging,
  isOver,
  onOpen,
  onRepeat,
  onMarkRest,
  onUnmarkRest,
  onRemove,
}: DayCardBodyProps) {
  const empty = isEmptyDay(day)
  const isWeekday = day.dayOfWeek != null

  return (
    <div
      className={`overflow-hidden rounded-[20px] border transition-opacity ${
        day.isRestDay
          ? 'border-sky-500/30 bg-card'
          : empty
            ? 'border-dashed border-border bg-muted/30'
            : 'border-border bg-card'
      } ${isOver ? 'opacity-100 ring-2 ring-primary/45 border-primary/40' : ''} ${
        !isOver && (empty || isDragging) ? 'opacity-30' : 'opacity-100'
      }`}
    >
      <div className={`flex items-stretch ${empty ? 'min-h-[56px]' : ''}`}>
        <button
          type="button"
          className="shrink-0 px-2.5 flex items-center text-muted-foreground touch-none cursor-grab active:cursor-grabbing"
          aria-label="Hold to move workout to another day"
          {...dragHandleProps}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onOpen}
          className={`flex-1 min-w-0 text-left cursor-pointer hover:bg-muted/60 ${
            empty ? 'py-3 pr-3' : 'p-3.5 pr-3'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-foreground">{day.name}</h3>
                {day.isRestDay && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 border border-sky-500/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-500">
                    <Coffee className="w-3 h-3" />
                    Rest
                  </span>
                )}
                {empty && (
                  <span className="rounded-full bg-muted border border-border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Placeholder
                  </span>
                )}
              </div>
              <p
                className={`text-xs font-semibold ${
                  empty ? 'text-muted-foreground' : 'text-primary'
                }`}
              >
                {daySubtitle(day)}
              </p>
              {!empty && <p className="text-[11px] text-muted-foreground">{dayMeta(day)}</p>}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
        </button>
      </div>

      <div className="px-3 pb-2.5 flex items-center gap-1.5 flex-wrap border-t border-border/40 pt-2">
        {canRepeat && !empty && (
          <button
            type="button"
            onClick={onRepeat}
            className="h-7 px-2.5 rounded-full bg-muted border border-border text-[10px] font-bold text-foreground flex items-center gap-1 cursor-pointer active:scale-95"
          >
            <Copy className="w-3 h-3" />
            Repeat
          </button>
        )}
        {showRestMark && (
          <button
            type="button"
            onClick={onMarkRest}
            className="h-7 px-2.5 rounded-full bg-sky-500/15 border border-sky-500/25 text-[10px] font-bold text-sky-500 flex items-center gap-1 cursor-pointer active:scale-95"
          >
            <Coffee className="w-3 h-3" />
            Rest
          </button>
        )}
        {day.isRestDay && day.exercises.length === 0 && (
          <button
            type="button"
            onClick={onUnmarkRest}
            className="h-7 px-2.5 text-[10px] font-semibold text-muted-foreground cursor-pointer"
          >
            Unmark
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          disabled={isWeekday && empty}
          className="h-7 px-2.5 ml-auto text-[10px] font-semibold text-destructive cursor-pointer disabled:opacity-30 disabled:cursor-default"
        >
          {isWeekday ? 'Clear' : 'Remove'}
        </button>
      </div>
    </div>
  )
}

type DaySlotCardProps = {
  day: PlanDay
  showRestMark: boolean
  canRepeat: boolean
  onOpen: () => void
  onRepeat: () => void
  onMarkRest: () => void
  onUnmarkRest: () => void
  onRemove: () => void
}

/** Fixed weekday slot: droppable always, draggable via grip — list order never shifts. */
function DaySlotCard({
  day,
  showRestMark,
  canRepeat,
  onOpen,
  onRepeat,
  onMarkRest,
  onUnmarkRest,
  onRemove,
}: DaySlotCardProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: day.id })
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: day.id,
  })

  const setRefs = (node: HTMLElement | null) => {
    setDropRef(node)
    setDragRef(node)
  }

  return (
    <div ref={setRefs}>
      <DayCardBody
        day={day}
        showRestMark={showRestMark}
        canRepeat={canRepeat}
        isDragging={isDragging}
        isOver={isOver}
        dragHandleProps={{ ...attributes, ...listeners }}
        onOpen={onOpen}
        onRepeat={onRepeat}
        onMarkRest={onMarkRest}
        onUnmarkRest={onUnmarkRest}
        onRemove={onRemove}
      />
    </div>
  )
}

export default function PlanDetailPage() {
  const { planId } = useParams<{ planId: string }>()
  const router = useRouter()
  const plan = usePlanStore((s) => s.plans.find((p) => p.id === planId))
  const setActivePlan = usePlanStore((s) => s.setActivePlan)
  const updatePlan = usePlanStore((s) => s.updatePlan)
  const addDay = usePlanStore((s) => s.addDay)
  const updateDay = usePlanStore((s) => s.updateDay)
  const ensureWeekdaySlots = usePlanStore((s) => s.ensureWeekdaySlots)
  const swapDayWorkouts = usePlanStore((s) => s.swapDayWorkouts)
  const clearOrRemoveDay = usePlanStore((s) => s.clearOrRemoveDay)
  const deletePlan = usePlanStore((s) => s.deletePlan)
  const repeatDayToDays = usePlanStore((s) => s.repeatDayToDays)

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [showAddDay, setShowAddDay] = useState(false)
  const [dayName, setDayName] = useState('')
  const [muscleFocus, setMuscleFocus] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState<number | ''>('')
  const [repeatSourceDayId, setRepeatSourceDayId] = useState<string | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const suppressOpenRef = useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 250, tolerance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 6 },
    })
  )

  const weekdayKey = useMemo(() => {
    if (!plan) return ''
    return plan.days
      .map((d) => d.dayOfWeek)
      .filter((d): d is number => typeof d === 'number')
      .sort((a, b) => a - b)
      .join(',')
  }, [plan])

  useEffect(() => {
    if (!planId) return
    ensureWeekdaySlots(planId)
  }, [planId, weekdayKey, ensureWeekdaySlots])

  const sortedDays = useMemo(() => {
    if (!plan) return []
    const weekdays = plan.days
      .filter((d) => d.dayOfWeek != null)
      .sort((a, b) => (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0))
    const customs = plan.days
      .filter((d) => d.dayOfWeek == null)
      .sort((a, b) => a.order - b.order)
    return [...weekdays, ...customs]
  }, [plan])

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

  const activeDragDay = activeDragId
    ? sortedDays.find((d) => d.id === activeDragId) ?? null
    : null

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

    if (typeof dayOfWeek === 'number') {
      const existing = plan.days.find((d) => d.dayOfWeek === dayOfWeek)
      if (existing) {
        updateDay(plan.id, existing.id, {
          muscleFocus,
          isRestDay: false,
          name: WEEKDAY_LABELS[dayOfWeek - 1],
        })
        setShowAddDay(false)
        setDayName('')
        setMuscleFocus('')
        setDayOfWeek('')
        router.push(`/plans/${plan.id}/days/${existing.id}`)
        return
      }
    }

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
    const day = plan.days.find((d) => d.id === dayId)
    updateDay(plan.id, dayId, {
      isRestDay: true,
      name: day?.dayOfWeek != null ? WEEKDAY_LABELS[day.dayOfWeek - 1] : 'Rest Day',
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

  const openDay = (dayId: string) => {
    if (suppressOpenRef.current) {
      suppressOpenRef.current = false
      return
    }
    router.push(`/plans/${plan.id}/days/${dayId}`)
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    if (!over || active.id === over.id) return
    suppressOpenRef.current = true
    swapDayWorkouts(plan.id, String(active.id), String(over.id))
  }

  const handleDragCancel = () => {
    setActiveDragId(null)
  }

  const handleClearOrRemove = (day: PlanDay) => {
    const empty = isEmptyDay(day)
    if (day.dayOfWeek != null && empty) return
    const label =
      day.dayOfWeek != null
        ? `Clear ${day.name} back to an empty placeholder?`
        : `Remove ${day.name}?`
    if (confirm(label)) clearOrRemoveDay(plan.id, day.id)
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

      <div className="flex items-end justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Workout Days
          </h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Empty days stay at 30% · hold &amp; drop to move a workout
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddDay((v) => !v)}
          className="text-xs font-bold text-primary flex items-center gap-1 cursor-pointer shrink-0"
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
            placeholder="Day name (e.g. Push Day)"
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
            <option value="">Custom day (no weekday)</option>
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
            {typeof dayOfWeek === 'number' ? `Open ${WEEKDAY_LABELS[dayOfWeek - 1]}` : 'Add Day'}
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="space-y-2.5">
            {sortedDays.map((day) => {
              const showRestMark = day.exercises.length === 0 && !day.isRestDay
              return (
                <DaySlotCard
                  key={day.id}
                  day={day}
                  showRestMark={showRestMark}
                  canRepeat={sortedDays.length > 1}
                  onOpen={() => openDay(day.id)}
                  onRepeat={() => setRepeatSourceDayId(day.id)}
                  onMarkRest={() => markAsRestDay(day.id)}
                  onUnmarkRest={() => unmarkRestDay(day.id, day.dayOfWeek)}
                  onRemove={() => handleClearOrRemove(day)}
                />
              )
            })}
          </div>

          <DragOverlay>
            {activeDragDay ? (
              <div className="scale-[1.02] shadow-xl rounded-[20px] opacity-100">
                <DayCardBody
                  day={activeDragDay}
                  showRestMark={isEmptyDay(activeDragDay)}
                  canRepeat={sortedDays.length > 1}
                  onOpen={() => undefined}
                  onRepeat={() => undefined}
                  onMarkRest={() => undefined}
                  onUnmarkRest={() => undefined}
                  onRemove={() => undefined}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
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
