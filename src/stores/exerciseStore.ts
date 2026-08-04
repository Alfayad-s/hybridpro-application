'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  buildCustomExercise,
  DEFAULT_EXERCISE_IMAGE,
  getMuscleGroupDefaults,
  withNormalizedAnatomy,
  type BuiltInMuscleGroup,
  type CatalogExercise,
  type CreateExerciseInput,
} from '@/data/exercises'

const STORAGE_KEY = 'gymtrack-custom-exercises'

export type ExerciseMediaOverride = {
  imageUrl?: string
  videoUrl?: string
}

type ExerciseState = {
  exercises: CatalogExercise[]
  /** Demo photo/video overrides for built-in (and any) catalog ids. */
  mediaOverrides: Record<string, ExerciseMediaOverride>
  createExercise: (input: CreateExerciseInput) => string
  updateExercise: (id: string, input: CreateExerciseInput) => void
  /** Patch demo image/video. Custom exercises update in place; built-ins use mediaOverrides. */
  setExerciseMedia: (id: string, media: { imageUrl?: string; videoUrl?: string }) => void
  deleteExercise: (id: string) => void
  reassignMuscleGroup: (
    fromGroup: string,
    toGroup: string,
    anatomyBaseGroup?: BuiltInMuscleGroup
  ) => void
  getById: (id: string) => CatalogExercise | undefined
}

export const useExerciseStore = create<ExerciseState>()(
  persist(
    (set, get) => ({
      exercises: [],
      mediaOverrides: {},

      createExercise: (input) => {
        const exercise = buildCustomExercise(input)
        set((state) => ({ exercises: [exercise, ...state.exercises] }))
        return exercise.id
      },

      updateExercise: (id, input) => {
        set((state) => ({
          exercises: state.exercises.map((ex) =>
            ex.id === id ? buildCustomExercise(input, id) : ex
          ),
        }))
      },

      setExerciseMedia: (id, media) => {
        set((state) => {
          const customIdx = state.exercises.findIndex((e) => e.id === id)
          if (customIdx >= 0) {
            const next = [...state.exercises]
            const ex: CatalogExercise = { ...next[customIdx] }
            if (media.imageUrl !== undefined) {
              ex.imageUrl = media.imageUrl.trim() || DEFAULT_EXERCISE_IMAGE
            }
            if (media.videoUrl !== undefined) {
              const v = media.videoUrl.trim()
              if (v) ex.videoUrl = v
              else delete ex.videoUrl
            }
            next[customIdx] = ex
            return { exercises: next }
          }

          const prev = state.mediaOverrides[id] ?? {}
          const nextOverride: ExerciseMediaOverride = { ...prev }
          if (media.imageUrl !== undefined) {
            const img = media.imageUrl.trim()
            if (img && img !== DEFAULT_EXERCISE_IMAGE) nextOverride.imageUrl = img
            else delete nextOverride.imageUrl
          }
          if (media.videoUrl !== undefined) {
            const v = media.videoUrl.trim()
            if (v) nextOverride.videoUrl = v
            else delete nextOverride.videoUrl
          }

          const mediaOverrides = { ...state.mediaOverrides }
          if (!nextOverride.imageUrl && !nextOverride.videoUrl) {
            delete mediaOverrides[id]
          } else {
            mediaOverrides[id] = nextOverride
          }
          return { mediaOverrides }
        })
      },

      deleteExercise: (id) => {
        set((state) => ({
          exercises: state.exercises.filter((ex) => ex.id !== id),
        }))
      },

      reassignMuscleGroup: (fromGroup, toGroup, anatomyBaseGroup) =>
        set((state) => ({
          exercises: state.exercises.map((exercise) => {
            if (exercise.muscleGroup !== fromGroup) return exercise
            const anatomy = anatomyBaseGroup
              ? getMuscleGroupDefaults(anatomyBaseGroup)
              : null
            return {
              ...exercise,
              muscleGroup: toGroup,
              ...(anatomy
                ? {
                    anatomy: {
                      view: anatomy.view,
                      primary: [...anatomy.primary],
                      secondary: [...anatomy.secondary],
                    },
                  }
                : {}),
            }
          }),
        })),

      getById: (id) => get().exercises.find((ex) => ex.id === id),
    }),
    {
      name: STORAGE_KEY,
      version: 3,
      migrate: (persisted) => {
        const state = persisted as {
          exercises?: CatalogExercise[]
          mediaOverrides?: Record<string, ExerciseMediaOverride>
        }
        if (!state?.exercises) {
          return { exercises: [], mediaOverrides: state?.mediaOverrides ?? {} }
        }
        return {
          exercises: state.exercises.map(withNormalizedAnatomy),
          mediaOverrides: state.mediaOverrides ?? {},
        }
      },
    }
  )
)

/** Read custom exercises outside React (e.g. muscle recovery helpers). */
export function getCustomExercisesSnapshot(): CatalogExercise[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { state?: { exercises?: CatalogExercise[] } }
    return parsed.state?.exercises ?? []
  } catch {
    return []
  }
}

export function getMediaOverridesSnapshot(): Record<string, ExerciseMediaOverride> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as {
      state?: { mediaOverrides?: Record<string, ExerciseMediaOverride> }
    }
    return parsed.state?.mediaOverrides ?? {}
  } catch {
    return {}
  }
}
