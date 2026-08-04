'use client'

import { useMemo } from 'react'
import { DEFAULT_EXERCISE_IMAGE, getExerciseById } from '@/data/exercises'
import { resolveExerciseVideoPreview } from '@/lib/exercise-media'
import { ExerciseVideoPreview } from '@/components/exercises/ExerciseVideoPreview'
import { useExerciseStore } from '@/stores/exerciseStore'

type WorkoutExerciseMediaBackdropProps = {
  exerciseId?: string | null
  /** When false, backdrop is hidden (e.g. while demo sheet is open). */
  active?: boolean
}

function hasShowableImage(imageUrl: string | undefined): boolean {
  if (!imageUrl?.trim()) return false
  return imageUrl.trim() !== DEFAULT_EXERCISE_IMAGE
}

export function WorkoutExerciseMediaBackdrop({
  exerciseId,
  active = true,
}: WorkoutExerciseMediaBackdropProps) {
  const customExercises = useExerciseStore((s) => s.exercises)
  const mediaOverrides = useExerciseStore((s) => s.mediaOverrides)

  const media = useMemo(() => {
    if (!exerciseId) return null
    const exercise = getExerciseById(exerciseId, customExercises, mediaOverrides)
    if (!exercise) return null

    const videoUrl = exercise.videoUrl?.trim()
    const video = videoUrl ? resolveExerciseVideoPreview(videoUrl) : null
    const imageUrl = hasShowableImage(exercise.imageUrl) ? exercise.imageUrl : null

    if (video) return { kind: 'video' as const, url: videoUrl! }
    if (imageUrl) return { kind: 'image' as const, url: imageUrl }
    return null
  }, [exerciseId, customExercises, mediaOverrides])

  if (!active || !media) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      {media.kind === 'video' ? (
        <ExerciseVideoPreview
          url={media.url}
          fill
          controls={false}
          autoPlay
          muted
          loop
          className="absolute inset-0"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover scale-105"
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-background/92 via-background/82 to-background/96" />
      <div className="absolute inset-0 bg-background/25 backdrop-blur-[1px]" />
    </div>
  )
}
