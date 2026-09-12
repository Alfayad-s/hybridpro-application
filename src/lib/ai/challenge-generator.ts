import { completeGroqTextChat } from '@/lib/groq'
import { CATEGORY_META, DIFFICULTY_REWARDS } from '@/lib/challenges/rewards'
import {
  GeneratedChallengesSchema,
  type ChallengeGeneratorInput,
  type GeneratedChallenge,
} from '@/lib/challenges/types'

function fallbackChallenges(input: ChallengeGeneratorInput): GeneratedChallenge[] {
  const recoveryLow = input.recovery.score < 45
  const hardMode = input.streak > 30
  const easyMode = input.skippedYesterday

  const items: GeneratedChallenge[] = []

  if (recoveryLow) {
    items.push({
      title: 'Active Recovery',
      description: 'Take a recovery-focused day: stretch or foam roll for 10 minutes.',
      category: 'Recovery',
      difficulty: 'Easy',
      targetValue: 10,
      unit: 'minutes',
      autoComplete: false,
    })
    items.push({
      title: 'Sleep Well',
      description: 'Aim for 8 hours of sleep to restore recovery.',
      category: 'Recovery',
      difficulty: 'Easy',
      targetValue: 8,
      unit: 'hours',
      autoComplete: false,
    })
  } else if (input.todayWorkout) {
    items.push({
      title: `Complete ${input.todayWorkout}`,
      description: `Finish today's planned workout: ${input.todayWorkout}.`,
      category: 'Workout',
      difficulty: easyMode ? 'Easy' : hardMode ? 'Hard' : 'Medium',
      targetValue: 1,
      unit: 'workout',
      autoComplete: true,
    })
  } else {
    items.push({
      title: 'Log a Workout',
      description: 'Complete any workout session today.',
      category: 'Workout',
      difficulty: 'Easy',
      targetValue: 1,
      unit: 'workout',
      autoComplete: true,
    })
  }

  items.push({
    title: `Drink ${(input.waterTarget / 1000).toFixed(1)}L Water`,
    description: 'Stay hydrated throughout the day.',
    category: 'Hydration',
    difficulty: 'Easy',
    targetValue: input.waterTarget,
    unit: 'ml',
    autoComplete: false,
  })

  items.push({
    title: `Hit ${input.proteinTarget}g Protein`,
    description: 'Meet your daily protein target.',
    category: 'Nutrition',
    difficulty: easyMode ? 'Easy' : 'Medium',
    targetValue: input.proteinTarget,
    unit: 'g',
    autoComplete: false,
  })

  items.push({
    title: 'Open Hybrid Pro',
    description: 'Check in and review your plan for today.',
    category: 'Habit',
    difficulty: 'Easy',
    targetValue: 1,
    unit: 'check-in',
    autoComplete: true,
  })

  if (items.length < 5) {
    items.push({
      title: hardMode ? 'Push Workout Volume' : 'Mobility Flow',
      description: hardMode
        ? 'Add extra volume or finish one more exercise than planned.'
        : 'Spend 8 minutes on mobility or stretching.',
      category: hardMode ? 'Strength' : 'Mobility',
      difficulty: hardMode ? 'Hard' : 'Easy',
      targetValue: hardMode ? 1 : 8,
      unit: hardMode ? 'session' : 'minutes',
      autoComplete: false,
    })
  }

  return items.slice(0, 5).map(normalizeChallenge)
}

function normalizeChallenge(c: GeneratedChallenge): GeneratedChallenge {
  const rewards = DIFFICULTY_REWARDS[c.difficulty]
  const meta = CATEGORY_META[c.category]
  return {
    ...c,
    xpReward: c.xpReward ?? rewards.xp,
    coinReward: c.coinReward ?? rewards.coins,
    autoComplete: c.autoComplete ?? false,
    icon: c.icon ?? meta.icon,
    color: c.color ?? meta.color,
  }
}

function extractJsonArray(raw: string): unknown {
  const trimmed = raw.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fence ? fence[1].trim() : trimmed
  const start = body.indexOf('[')
  const end = body.lastIndexOf(']')
  if (start === -1 || end === -1) throw new Error('No JSON array in AI response')
  return JSON.parse(body.slice(start, end + 1)) as unknown
}

export async function generateDailyChallenges(
  input: ChallengeGeneratorInput
): Promise<GeneratedChallenge[]> {
  try {
    const raw = await completeGroqTextChat([
      {
        role: 'system',
        content: `You are Hybrid Pro's daily challenge engine. Generate exactly 5 personalized fitness challenges.
Rules:
- Do not repeat yesterday's challenges (titles listed in input).
- Base at least one challenge on today's workout when present.
- Use the user's fitness goal.
- Consider recovery score (0-100). If recovery is low (<45), prioritize Recovery / Mobility / Hydration.
- If user skipped yesterday, prefer Easy / Medium difficulty.
- If streak > 30, increase difficulty (more Hard/Extreme).
- Categories must be one of: Workout, Cardio, Nutrition, Recovery, Progress, Habit, Mindfulness, Hydration, Strength, Mobility
- Difficulty must be one of: Easy, Medium, Hard, Extreme
- Return ONLY a JSON array (no markdown, no prose).
Example item:
{"title":"Complete Chest Workout","description":"Finish all planned chest exercises.","category":"Workout","difficulty":"Medium","targetValue":1,"unit":"workout","xpReward":50,"coinReward":25,"autoComplete":true}`,
      },
      {
        role: 'user',
        content: JSON.stringify(input),
      },
    ])

    const parsed = extractJsonArray(raw)
    const validated = GeneratedChallengesSchema.parse(parsed)
    return validated.slice(0, 5).map(normalizeChallenge)
  } catch (error) {
    console.error('Challenge AI generation failed, using fallback:', error)
    return fallbackChallenges(input)
  }
}

export async function generateWeeklyChallenges(
  input: ChallengeGeneratorInput
): Promise<GeneratedChallenge[]> {
  const weekly: GeneratedChallenge[] = [
    {
      title: 'Complete 5 Workouts',
      description: 'Finish five training sessions this week.',
      category: 'Workout',
      difficulty: 'Hard',
      targetValue: 5,
      unit: 'workouts',
      autoComplete: true,
    },
    {
      title: 'Hit 800g Protein',
      description: 'Accumulate 800g of protein across the week.',
      category: 'Nutrition',
      difficulty: 'Hard',
      targetValue: 800,
      unit: 'g',
      autoComplete: false,
    },
    {
      title: 'Walk 70,000 Steps',
      description: 'Stay active with ~10k steps per day.',
      category: 'Cardio',
      difficulty: 'Medium',
      targetValue: 70000,
      unit: 'steps',
      autoComplete: false,
    },
  ]
  void input
  return weekly.map(normalizeChallenge)
}

export async function generateMonthlyChallenges(
  input: ChallengeGeneratorInput
): Promise<GeneratedChallenge[]> {
  const monthly: GeneratedChallenge[] = [
    {
      title: 'Train 20 Days',
      description: 'Complete workouts on at least 20 days this month.',
      category: 'Workout',
      difficulty: 'Extreme',
      targetValue: 20,
      unit: 'days',
      autoComplete: true,
    },
    {
      title: 'Upload BIA Twice',
      description: 'Upload two body composition reports this month.',
      category: 'Progress',
      difficulty: 'Medium',
      targetValue: 2,
      unit: 'reports',
      autoComplete: true,
    },
    {
      title: 'Maintain Streak',
      description: 'Keep your challenge streak alive all month.',
      category: 'Habit',
      difficulty: 'Hard',
      targetValue: 1,
      unit: 'streak',
      autoComplete: false,
    },
  ]
  void input
  return monthly.map(normalizeChallenge)
}
