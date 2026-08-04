'use client'

import { useMemo } from 'react'
import { getAllExercises } from '@/data/exercises'
import { useExerciseStore } from '@/stores/exerciseStore'

export function useMergedExercises() {
  const customExercises = useExerciseStore((s) => s.exercises)
  const mediaOverrides = useExerciseStore((s) => s.mediaOverrides)
  return useMemo(
    () => getAllExercises(customExercises, mediaOverrides),
    [customExercises, mediaOverrides]
  )
}
