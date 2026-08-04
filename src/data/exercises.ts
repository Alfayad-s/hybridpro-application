import type { MuscleId } from '@/components/muscle-map/types'

export type ExerciseDifficulty = 'beginner' | 'intermediate' | 'advanced'

export type BuiltInMuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Arms'
  | 'Legs'
  | 'Core'
  | 'Glutes'
  | 'Full Body'

/** Built-in or user-created muscle group name. */
export type ExerciseMuscleGroup = string

/** Display labels for secondary muscles (UI) */
export type SecondaryMuscleLabel =
  | 'Front Delts'
  | 'Rear Delts'
  | 'Side Delts'
  | 'Triceps'
  | 'Biceps'
  | 'Forearms'
  | 'Upper Chest'
  | 'Lower Chest'
  | 'Lats'
  | 'Rhomboids'
  | 'Traps'
  | 'Lower Back'
  | 'Abs'
  | 'Obliques'
  | 'Quads'
  | 'Hamstrings'
  | 'Glutes'
  | 'Calves'
  | 'Hip Flexors'
  | 'Core'

export type CatalogExercise = {
  id: string
  name: string
  muscleGroup: ExerciseMuscleGroup
  /** Primary target display name */
  target: string
  secondary: SecondaryMuscleLabel[]
  equipment: string
  difficulty: ExerciseDifficulty
  /** Photo / Unsplash / CDN image for card hero */
  imageUrl: string
  /** Optional demo / form video (Cloudinary or direct URL) */
  videoUrl?: string
  instructions: string[]
  /** MuscleMap anatomy slugs to highlight (cropped preview) */
  anatomy: {
    view: 'front' | 'back'
    primary: MuscleId[]
    secondary: MuscleId[]
  }
  /** User-created exercise (editable / deletable) */
  isCustom?: boolean
}

export const EQUIPMENT_OPTIONS = [
  'Barbell',
  'Dumbbell',
  'Cable',
  'Machine',
  'Bodyweight',
  'Kettlebell',
  'Resistance Band',
  'Other',
] as const

export const DEFAULT_EXERCISE_IMAGE =
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=70'

/** Default anatomy mapping when creating a custom exercise */
export const MUSCLE_GROUP_DEFAULTS: Record<
  BuiltInMuscleGroup,
  { target: string; view: 'front' | 'back'; primary: MuscleId[]; secondary: MuscleId[] }
> = {
  Chest: { target: 'Chest', view: 'front', primary: ['chest'], secondary: ['front-deltoid', 'triceps'] },
  Back: { target: 'Back', view: 'back', primary: ['upper-back', 'lower-back'], secondary: ['biceps', 'rhomboids'] },
  Shoulders: { target: 'Shoulders', view: 'front', primary: ['deltoids', 'front-deltoid'], secondary: ['triceps'] },
  Arms: { target: 'Biceps', view: 'front', primary: ['biceps'], secondary: ['forearm'] },
  Legs: { target: 'Quads', view: 'front', primary: ['quadriceps'], secondary: ['gluteal', 'hamstring'] },
  Core: { target: 'Abs', view: 'front', primary: ['abs'], secondary: ['obliques'] },
  Glutes: { target: 'Glutes', view: 'back', primary: ['gluteal'], secondary: ['hamstring'] },
  'Full Body': { target: 'Full Body', view: 'front', primary: ['chest', 'quadriceps'], secondary: ['abs'] },
}

const FOREARM_ANATOMY = {
  target: 'Forearms',
  view: 'front' as const,
  primary: ['forearm'] as MuscleId[],
  secondary: ['biceps', 'hands'] as MuscleId[],
}

export function getMuscleGroupDefaults(group: string) {
  const key = group.trim().toLowerCase()
  if (key === 'forearms' || key === 'forearm' || key === 'grip') {
    return FOREARM_ANATOMY
  }
  return (
    MUSCLE_GROUP_DEFAULTS[group as BuiltInMuscleGroup] ??
    MUSCLE_GROUP_DEFAULTS['Full Body']
  )
}

export function anatomyDefaultsForExercise(name: string, muscleGroup: string, anatomyBaseGroup?: string) {
  const n = name.toLowerCase()
  if (/wrist|forearm|grip|pinch|farmer|roller|wrist.?curl/.test(n)) {
    return FOREARM_ANATOMY
  }
  return getMuscleGroupDefaults(anatomyBaseGroup ?? muscleGroup)
}

/** Repair outdated custom-exercise anatomy (e.g. forearm moves zoomed on torso). */
export function withNormalizedAnatomy(ex: CatalogExercise): CatalogExercise {
  const defaults = anatomyDefaultsForExercise(ex.name, ex.muscleGroup)
  const wantsForearm = defaults.primary.includes('forearm')
  const hasForearm = ex.anatomy.primary.includes('forearm')
  const groupIsForearm = /forearm/i.test(ex.muscleGroup)

  if (!wantsForearm && !groupIsForearm) return ex
  if (wantsForearm && hasForearm) return ex

  const next = groupIsForearm && !wantsForearm ? getMuscleGroupDefaults(ex.muscleGroup) : defaults
  return {
    ...ex,
    target: ex.target === 'Biceps' || ex.target === 'Back' || ex.target === 'Full Body' ? next.target : ex.target,
    anatomy: {
      view: next.view,
      primary: [...next.primary],
      secondary: [...next.secondary],
    },
  }
}

export type CreateExerciseInput = {
  name: string
  muscleGroup: ExerciseMuscleGroup
  anatomyBaseGroup?: BuiltInMuscleGroup
  target?: string
  equipment: string
  difficulty: ExerciseDifficulty
  instructions: string[]
  secondary?: string[]
  /** Custom photo URL (Cloudinary). Omit to keep default stock image. */
  imageUrl?: string
  /** Optional demo video URL (Cloudinary). */
  videoUrl?: string
}

export const EXERCISE_CATEGORIES = [
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Legs',
  'Core',
  'Glutes',
  'Full Body',
] as const satisfies readonly BuiltInMuscleGroup[]

const img = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`

export const EXERCISE_CATALOG: CatalogExercise[] = [
  // ─── Chest ───────────────────────────────────────────────
  {
    id: 'bench-press',
    name: 'Bench Press',
    muscleGroup: 'Chest',
    target: 'Chest',
    secondary: ['Front Delts', 'Triceps'],
    equipment: 'Barbell',
    difficulty: 'intermediate',
    imageUrl: img('photo-1571019614242-c5c5dee9f50b'),
    instructions: [
      'Lie flat on a bench with feet planted on the floor.',
      'Grip the bar slightly wider than shoulder-width.',
      'Unrack and lower the bar to mid-chest with control.',
      'Press up until arms are extended without locking hard.',
      'Keep shoulder blades pinched and wrists stacked over elbows.',
    ],
    anatomy: {
      view: 'front',
      primary: ['chest', 'upper-chest', 'lower-chest'],
      secondary: ['front-deltoid', 'triceps'],
    },
  },
  {
    id: 'incline-press',
    name: 'Incline Press',
    muscleGroup: 'Chest',
    target: 'Upper Chest',
    secondary: ['Front Delts', 'Triceps'],
    equipment: 'Barbell',
    difficulty: 'intermediate',
    imageUrl: img('photo-1517836357463-d25dfeac3438'),
    instructions: [
      'Set the bench to a 30–45° incline.',
      'Grip the bar just outside shoulder width.',
      'Lower to the upper chest, elbows ~45° from torso.',
      'Press explosively while keeping upper back tight.',
    ],
    anatomy: {
      view: 'front',
      primary: ['upper-chest', 'chest'],
      secondary: ['front-deltoid', 'triceps'],
    },
  },
  {
    id: 'incline-dumbbell-press',
    name: 'Incline Dumbbell Press',
    muscleGroup: 'Chest',
    target: 'Upper Chest',
    secondary: ['Front Delts', 'Triceps'],
    equipment: 'Dumbbells',
    difficulty: 'intermediate',
    imageUrl: img('photo-1581009146145-b5ef050c2e1e'),
    instructions: [
      'Sit on an incline bench holding dumbbells at shoulder height.',
      'Press both weights up until arms are nearly locked.',
      'Lower with control until elbows are below the chest line.',
      'Keep wrists neutral and avoid flaring elbows too wide.',
    ],
    anatomy: {
      view: 'front',
      primary: ['upper-chest', 'chest'],
      secondary: ['front-deltoid', 'triceps'],
    },
  },
  {
    id: 'cable-fly',
    name: 'Cable Fly',
    muscleGroup: 'Chest',
    target: 'Chest',
    secondary: ['Front Delts'],
    equipment: 'Cable',
    difficulty: 'beginner',
    imageUrl: img('photo-1534438327276-14e5300c3a48'),
    instructions: [
      'Set cables at chest height and step forward into a split stance.',
      'Keep a soft bend in the elbows throughout.',
      'Bring handles together in a hugging motion.',
      'Squeeze the chest at the midline, then return slowly.',
    ],
    anatomy: {
      view: 'front',
      primary: ['chest', 'upper-chest', 'lower-chest'],
      secondary: ['front-deltoid'],
    },
  },
  {
    id: 'dumbbell-fly',
    name: 'Dumbbell Fly',
    muscleGroup: 'Chest',
    target: 'Chest',
    secondary: ['Front Delts'],
    equipment: 'Dumbbells',
    difficulty: 'beginner',
    imageUrl: img('photo-1599058945522-28d584b6f14f'),
    instructions: [
      'Lie on a flat bench with dumbbells pressed above the chest.',
      'Open arms in a wide arc with elbows slightly bent.',
      'Stop when you feel a deep chest stretch.',
      'Bring the weights back together over mid-chest.',
    ],
    anatomy: {
      view: 'front',
      primary: ['chest', 'upper-chest', 'lower-chest'],
      secondary: ['front-deltoid'],
    },
  },
  {
    id: 'push-ups',
    name: 'Push-Ups',
    muscleGroup: 'Chest',
    target: 'Chest',
    secondary: ['Triceps', 'Front Delts', 'Core'],
    equipment: 'Bodyweight',
    difficulty: 'beginner',
    imageUrl: img('photo-1598971639058-a4a0d0a4b0c4'),
    instructions: [
      'Start in a high plank with hands under shoulders.',
      'Lower chest toward the floor keeping body rigid.',
      'Press back up without letting hips sag.',
      'Keep elbows tracking about 45° from the torso.',
    ],
    anatomy: {
      view: 'front',
      primary: ['chest', 'upper-chest', 'lower-chest'],
      secondary: ['triceps', 'front-deltoid', 'abs'],
    },
  },
  {
    id: 'chest-dip',
    name: 'Chest Dip',
    muscleGroup: 'Chest',
    target: 'Lower Chest',
    secondary: ['Triceps', 'Front Delts'],
    equipment: 'Bodyweight',
    difficulty: 'advanced',
    imageUrl: img('photo-1434682881908-b43d0467b798'),
    instructions: [
      'Support yourself on parallel bars with arms locked.',
      'Lean torso slightly forward and bend elbows.',
      'Descend until shoulders are below elbows if mobility allows.',
      'Press up focusing on the chest squeeze.',
    ],
    anatomy: {
      view: 'front',
      primary: ['lower-chest', 'chest'],
      secondary: ['triceps', 'front-deltoid'],
    },
  },

  // ─── Back ────────────────────────────────────────────────
  {
    id: 'deadlift',
    name: 'Deadlift',
    muscleGroup: 'Back',
    target: 'Posterior Chain',
    secondary: ['Glutes', 'Hamstrings', 'Traps', 'Core'],
    equipment: 'Barbell',
    difficulty: 'advanced',
    imageUrl: img('photo-1517963879433-6ad2b056d944'),
    instructions: [
      'Stand with mid-foot under the bar, hips hinged.',
      'Grip the bar, brace core, and flatten the back.',
      'Drive through the floor and stand tall.',
      'Lower by hinging hips back, bar close to legs.',
    ],
    anatomy: {
      view: 'back',
      primary: ['lower-back', 'gluteal'],
      secondary: ['hamstring', 'trapezius', 'upper-back'],
    },
  },
  {
    id: 'pullups',
    name: 'Pull-Ups',
    muscleGroup: 'Back',
    target: 'Lats',
    secondary: ['Biceps', 'Rear Delts'],
    equipment: 'Bodyweight',
    difficulty: 'intermediate',
    imageUrl: img('photo-1597452485669-2c7bb5fef90d'),
    instructions: [
      'Hang from a bar with an overhand grip.',
      'Pull chest toward the bar by driving elbows down.',
      'Pause briefly at the top, then lower with control.',
      'Avoid excessive swinging or kipping.',
    ],
    anatomy: {
      view: 'back',
      primary: ['upper-back'],
      secondary: ['trapezius', 'rear-deltoid'],
    },
  },
  {
    id: 'lat-pulldown',
    name: 'Lat Pulldown',
    muscleGroup: 'Back',
    target: 'Lats',
    secondary: ['Biceps', 'Rear Delts'],
    equipment: 'Machine',
    difficulty: 'beginner',
    imageUrl: img('photo-1549060279-7e168fcee0c2'),
    instructions: [
      'Sit tall and grip the bar wider than shoulders.',
      'Pull the bar to the upper chest.',
      'Squeeze the lats at the bottom.',
      'Return slowly without letting the stack slam.',
    ],
    anatomy: {
      view: 'back',
      primary: ['upper-back'],
      secondary: ['trapezius'],
    },
  },
  {
    id: 'barbell-row',
    name: 'Barbell Row',
    muscleGroup: 'Back',
    target: 'Lats',
    secondary: ['Rhomboids', 'Biceps', 'Rear Delts'],
    equipment: 'Barbell',
    difficulty: 'intermediate',
    imageUrl: img('photo-1583454110551-21f2fa2afe61'),
    instructions: [
      'Hinge to ~45° with a soft knee bend.',
      'Pull the bar to the lower ribcage.',
      'Keep elbows close and torso stable.',
      'Lower the bar under control each rep.',
    ],
    anatomy: {
      view: 'back',
      primary: ['upper-back'],
      secondary: ['trapezius', 'rear-deltoid'],
    },
  },
  {
    id: 'seated-cable-row',
    name: 'Seated Cable Row',
    muscleGroup: 'Back',
    target: 'Mid Back',
    secondary: ['Biceps', 'Rear Delts'],
    equipment: 'Cable',
    difficulty: 'beginner',
    imageUrl: img('photo-1576678927484-cc907957088c'),
    instructions: [
      'Sit with feet on the platform and torso upright.',
      'Pull the handle to the abdomen.',
      'Squeeze shoulder blades together.',
      'Extend arms forward without rounding the lower back.',
    ],
    anatomy: {
      view: 'back',
      primary: ['upper-back'],
      secondary: ['trapezius'],
    },
  },  {
    id: 'face-pulls',
    name: 'Face Pulls',
    muscleGroup: 'Shoulders',
    target: 'Rear Delts',
    secondary: ['Traps', 'Rhomboids'],
    equipment: 'Cable',
    difficulty: 'beginner',
    imageUrl: img('photo-1581009146145-b5ef050c2e1e'),
    instructions: [
      'Set a rope at upper-chest height.',
      'Pull toward the face, elbows high.',
      'Externally rotate at the end so hands finish by the ears.',
      'Control the return to keep tension on rear delts.',
    ],
    anatomy: {
      view: 'back',
      primary: ['rear-deltoid', 'deltoids'],
      secondary: ['trapezius', 'rhomboids'],
    },
  },

  // ─── Shoulders ───────────────────────────────────────────
  {
    id: 'overhead-press',
    name: 'Overhead Press',
    muscleGroup: 'Shoulders',
    target: 'Front Delts',
    secondary: ['Side Delts', 'Triceps', 'Traps'],
    equipment: 'Barbell',
    difficulty: 'intermediate',
    imageUrl: img('photo-1599058917212-d750089bc07e'),
    instructions: [
      'Start with the bar at shoulder height.',
      'Brace core and press overhead in a straight line.',
      'Lock out with biceps by the ears.',
      'Lower to the shoulders under control.',
    ],
    anatomy: {
      view: 'front',
      primary: ['front-deltoid', 'deltoids'],
      secondary: ['triceps', 'trapezius'],
    },
  },
  {
    id: 'lateral-raises',
    name: 'Dumbbell Lateral Raise',
    muscleGroup: 'Shoulders',
    target: 'Side Delts',
    secondary: ['Front Delts', 'Traps'],
    equipment: 'Dumbbells',
    difficulty: 'beginner',
    imageUrl: img('photo-1581009137042-c552e485697a'),
    instructions: [
      'Stand tall with dumbbells at your sides.',
      'Raise arms out to shoulder height with soft elbows.',
      'Lead with the elbows, not the hands.',
      'Lower slowly without swinging.',
    ],
    anatomy: {
      view: 'front',
      primary: ['deltoids', 'front-deltoid'],
      secondary: ['trapezius'],
    },
  },
  {
    id: 'rear-delt-fly',
    name: 'Rear Delt Fly',
    muscleGroup: 'Shoulders',
    target: 'Rear Delts',
    secondary: ['Rhomboids', 'Traps'],
    equipment: 'Dumbbells',
    difficulty: 'beginner',
    imageUrl: img('photo-1571902943202-507ec2618e8f'),
    instructions: [
      'Hinge forward with a flat back.',
      'Raise dumbbells out to the sides in a wide arc.',
      'Squeeze the rear delts at the top.',
      'Avoid shrugging the traps too much.',
    ],
    anatomy: {
      view: 'back',
      primary: ['rear-deltoid', 'deltoids'],
      secondary: ['rhomboids', 'trapezius'],
    },
  },
  {
    id: 'arnold-press',
    name: 'Arnold Press',
    muscleGroup: 'Shoulders',
    target: 'Front Delts',
    secondary: ['Side Delts', 'Triceps'],
    equipment: 'Dumbbells',
    difficulty: 'intermediate',
    imageUrl: img('photo-1518611012118-696072aa579a'),
    instructions: [
      'Start with palms facing you at shoulder height.',
      'Rotate palms out while pressing overhead.',
      'Reverse the motion on the way down.',
      'Keep ribs down and avoid excessive arching.',
    ],
    anatomy: {
      view: 'front',
      primary: ['front-deltoid', 'deltoids'],
      secondary: ['triceps'],
    },
  },

  // ─── Arms ────────────────────────────────────────────────
  {
    id: 'bicep-curls',
    name: 'Dumbbell Bicep Curl',
    muscleGroup: 'Arms',
    target: 'Biceps',
    secondary: ['Forearms'],
    equipment: 'Dumbbells',
    difficulty: 'beginner',
    imageUrl: img('photo-1583454110551-21f2fa2afe61'),
    instructions: [
      'Stand with dumbbells at your sides, palms forward.',
      'Curl the weights up without swinging the torso.',
      'Squeeze at the top, then lower fully.',
      'Keep elbows pinned near the ribs.',
    ],
    anatomy: {
      view: 'front',
      primary: ['biceps'],
      secondary: ['forearm'],
    },
  },
  {
    id: 'hammer-curls',
    name: 'Hammer Curl',
    muscleGroup: 'Arms',
    target: 'Biceps',
    secondary: ['Forearms'],
    equipment: 'Dumbbells',
    difficulty: 'beginner',
    imageUrl: img('photo-1576678927484-cc907957088c'),
    instructions: [
      'Hold dumbbells with a neutral (hammer) grip.',
      'Curl up while keeping wrists straight.',
      'Lower under control to full extension.',
      'Minimize shoulder involvement.',
    ],
    anatomy: {
      view: 'front',
      primary: ['biceps'],
      secondary: ['forearm'],
    },
  },
  {
    id: 'tricep-pushdown',
    name: 'Cable Tricep Pushdown',
    muscleGroup: 'Arms',
    target: 'Triceps',
    secondary: ['Forearms'],
    equipment: 'Cable',
    difficulty: 'beginner',
    imageUrl: img('photo-1534438327276-14e5300c3a48'),
    instructions: [
      'Stand tall at a high cable with a bar or rope.',
      'Pin elbows to your sides.',
      'Extend the elbows until arms are straight.',
      'Return until forearms are parallel to the floor.',
    ],
    anatomy: {
      view: 'front',
      primary: ['triceps'],
      secondary: ['forearm'],
    },
  },
  {
    id: 'skull-crushers',
    name: 'Skull Crushers',
    muscleGroup: 'Arms',
    target: 'Triceps',
    secondary: ['Forearms'],
    equipment: 'Barbell',
    difficulty: 'intermediate',
    imageUrl: img('photo-1517836357463-d25dfeac3438'),
    instructions: [
      'Lie on a bench holding an EZ bar above the chest.',
      'Bend elbows to lower the bar toward the forehead.',
      'Keep upper arms still.',
      'Extend elbows to lockout without flaring wide.',
    ],
    anatomy: {
      view: 'front',
      primary: ['triceps'],
      secondary: ['forearm'],
    },
  },
  {
    id: 'overhead-tricep-ext',
    name: 'Overhead Tricep Extension',
    muscleGroup: 'Arms',
    target: 'Triceps',
    secondary: ['Front Delts'],
    equipment: 'Dumbbells',
    difficulty: 'beginner',
    imageUrl: img('photo-1571019613454-1cb2f99b2d8b'),
    instructions: [
      'Hold one dumbbell overhead with both hands.',
      'Lower behind the head by bending the elbows.',
      'Keep elbows pointed up.',
      'Extend back to the start without arching excessively.',
    ],
    anatomy: {
      view: 'front',
      primary: ['triceps'],
      secondary: ['front-deltoid'],
    },
  },

  // ─── Legs ────────────────────────────────────────────────
  {
    id: 'squats',
    name: 'Barbell Squat',
    muscleGroup: 'Legs',
    target: 'Quads',
    secondary: ['Glutes', 'Hamstrings', 'Core'],
    equipment: 'Barbell',
    difficulty: 'intermediate',
    imageUrl: img('photo-1574680096145-d05b474e2155'),
    instructions: [
      'Set the bar on the upper back and brace hard.',
      'Sit hips down and back while knees track over toes.',
      'Descend to at least parallel if mobility allows.',
      'Drive up through mid-foot to standing.',
    ],
    anatomy: {
      view: 'front',
      primary: ['quadriceps', 'inner-quad', 'outer-quad'],
      secondary: ['gluteal', 'abs', 'hip-flexors'],
    },
  },
  {
    id: 'leg-press',
    name: 'Leg Press',
    muscleGroup: 'Legs',
    target: 'Quads',
    secondary: ['Glutes', 'Hamstrings'],
    equipment: 'Machine',
    difficulty: 'beginner',
    imageUrl: img('photo-1434608519348-92cbcd60ba22'),
    instructions: [
      'Sit with feet mid-platform, shoulder-width apart.',
      'Unlock the sled and lower until knees are ~90°.',
      'Press through the heels without locking violently.',
      'Keep lower back glued to the pad.',
    ],
    anatomy: {
      view: 'front',
      primary: ['quadriceps', 'inner-quad', 'outer-quad'],
      secondary: ['gluteal'],
    },
  },
  {
    id: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    muscleGroup: 'Legs',
    target: 'Hamstrings',
    secondary: ['Glutes', 'Lower Back'],
    equipment: 'Barbell',
    difficulty: 'intermediate',
    imageUrl: img('photo-1517963879433-6ad2b056d944'),
    instructions: [
      'Hold the bar at hip height with a soft knee bend.',
      'Hinge hips back, sliding the bar down the thighs.',
      'Stop when you feel a strong hamstring stretch.',
      'Drive hips forward to return to standing.',
    ],
    anatomy: {
      view: 'back',
      primary: ['hamstring'],
      secondary: ['gluteal', 'lower-back'],
    },
  },
  {
    id: 'leg-curl',
    name: 'Lying Leg Curl',
    muscleGroup: 'Legs',
    target: 'Hamstrings',
    secondary: ['Calves'],
    equipment: 'Machine',
    difficulty: 'beginner',
    imageUrl: img('photo-1434682881908-b43d0467b798'),
    instructions: [
      'Lie face down and hook ankles under the pad.',
      'Curl heels toward the glutes.',
      'Squeeze hamstrings at the top.',
      'Lower with control without bouncing.',
    ],
    anatomy: {
      view: 'back',
      primary: ['hamstring'],
      secondary: ['calves'],
    },
  },
  {
    id: 'leg-extension',
    name: 'Leg Extension',
    muscleGroup: 'Legs',
    target: 'Quads',
    secondary: [],
    equipment: 'Machine',
    difficulty: 'beginner',
    imageUrl: img('photo-1549060279-7e168fcee0c2'),
    instructions: [
      'Adjust the pad to sit on the lower shins.',
      'Extend knees until legs are straight.',
      'Pause and squeeze the quads.',
      'Lower slowly to the start.',
    ],
    anatomy: {
      view: 'front',
      primary: ['quadriceps', 'inner-quad', 'outer-quad'],
      secondary: [],
    },
  },
  {
    id: 'walking-lunges',
    name: 'Walking Lunges',
    muscleGroup: 'Legs',
    target: 'Quads',
    secondary: ['Glutes', 'Hamstrings'],
    equipment: 'Dumbbells',
    difficulty: 'intermediate',
    imageUrl: img('photo-1434608519348-92cbcd60ba22'),
    instructions: [
      'Step forward into a long lunge.',
      'Lower until both knees are near 90°.',
      'Push through the front heel to step into the next lunge.',
      'Keep torso upright and hips square.',
    ],
    anatomy: {
      view: 'front',
      primary: ['quadriceps', 'outer-quad'],
      secondary: ['gluteal', 'hip-flexors'],
    },
  },
  {
    id: 'calf-raises',
    name: 'Standing Calf Raise',
    muscleGroup: 'Legs',
    target: 'Calves',
    secondary: [],
    equipment: 'Machine',
    difficulty: 'beginner',
    imageUrl: img('photo-1571902943202-507ec2618e8f'),
    instructions: [
      'Stand with the balls of your feet on the platform.',
      'Rise onto the toes as high as possible.',
      'Pause at the top, then lower into a full stretch.',
      'Keep knees soft but stable.',
    ],
    anatomy: {
      view: 'back',
      primary: ['calves'],
      secondary: [],
    },
  },
  {
    id: 'hip-thrust',
    name: 'Barbell Hip Thrust',
    muscleGroup: 'Glutes',
    target: 'Glutes',
    secondary: ['Hamstrings', 'Core'],
    equipment: 'Barbell',
    difficulty: 'intermediate',
    imageUrl: img('photo-1518611012118-696072aa579a'),
    instructions: [
      'Sit with upper back on a bench and bar over the hips.',
      'Drive through heels to lift hips until torso is parallel.',
      'Squeeze glutes hard at the top.',
      'Lower with control without losing brace.',
    ],
    anatomy: {
      view: 'back',
      primary: ['gluteal'],
      secondary: ['hamstring'],
    },
  },

  // ─── Core ────────────────────────────────────────────────
  {
    id: 'hanging-leg-raise',
    name: 'Hanging Leg Raise',
    muscleGroup: 'Core',
    target: 'Abs',
    secondary: ['Hip Flexors', 'Obliques'],
    equipment: 'Bodyweight',
    difficulty: 'advanced',
    imageUrl: img('photo-1597452485669-2c7bb5fef90d'),
    instructions: [
      'Hang from a pull-up bar with a stable grip.',
      'Raise legs by flexing the hips and abs.',
      'Aim for thighs parallel or higher.',
      'Lower slowly without swinging.',
    ],
    anatomy: {
      view: 'front',
      primary: ['abs', 'upper-abs', 'lower-abs'],
      secondary: ['obliques', 'hip-flexors'],
    },
  },
  {
    id: 'cable-crunch',
    name: 'Cable Crunch',
    muscleGroup: 'Core',
    target: 'Abs',
    secondary: ['Obliques'],
    equipment: 'Cable',
    difficulty: 'beginner',
    imageUrl: img('photo-1571019614242-c5c5dee9f50b'),
    instructions: [
      'Kneel facing a high cable with a rope attachment.',
      'Crunch elbows toward the thighs.',
      'Focus on spinal flexion, not hip hinging.',
      'Return under control to a tall torso.',
    ],
    anatomy: {
      view: 'front',
      primary: ['abs', 'upper-abs', 'lower-abs'],
      secondary: ['obliques'],
    },
  },
  {
    id: 'plank',
    name: 'Plank',
    muscleGroup: 'Core',
    target: 'Abs',
    secondary: ['Obliques', 'Front Delts'],
    equipment: 'Bodyweight',
    difficulty: 'beginner',
    imageUrl: img('photo-1599058945522-28d584b6f14f'),
    instructions: [
      'Set up on forearms and toes in a straight line.',
      'Brace abs and squeeze glutes.',
      'Keep hips level — no sagging or piked hips.',
      'Breathe steadily while holding.',
    ],
    anatomy: {
      view: 'front',
      primary: ['abs', 'upper-abs', 'lower-abs'],
      secondary: ['obliques', 'front-deltoid'],
    },
  },
  {
    id: 'russian-twist',
    name: 'Russian Twist',
    muscleGroup: 'Core',
    target: 'Obliques',
    secondary: ['Abs'],
    equipment: 'Bodyweight',
    difficulty: 'beginner',
    imageUrl: img('photo-1571019613454-1cb2f99b2d8b'),
    instructions: [
      'Sit with knees bent and lean torso back slightly.',
      'Rotate shoulders side to side.',
      'Touch the floor beside each hip if possible.',
      'Keep the core braced throughout.',
    ],
    anatomy: {
      view: 'front',
      primary: ['obliques'],
      secondary: ['abs', 'upper-abs', 'lower-abs'],
    },
  },
]

export const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

export function applyExerciseMediaOverride<T extends CatalogExercise>(
  exercise: T,
  override?: { imageUrl?: string; videoUrl?: string } | null
): T {
  if (!override) return exercise
  const next = { ...exercise }
  if (override.imageUrl?.trim()) next.imageUrl = override.imageUrl.trim()
  if (override.videoUrl !== undefined) {
    const v = override.videoUrl.trim()
    if (v) next.videoUrl = v
    else delete next.videoUrl
  }
  return next
}

export function getExerciseById(
  id: string,
  customExercises: CatalogExercise[] = [],
  mediaOverrides: Record<string, { imageUrl?: string; videoUrl?: string }> = {}
) {
  const custom = customExercises.find((e) => e.id === id)
  const base = custom
    ? withNormalizedAnatomy(custom)
    : EXERCISE_CATALOG.find((e) => e.id === id)
  if (!base) return undefined
  return applyExerciseMediaOverride(base, mediaOverrides[id])
}

export function getAllExercises(
  customExercises: CatalogExercise[] = [],
  mediaOverrides: Record<string, { imageUrl?: string; videoUrl?: string }> = {}
) {
  const all = [...customExercises.map(withNormalizedAnatomy), ...EXERCISE_CATALOG]
  if (Object.keys(mediaOverrides).length === 0) return all
  return all.map((ex) => applyExerciseMediaOverride(ex, mediaOverrides[ex.id]))
}

export function getExercisesByGroup(
  group: string,
  customExercises: CatalogExercise[] = [],
  mediaOverrides: Record<string, { imageUrl?: string; videoUrl?: string }> = {}
) {
  const all = getAllExercises(customExercises, mediaOverrides)
  if (group === 'All') return all
  return all.filter((e) => e.muscleGroup === group)
}

export function buildCustomExercise(input: CreateExerciseInput, id?: string): CatalogExercise {
  const defaults = anatomyDefaultsForExercise(
    input.name,
    input.muscleGroup,
    input.anatomyBaseGroup
  )
  const secondaryLabels = (input.secondary ?? [])
    .map((s) => s.trim())
    .filter(Boolean) as SecondaryMuscleLabel[]

  return {
    id: id ?? `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: input.name.trim(),
    muscleGroup: input.muscleGroup,
    target: input.target?.trim() || defaults.target,
    secondary: secondaryLabels,
    equipment: input.equipment.trim() || 'Other',
    difficulty: input.difficulty,
    imageUrl: input.imageUrl?.trim() || DEFAULT_EXERCISE_IMAGE,
    ...(input.videoUrl?.trim() ? { videoUrl: input.videoUrl.trim() } : {}),
    instructions: input.instructions.filter((s) => s.trim()),
    anatomy: {
      view: defaults.view,
      primary: [...defaults.primary],
      secondary: [...defaults.secondary],
    },
    isCustom: true,
  }
}

export function isCustomExerciseId(id: string) {
  return id.startsWith('custom-')
}

/** Compat aliases used by older plan/workout code */
export function toLegacyExercise(ex: CatalogExercise) {
  return {
    id: ex.id,
    name: ex.name,
    category: ex.muscleGroup,
    equipment: ex.equipment,
    primaryMuscle: ex.target.toLowerCase().includes('chest')
      ? 'chest'
      : ex.target.toLowerCase().includes('lat') || ex.target.toLowerCase().includes('back')
        ? 'back'
        : ex.muscleGroup.toLowerCase() === 'arms'
          ? ex.target.toLowerCase().includes('tricep')
            ? 'triceps'
            : 'biceps'
          : ex.muscleGroup.toLowerCase() === 'legs'
            ? 'legs'
            : ex.muscleGroup.toLowerCase() === 'core'
              ? 'abs'
              : ex.muscleGroup.toLowerCase() === 'shoulders'
                ? 'shoulders'
                : ex.muscleGroup.toLowerCase() === 'glutes'
                  ? 'glutes'
                  : 'chest',
    secondaryMuscles: ex.secondary.map((s) => s.toLowerCase()),
  }
}
