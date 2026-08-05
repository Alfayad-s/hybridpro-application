/**
 * Path data sourced from MuscleMap (MIT)
 * https://github.com/melihcolpan/MuscleMap
 */

export type MuscleId =
  | 'abs'
  | 'biceps'
  | 'calves'
  | 'chest'
  | 'deltoids'
  | 'feet'
  | 'forearm'
  | 'gluteal'
  | 'hamstring'
  | 'hands'
  | 'head'
  | 'hair'
  | 'knees'
  | 'lower-back'
  | 'obliques'
  | 'quadriceps'
  | 'tibialis'
  | 'trapezius'
  | 'triceps'
  | 'upper-back'
  | 'rotator-cuff'
  | 'serratus'
  | 'rhomboids'
  | 'ankles'
  | 'adductors'
  | 'neck'
  | 'hip-flexors'
  | 'upper-chest'
  | 'lower-chest'
  | 'inner-quad'
  | 'outer-quad'
  | 'upper-abs'
  | 'lower-abs'
  | 'front-deltoid'
  | 'rear-deltoid'
  | 'upper-trapezius'
  | 'lower-trapezius'

export type BodyPartPaths = {
  slug: MuscleId | string
  common: string[]
  left: string[]
  right: string[]
}

export type BodyPathSet = {
  viewBox: { x: number; y: number; width: number; height: number }
  parts: BodyPartPaths[]
}

export type MuscleHighlight = {
  color: string
  opacity?: number
}

export type MuscleHighlights = Partial<Record<MuscleId | string, MuscleHighlight | string>>

/** Workout focus → muscle ids (MuscleMap slugs) */
export const WORKOUT_MUSCLES = {
  chest: ['chest', 'upper-chest', 'lower-chest', 'serratus'] as const,
  back: ['upper-back', 'lower-back', 'trapezius', 'rhomboids'] as const,
  legs: ['quadriceps', 'inner-quad', 'outer-quad', 'hip-flexors', 'hamstring', 'calves', 'gluteal', 'adductors'] as const,
  shoulders: ['deltoids', 'front-deltoid', 'rear-deltoid'] as const,
  arms: ['biceps', 'triceps', 'forearm'] as const,
  abs: ['abs', 'upper-abs', 'lower-abs', 'obliques'] as const,
  'legs-abs': [
    'quadriceps',
    'inner-quad',
    'outer-quad',
    'hip-flexors',
    'hamstring',
    'calves',
    'gluteal',
    'adductors',
    'abs',
    'upper-abs',
    'lower-abs',
    'obliques',
  ] as const,
} as const

export type WorkoutFocus = keyof typeof WORKOUT_MUSCLES

export const MUSCLE_LABELS: Record<string, string> = {
  abs: 'Abs',
  biceps: 'Biceps',
  calves: 'Calves',
  chest: 'Chest',
  deltoids: 'Side Delts',
  feet: 'Feet',
  forearm: 'Forearms',
  gluteal: 'Glutes',
  hamstring: 'Hamstrings',
  hands: 'Hands',
  head: 'Head',
  hair: 'Hair',
  knees: 'Knees',
  'lower-back': 'Lower Back',
  obliques: 'Obliques',
  quadriceps: 'Quadriceps',
  tibialis: 'Tibialis',
  trapezius: 'Traps',
  triceps: 'Triceps',
  'upper-back': 'Lats / Upper Back',
  'rotator-cuff': 'Rotator Cuff',
  serratus: 'Serratus',
  rhomboids: 'Rhomboids',
  ankles: 'Ankles',
  adductors: 'Adductors',
  neck: 'Neck',
  'hip-flexors': 'Hip Flexors',
  'upper-chest': 'Upper Chest',
  'lower-chest': 'Lower Chest',
  'inner-quad': 'Inner Quad',
  'outer-quad': 'Outer Quad',
  'upper-abs': 'Upper Abs',
  'lower-abs': 'Lower Abs',
  'front-deltoid': 'Front Delts',
  'rear-deltoid': 'Rear Delts',
  'upper-trapezius': 'Upper Traps',
  'lower-trapezius': 'Lower Traps',
}

export function highlightsFromMuscles(
  muscles: readonly string[],
  color = 'var(--primary)',
  opacity = 0.95
): MuscleHighlights {
  return Object.fromEntries(muscles.map((m) => [m, { color, opacity }]))
}
