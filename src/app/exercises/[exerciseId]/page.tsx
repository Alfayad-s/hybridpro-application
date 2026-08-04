'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, Dumbbell, ImagePlus, Pencil, Trash2 } from 'lucide-react'
import { getExerciseById, toLegacyExercise } from '@/data/exercises'
import { ExerciseVideoPreview } from '@/components/exercises/ExerciseVideoPreview'
import { ExerciseAddDemoSheet } from '@/components/exercises/ExerciseAddDemoSheet'
import { MuscleFocusPreview } from '@/components/muscle-map'
import { useWorkoutStore } from '@/stores/workoutStore'
import { useExerciseStore } from '@/stores/exerciseStore'
import { Button } from '@/components/ui/button'

const DIFFICULTY_STYLE = {
  beginner: 'text-primary bg-primary/10 border-primary/20',
  intermediate: 'text-warning bg-warning/10 border-warning/20',
  advanced: 'text-destructive bg-destructive/10 border-destructive/20',
} as const

function useExerciseStoreHydrated() {
  const [hydrated, setHydrated] = useState(() => {
    if (typeof window === 'undefined') return false
    return useExerciseStore.persist?.hasHydrated?.() ?? false
  })

  useEffect(() => {
    if (useExerciseStore.persist?.hasHydrated?.()) {
      setHydrated(true)
      return
    }
    const unsub = useExerciseStore.persist?.onFinishHydration?.(() => setHydrated(true))
    const fallback = setTimeout(() => setHydrated(true), 800)
    return () => {
      unsub?.()
      clearTimeout(fallback)
    }
  }, [])

  return hydrated
}

export default function ExerciseDetailPage() {
  const params = useParams<{ exerciseId: string }>()
  const exerciseId = decodeURIComponent(
    Array.isArray(params.exerciseId) ? params.exerciseId[0] : params.exerciseId || ''
  )
  const router = useRouter()
  const storeHydrated = useExerciseStoreHydrated()
  const customExercises = useExerciseStore((s) => s.exercises)
  const mediaOverrides = useExerciseStore((s) => s.mediaOverrides)
  const deleteExercise = useExerciseStore((s) => s.deleteExercise)
  const exercise = useMemo(
    () => (exerciseId ? getExerciseById(exerciseId, customExercises, mediaOverrides) : undefined),
    [exerciseId, customExercises, mediaOverrides]
  )
  const { activeSession } = useWorkoutStore()
  const [showDelete, setShowDelete] = useState(false)
  const [addDemoOpen, setAddDemoOpen] = useState(false)
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => {
    setPortalReady(true)
  }, [])

  if (!storeHydrated) {
    return (
      <div className="p-6 space-y-4 animate-pulse" aria-busy="true" aria-label="Loading exercise">
        <div className="h-52 rounded-[20px] bg-muted/80" />
        <div className="h-6 w-48 rounded-lg bg-muted/80" />
        <div className="h-4 w-full rounded-lg bg-muted/80" />
        <div className="h-4 w-3/4 rounded-lg bg-muted/80" />
      </div>
    )
  }

  if (!exercise) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Exercise not found.</p>
        <button
          type="button"
          onClick={() => router.push('/exercises')}
          className="text-sm font-bold text-primary cursor-pointer"
        >
          Back to library
        </button>
      </div>
    )
  }

  const handleAddToWorkout = () => {
    const legacy = toLegacyExercise(exercise)
    const workout = useWorkoutStore.getState()
    if (!workout.activeSession) {
      workout.startWorkout('Custom Workout', [
        {
          exerciseId: legacy.id,
          name: legacy.name,
          categoryName: legacy.category,
          equipment: legacy.equipment,
          targetSets: 3,
          targetReps: 10,
          restSeconds: 90,
        },
      ])
    } else {
      workout.addExercise(legacy.id, legacy.name, legacy.category, legacy.equipment, {
        targetSets: 3,
        targetReps: 10,
        restSeconds: 90,
      })
    }
    router.push('/workout')
  }

  const handleDelete = () => {
    if (!exercise.isCustom) return
    deleteExercise(exercise.id)
    setShowDelete(false)
    router.push('/exercises')
  }

  return (
    <div className="pb-8">
      <div className="relative h-52 overflow-hidden">
        <Image
          src={exercise.imageUrl}
          alt={exercise.name}
          fill
          className="object-cover opacity-70"
          sizes="430px"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <button
          type="button"
          onClick={() => router.back()}
          className="absolute top-4 left-4 p-2 rounded-xl bg-[var(--overlay)] border border-border text-foreground cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        {exercise.isCustom && (
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              type="button"
              onClick={() => router.push(`/exercises/${exercise.id}/edit`)}
              className="p-2 rounded-xl bg-[var(--overlay)] border border-border text-foreground cursor-pointer"
              aria-label="Edit exercise"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="p-2 rounded-xl bg-destructive/20 border border-destructive/30 text-destructive cursor-pointer"
              aria-label="Delete exercise"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="px-5 -mt-10 relative space-y-5">
        <div className="flex gap-4 items-end">
          <div className="w-32 h-32 rounded-[24px] bg-card border border-border p-3 shadow-xl shrink-0">
            <MuscleFocusPreview
              view={exercise.anatomy.view}
              primary={exercise.anatomy.primary}
              secondary={exercise.anatomy.secondary}
              className="w-full h-full"
              size="detail"
            />
          </div>
          <div className="pb-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">{exercise.name}</h1>
              {exercise.isCustom && (
                <span className="rounded-full bg-primary/15 border border-primary/25 px-2 py-0.5 text-[9px] font-bold text-primary uppercase shrink-0">
                  Custom
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {exercise.equipment} · {exercise.muscleGroup}
            </p>
            <span
              className={`inline-flex mt-2 rounded-full border px-2.5 py-0.5 text-[10px] font-bold capitalize ${DIFFICULTY_STYLE[exercise.difficulty]}`}
            >
              {exercise.difficulty}
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-[24px] p-4 space-y-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target</p>
            <p className="text-sm font-bold text-primary mt-1">{exercise.target}</p>
          </div>
          {exercise.secondary.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Secondary
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {exercise.secondary.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-muted border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {exercise.videoUrl ? (
          <div className="space-y-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Demo video
            </h2>
            <div className="rounded-[20px] overflow-hidden border border-border aspect-video">
              <ExerciseVideoPreview
                url={exercise.videoUrl}
                title={`${exercise.name} demo`}
              />
            </div>
            <button
              type="button"
              onClick={() => setAddDemoOpen(true)}
              className="text-xs font-semibold text-primary cursor-pointer"
            >
              Edit demo media
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddDemoOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-[20px] border border-dashed border-border bg-card px-4 py-5 text-sm font-semibold text-foreground cursor-pointer active:scale-[0.99]"
          >
            <ImagePlus className="w-4 h-4 text-primary" />
            Add demo photo or video
          </button>
        )}

        <div className="space-y-3">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Instructions
          </h2>
          {exercise.instructions.length === 0 ? (
            <p className="text-sm text-muted-foreground bg-card border border-border rounded-[18px] p-4">
              No instructions added yet.
            </p>
          ) : (
            <ol className="space-y-2.5">
              {exercise.instructions.map((step, i) => (
                <li
                  key={i}
                  className="flex gap-3 bg-card border border-border rounded-[18px] p-3.5"
                >
                  <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <p className="text-sm text-foreground/90 leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          )}
        </div>

        {activeSession && (
          <button
            type="button"
            onClick={handleAddToWorkout}
            className="w-full h-[52px] rounded-[20px] bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <Dumbbell className="w-4 h-4" />
            Add to Workout
          </button>
        )}
      </div>

      {portalReady &&
        showDelete &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[var(--overlay)] backdrop-blur-sm">
            <div className="w-full sm:max-w-[430px] bg-card border-t border-border rounded-t-[28px] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-4 shadow-2xl">
              <div>
                <h3 className="text-lg font-bold text-foreground">Delete exercise?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  &ldquo;{exercise.name}&rdquo; will be removed from your library. This cannot be undone.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowDelete(false)}
                  className="flex-1 h-12 rounded-[16px] bg-muted hover:bg-muted/80 text-foreground border-0"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
                  className="flex-1 h-12 rounded-[16px] bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold border-0"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <ExerciseAddDemoSheet
        open={addDemoOpen}
        onOpenChange={setAddDemoOpen}
        exerciseId={exercise.id}
        exerciseName={exercise.name}
        initialImageUrl={exercise.imageUrl}
        initialVideoUrl={exercise.videoUrl}
      />
    </div>
  )
}
