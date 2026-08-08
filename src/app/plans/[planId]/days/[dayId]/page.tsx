'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowLeft,
  Plus,
  Search,
  Trash2,
  Minus,
  X,
  GripVertical,
} from 'lucide-react'
import { usePlanStore, type PlanExercise } from '@/stores/planStore'
import { toLegacyExercise } from '@/data/exercises'
import { MuscleFocusPreview } from '@/components/muscle-map'
import { useMergedExercises } from '@/hooks/useMergedExercises'
import { useMuscleGroups } from '@/hooks/useMuscleGroups'
import { reorderIds, useLongPressSortableSensors } from '@/lib/dnd'

export default function PlanDayEditorPage() {
  const { planId, dayId } = useParams<{ planId: string; dayId: string }>()
  const router = useRouter()

  const plan = usePlanStore((s) => s.plans.find((p) => p.id === planId))
  const day = plan?.days.find((d) => d.id === dayId)
  const updateDay = usePlanStore((s) => s.updateDay)
  const addExerciseToDay = usePlanStore((s) => s.addExerciseToDay)
  const updateDayExercise = usePlanStore((s) => s.updateDayExercise)
  const removeDayExercise = usePlanStore((s) => s.removeDayExercise)
  const reorderDayExercises = usePlanStore((s) => s.reorderDayExercises)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('All')
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const muscleGroups = useMuscleGroups()
  const sensors = useLongPressSortableSensors()

  useEffect(() => {
    if (!pickerOpen) return
    const main = document.querySelector('main')
    const prevOverflow = main instanceof HTMLElement ? main.style.overflow : ''
    if (main instanceof HTMLElement) main.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      if (main instanceof HTMLElement) main.style.overflow = prevOverflow
      document.body.style.overflow = ''
    }
  }, [pickerOpen])

  const categories = useMemo(
    () => ['All', ...muscleGroups.map((group) => group.name)],
    [muscleGroups]
  )

  const allExercises = useMergedExercises()

  const filtered = useMemo(() => {
    return allExercises.filter((ex) => {
      const matchesCategory = category === 'All' || ex.muscleGroup === category
      const q = search.toLowerCase()
      const matchesSearch =
        !q ||
        ex.name.toLowerCase().includes(q) ||
        ex.muscleGroup.toLowerCase().includes(q) ||
        ex.target.toLowerCase().includes(q) ||
        ex.equipment.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
  }, [search, category, allExercises])

  if (!plan || !day) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Day not found.</p>
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

  const assignedIds = new Set(day.exercises.map((e) => e.exerciseId))

  return (
    <div className="p-5 space-y-5 pb-10 relative">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(`/plans/${planId}`)}
          className="p-2 bg-card border border-border rounded-xl text-foreground cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground tracking-tight truncate">{day.name}</h1>
          <p className="text-xs text-muted-foreground truncate">{plan.name}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
            Day name
          </label>
          <input
            value={day.name}
            onChange={(e) => updateDay(planId, dayId, { name: e.target.value })}
            className="mt-1.5 w-full h-11 bg-muted border border-border rounded-[16px] px-3 text-sm text-foreground focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">
            Muscle focus
          </label>
          <input
            value={day.muscleFocus}
            onChange={(e) => updateDay(planId, dayId, { muscleFocus: e.target.value })}
            placeholder="e.g. Chest + Triceps"
            className="mt-1.5 w-full h-11 bg-muted border border-border rounded-[16px] px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Exercises ({day.exercises.length})
          </h2>
          {day.exercises.length > 1 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">Hold &amp; drag to reorder</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="text-xs font-bold text-primary flex items-center gap-1 cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Exercise
        </button>
      </div>

      {day.exercises.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-border p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-foreground">No exercises yet</p>
          <p className="text-xs text-muted-foreground">
            Add Bench Press, Incline Press, Cable Fly, and set sets × reps.
          </p>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="h-11 px-5 rounded-[16px] bg-primary text-primary-foreground font-bold text-sm cursor-pointer"
          >
            Add Exercise
          </button>
        </div>
      ) : (
        <DayExerciseSortableList
          exercises={[...day.exercises].sort((a, b) => a.order - b.order)}
          sensors={sensors}
          activeDragId={activeDragId}
          onDragStart={(event) => setActiveDragId(String(event.active.id))}
          onDragCancel={() => setActiveDragId(null)}
          onDragEnd={(event) => {
            const { active, over } = event
            setActiveDragId(null)
            if (!over || active.id === over.id) return
            const ids = [...day.exercises]
              .sort((a, b) => a.order - b.order)
              .map((ex) => ex.id)
            reorderDayExercises(planId, dayId, reorderIds(ids, active.id, over.id))
          }}
          onUpdate={(exId, fields) => updateDayExercise(planId, dayId, exId, fields)}
          onRemove={(exId) => removeDayExercise(planId, dayId, exId)}
        />
      )}

      {/* Exercise picker sheet */}
      {pickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center overflow-hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--overlay)]"
            aria-label="Close"
            onClick={() => setPickerOpen(false)}
          />
          <div className="relative w-full sm:max-w-[430px] max-h-[80vh] bg-muted border-t border-border rounded-t-[28px] p-5 flex flex-col gap-4 overflow-hidden scrollbar-hide">
            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-foreground">Add Exercise</h3>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="p-2 rounded-xl bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search exercises or muscles…"
                className="w-full h-11 bg-card border border-border rounded-[16px] pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div
              className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 shrink-0 scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`shrink-0 h-8 px-3 rounded-full text-xs font-bold cursor-pointer ${
                    category === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-2 pb-4 scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {filtered.map((ex) => {
                const added = assignedIds.has(ex.id)
                const legacy = toLegacyExercise(ex)
                return (
                  <button
                    key={ex.id}
                    type="button"
                    disabled={added}
                    onClick={() => {
                      addExerciseToDay({
                        planId,
                        dayId,
                        exerciseId: ex.id,
                        name: ex.name,
                        category: legacy.category,
                        equipment: ex.equipment,
                        primaryMuscle: legacy.primaryMuscle,
                        secondaryMuscles: legacy.secondaryMuscles,
                        targetSets: 3,
                        targetReps: 10,
                      })
                    }}
                    className={`w-full text-left rounded-[18px] border p-3 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      added
                        ? 'bg-primary/10 border-primary/20'
                        : 'bg-card border-border hover:bg-muted/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-background border border-border p-1.5 shrink-0">
                        <MuscleFocusPreview
                          view={ex.anatomy.view}
                          primary={ex.anatomy.primary}
                          secondary={ex.anatomy.secondary}
                          className="w-full h-full"
                          size="list"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground">{ex.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {ex.target}
                          {ex.secondary.length ? ` · ${ex.secondary.slice(0, 2).join(', ')}` : ''}
                        </p>
                      </div>
                      {added ? (
                        <span className="text-[10px] font-bold text-primary">Added</span>
                      ) : (
                        <Plus className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type ExerciseCardBodyProps = {
  ex: PlanExercise
  index: number
  isDragging?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  onUpdate: (
    fields: Partial<Pick<PlanExercise, 'targetSets' | 'targetReps'>>
  ) => void
  onRemove: () => void
}

function ExerciseCardBody({
  ex,
  index,
  isDragging,
  dragHandleProps,
  onUpdate,
  onRemove,
}: ExerciseCardBodyProps) {
  return (
    <div
      className={`bg-card border border-border rounded-[24px] p-4 space-y-3 ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-1 min-w-0 flex-1">
          <button
            type="button"
            className="mt-0.5 shrink-0 p-1.5 -ml-1 rounded-lg text-muted-foreground touch-none cursor-grab active:cursor-grabbing"
            aria-label="Hold to reorder"
            {...dragHandleProps}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground">{index + 1}</span>
              <h3 className="text-sm font-bold text-foreground truncate">{ex.name}</h3>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {ex.category} · {ex.equipment}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="rounded-full bg-primary/15 border border-primary/20 px-2 py-0.5 text-[9px] font-semibold text-primary capitalize">
                {ex.primaryMuscle}
              </span>
              {ex.secondaryMuscles.map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-muted border border-border px-2 py-0.5 text-[9px] font-semibold text-muted-foreground capitalize"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-2 rounded-xl text-destructive hover:bg-destructive/10 cursor-pointer"
          aria-label="Remove exercise"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted rounded-[16px] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Sets
          </p>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => onUpdate({ targetSets: Math.max(1, ex.targetSets - 1) })}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-lg font-bold text-foreground">{ex.targetSets}</span>
            <button
              type="button"
              onClick={() => onUpdate({ targetSets: Math.min(12, ex.targetSets + 1) })}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="bg-muted rounded-[16px] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Reps
          </p>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => onUpdate({ targetReps: Math.max(1, ex.targetReps - 1) })}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-lg font-bold text-foreground">{ex.targetReps}</span>
            <button
              type="button"
              onClick={() => onUpdate({ targetReps: Math.min(50, ex.targetReps + 1) })}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <p className="text-center text-sm font-semibold text-primary">
        {ex.targetSets} × {ex.targetReps}
      </p>
    </div>
  )
}

function SortableExerciseCard({
  ex,
  index,
  onUpdate,
  onRemove,
}: {
  ex: PlanExercise
  index: number
  onUpdate: (
    fields: Partial<Pick<PlanExercise, 'targetSets' | 'targetReps'>>
  ) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ex.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <ExerciseCardBody
        ex={ex}
        index={index}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
        onUpdate={onUpdate}
        onRemove={onRemove}
      />
    </div>
  )
}

function DayExerciseSortableList({
  exercises,
  sensors,
  activeDragId,
  onDragStart,
  onDragEnd,
  onDragCancel,
  onUpdate,
  onRemove,
}: {
  exercises: PlanExercise[]
  sensors: ReturnType<typeof useLongPressSortableSensors>
  activeDragId: string | null
  onDragStart: (event: DragStartEvent) => void
  onDragEnd: (event: DragEndEvent) => void
  onDragCancel: () => void
  onUpdate: (
    exId: string,
    fields: Partial<Pick<PlanExercise, 'targetSets' | 'targetReps'>>
  ) => void
  onRemove: (exId: string) => void
}) {
  const ids = exercises.map((ex) => ex.id)
  const activeEx = activeDragId ? exercises.find((ex) => ex.id === activeDragId) ?? null : null
  const activeIndex = activeEx ? exercises.findIndex((ex) => ex.id === activeEx.id) : -1

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {exercises.map((ex, index) => (
            <SortableExerciseCard
              key={ex.id}
              ex={ex}
              index={index}
              onUpdate={(fields) => onUpdate(ex.id, fields)}
              onRemove={() => onRemove(ex.id)}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeEx ? (
          <div className="scale-[1.02] shadow-xl rounded-[24px]">
            <ExerciseCardBody
              ex={activeEx}
              index={Math.max(0, activeIndex)}
              onUpdate={() => undefined}
              onRemove={() => undefined}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

