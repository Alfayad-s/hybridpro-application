'use client'

import { useMemo } from 'react'
import { DEFAULT_EXERCISE_IMAGE, getExerciseById } from '@/data/exercises'
import {
  ExerciseVideoPreview,
  hasExerciseVideoPreview,
} from '@/components/exercises/ExerciseVideoPreview'
import { useExerciseStore } from '@/stores/exerciseStore'

type WorkoutNextExercisePreviewProps = {
  exerciseId: string
  name: string
  equipment?: string
  setLabel: string
}

export function WorkoutNextExercisePreview({
  exerciseId,
  name,
  equipment,
  setLabel,
}: WorkoutNextExercisePreviewProps) {
  const customExercises = useExerciseStore((s) => s.exercises)
  const mediaOverrides = useExerciseStore((s) => s.mediaOverrides)

  const exercise = useMemo(
    () => getExerciseById(exerciseId, customExercises, mediaOverrides),
    [exerciseId, customExercises, mediaOverrides]
  )

  const videoUrl = exercise?.videoUrl?.trim()
  const hasVideo = hasExerciseVideoPreview(videoUrl)
  const imageUrl =
    exercise?.imageUrl && exercise.imageUrl !== DEFAULT_EXERCISE_IMAGE
      ? exercise.imageUrl
      : null

  return (
    <div className="w-full max-w-sm mt-8 rounded-[20px] border border-border/80 bg-card/90 backdrop-blur-sm overflow-hidden shadow-lg">
      <div className="px-4 py-3 border-b border-border/60">
        <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Up next</p>
        <p className="text-base font-bold text-foreground mt-0.5 truncate">{name}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {setLabel}
          {equipment ? ` · ${equipment}` : ''}
        </p>
      </div>

      {(hasVideo || imageUrl) && (
        <div className="relative aspect-video bg-black">
          {hasVideo && videoUrl ? (
            <ExerciseVideoPreview url={videoUrl} title={`${name} preview`} />
          ) : imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
      )}
    </div>
  )
}
