import { pgTable, uuid, text, timestamp, integer, boolean, numeric, uniqueIndex, index, vector } from 'drizzle-orm/pg-core'

// 1. Profiles (user profile information, maps to Supabase auth user)
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().notNull(), // matches auth.users id
  fullName: text('full_name'),
  avatarUrl: text('avatar_url'),
  experienceLevel: text('experience_level'), // e.g. 'beginner', 'intermediate', 'advanced'
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
})

// 2. Workout Plans (pre-defined templates, e.g. "Push/Pull/Legs")
export const workoutPlans = pgTable('workout_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  isCustom: boolean('is_custom').default(true).notNull(),
  isActive: boolean('is_active').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// 3. Workout Days (specific days within a workout plan, e.g. "Day A: Push")
export const workoutDays = pgTable('workout_days', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id').references(() => workoutPlans.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(), // e.g. "Monday" or "Day A"
  muscleFocus: text('muscle_focus'), // e.g. "Chest + Triceps"
  dayOfWeek: integer('day_of_week'), // 1=Mon … 7=Sun (optional)
  order: integer('order').notNull(),
})

// 4. Exercise Categories (Chest, Back, Legs, etc.)
export const exerciseCategories = pgTable('exercise_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  icon: text('icon'), // Lucide icon identifier
})

// 5. Exercises (Master list of exercises)
export const exercises = pgTable('exercises', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  instructions: text('instructions'), // JSON string array
  categoryId: uuid('category_id').references(() => exerciseCategories.id),
  muscleGroup: text('muscle_group').notNull(), // Chest, Back, Legs...
  targetMuscle: text('target_muscle').notNull(), // display: Chest
  secondaryMuscles: text('secondary_muscles'), // JSON string array of display labels
  anatomyView: text('anatomy_view').default('front'), // front | back
  anatomyPrimary: text('anatomy_primary'), // JSON MuscleMap slugs
  anatomySecondary: text('anatomy_secondary'), // JSON MuscleMap slugs
  equipment: text('equipment'),
  difficulty: text('difficulty').default('beginner'), // beginner | intermediate | advanced
  imageUrl: text('image_url'),
  videoUrl: text('video_url'),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
})

// 5b. Planned exercises on a workout day (template sets/reps)
export const workoutDayExercises = pgTable('workout_day_exercises', {
  id: uuid('id').primaryKey().defaultRandom(),
  dayId: uuid('day_id').references(() => workoutDays.id, { onDelete: 'cascade' }).notNull(),
  exerciseId: uuid('exercise_id').references(() => exercises.id, { onDelete: 'cascade' }),
  exerciseName: text('exercise_name').notNull(), // denormalized for display / local catalogs
  order: integer('order').notNull(),
  targetSets: integer('target_sets').default(3).notNull(),
  targetReps: integer('target_reps').default(10).notNull(),
  targetWeight: numeric('target_weight', { precision: 5, scale: 2 }),
  restSeconds: integer('rest_seconds').default(90),
  notes: text('notes'),
})

// 6. Workout Sessions (Historical logs of workouts completed or in-progress)
export const workoutSessions = pgTable('workout_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  planDayId: uuid('plan_day_id').references(() => workoutDays.id), // Null for custom ad-hoc workouts
  name: text('name').notNull(), // e.g. "Morning Push Session"
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  status: text('status').default('active').notNull(), // 'active', 'completed', 'cancelled'
  notes: text('notes'),
})

// 7. Workout Exercises (Exercises added to a specific session)
export const workoutExercises = pgTable('workout_exercises', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => workoutSessions.id, { onDelete: 'cascade' }).notNull(),
  exerciseId: uuid('exercise_id').references(() => exercises.id).notNull(),
  order: integer('order').notNull(),
  notes: text('notes'),
})

// 8. Exercise Sets (Logged sets for a workout exercise)
export const exerciseSets = pgTable('exercise_sets', {
  id: uuid('id').primaryKey().defaultRandom(),
  workoutExerciseId: uuid('workout_exercise_id').references(() => workoutExercises.id, { onDelete: 'cascade' }).notNull(),
  setNumber: integer('set_number').notNull(),
  type: text('type').default('normal').notNull(), // 'warmup', 'normal', 'dropset', 'failure'
  weight: numeric('weight', { precision: 5, scale: 2 }), // weight lifted (kg/lbs)
  reps: integer('reps'),
  isCompleted: boolean('is_completed').default(false).notNull(),
  rpe: integer('rpe'), // Rate of Perceived Exertion (1-10)
})

// 9. Body Measurements (For logging weight, body fat %, tape measurements)
export const bodyMeasurements = pgTable('body_measurements', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
  weight: numeric('weight', { precision: 5, scale: 2 }),
  bodyFatPercentage: numeric('body_fat_percentage', { precision: 4, scale: 2 }),
  chest: numeric('chest', { precision: 5, scale: 2 }),
  armsLeft: numeric('arms_left', { precision: 4, scale: 2 }),
  armsRight: numeric('arms_right', { precision: 4, scale: 2 }),
  waist: numeric('waist', { precision: 5, scale: 2 }),
  thighsLeft: numeric('thighs_left', { precision: 4, scale: 2 }),
  thighsRight: numeric('thighs_right', { precision: 4, scale: 2 }),
  calvesLeft: numeric('calves_left', { precision: 4, scale: 2 }),
  calvesRight: numeric('calves_right', { precision: 4, scale: 2 }),
})

// 10. Personal Records (Best lift history)
export const personalRecords = pgTable('personal_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  exerciseId: uuid('exercise_id').references(() => exercises.id, { onDelete: 'cascade' }).notNull(),
  setId: uuid('set_id').references(() => exerciseSets.id, { onDelete: 'cascade' }).notNull(),
  prType: text('pr_type').notNull(), // 'one_rep_max', 'max_weight', 'max_reps'
  value: numeric('value', { precision: 7, scale: 2 }).notNull(),
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
})

// 11. Notifications (Scaffolding notifications for timers/workout streaks)
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  type: text('type').default('general').notNull(), // 'reminder', 'timer_finished', 'streak_achievement'
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// 12. Per-user app data sync (localStorage mirror for cross-device consistency)
export const userAppSync = pgTable('user_app_sync', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => profiles.id, { onDelete: 'cascade' })
    .notNull(),
  payload: text('payload').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
})

// 13. Body composition (InBody / BIA) reports
export const bodyCompositionReports = pgTable('body_composition_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
  reportDate: timestamp('report_date').defaultNow().notNull(),
  height: numeric('height', { precision: 6, scale: 2 }),
  weight: numeric('weight', { precision: 6, scale: 2 }),
  bodyScore: numeric('body_score', { precision: 6, scale: 2 }),
  bmi: numeric('bmi', { precision: 6, scale: 2 }),
  bodyFatPercent: numeric('body_fat_percent', { precision: 6, scale: 2 }),
  bodyFatMass: numeric('body_fat_mass', { precision: 6, scale: 2 }),
  skeletalMuscleMass: numeric('skeletal_muscle_mass', { precision: 6, scale: 2 }),
  leanBodyMass: numeric('lean_body_mass', { precision: 6, scale: 2 }),
  protein: numeric('protein', { precision: 6, scale: 2 }),
  minerals: numeric('minerals', { precision: 6, scale: 2 }),
  totalBodyWater: numeric('total_body_water', { precision: 6, scale: 2 }),
  visceralFat: numeric('visceral_fat', { precision: 6, scale: 2 }),
  waistHipRatio: numeric('waist_hip_ratio', { precision: 6, scale: 3 }),
  bmr: numeric('bmr', { precision: 8, scale: 2 }),
  recommendedCalories: numeric('recommended_calories', { precision: 8, scale: 2 }),
  targetWeight: numeric('target_weight', { precision: 6, scale: 2 }),
  weightControl: numeric('weight_control', { precision: 6, scale: 2 }),
  fatControl: numeric('fat_control', { precision: 6, scale: 2 }),
  muscleControl: numeric('muscle_control', { precision: 6, scale: 2 }),
  segmentalLean: text('segmental_lean'), // JSON
  segmentalFat: text('segmental_fat'), // JSON
  pdfUrl: text('pdf_url'),
  imageUrl: text('image_url'),
  rawText: text('raw_text'),
  aiAnalysis: text('ai_analysis'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
})

// 14. Daily / weekly / monthly challenges
export const dailyChallenges = pgTable(
  'daily_challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    date: text('date').notNull(), // YYYY-MM-DD
    period: text('period').default('daily').notNull(), // daily | weekly | monthly
    title: text('title').notNull(),
    description: text('description').notNull(),
    category: text('category').notNull(),
    difficulty: text('difficulty').notNull(),
    targetValue: numeric('target_value', { precision: 12, scale: 2 }).notNull(),
    currentValue: numeric('current_value', { precision: 12, scale: 2 }).default('0').notNull(),
    unit: text('unit').notNull(),
    status: text('status').default('pending').notNull(),
    xpReward: integer('xp_reward').notNull(),
    coinReward: integer('coin_reward').notNull(),
    badgeReward: text('badge_reward'),
    icon: text('icon'),
    color: text('color'),
    autoComplete: boolean('auto_complete').default(false).notNull(),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('daily_challenges_user_date_idx').on(t.userId, t.date),
    index('daily_challenges_user_status_idx').on(t.userId, t.status),
  ]
)

// 15. Challenge completion history
export const challengeHistory = pgTable(
  'challenge_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    challengeId: uuid('challenge_id')
      .references(() => dailyChallenges.id, { onDelete: 'cascade' })
      .notNull(),
    completedAt: timestamp('completed_at').defaultNow().notNull(),
    xpEarned: integer('xp_earned').notNull(),
    coinsEarned: integer('coins_earned').notNull(),
  },
  (t) => [index('challenge_history_user_idx').on(t.userId, t.completedAt)]
)

// 16. User XP / coins / streaks / badges
export const userRewards = pgTable(
  'user_rewards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    level: integer('level').default(1).notNull(),
    xp: integer('xp').default(0).notNull(),
    coins: integer('coins').default(0).notNull(),
    currentStreak: integer('current_streak').default(0).notNull(),
    longestStreak: integer('longest_streak').default(0).notNull(),
    lastCompletedDate: text('last_completed_date'),
    badges: text('badges').default('[]').notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [uniqueIndex('user_rewards_user_uidx').on(t.userId)]
)

// 17. AI RAG documents (personal memory + global fitness knowledge)
export const aiDocuments = pgTable(
  'ai_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
    sourceType: text('source_type').notNull(), // workout | meal | body_composition | exercise | knowledge | pr
    sourceId: text('source_id'),
    chunkIndex: integer('chunk_index').default(0).notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    metadata: text('metadata'), // JSON string
    embedding: vector('embedding', { dimensions: 1536 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('ai_documents_user_source_idx').on(t.userId, t.sourceType, t.sourceId),
    index('ai_documents_source_type_idx').on(t.sourceType),
  ]
)