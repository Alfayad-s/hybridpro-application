import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import {
  EQUIPMENT_OPTIONS,
  EXERCISE_CATEGORIES,
  type CreateExerciseInput,
} from '@/data/exercises'
import { extractProposalPayload } from '@/lib/ai/extract-proposal'
import { completeGroqTextChat } from '@/lib/ai/complete'

const SuggestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  muscleGroup: z.string().trim().min(1).max(80),
  anatomyBaseGroup: z
    .enum(['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Glutes', 'Full Body'])
    .optional(),
  target: z.string().trim().max(80).optional(),
  equipment: z.string().trim().min(1).max(80),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  instructions: z.array(z.string().trim().min(1).max(300)).min(2).max(8),
  secondary: z.array(z.string().trim().min(1).max(40)).max(6).optional(),
})

function coerceEquipment(value: string) {
  const match = EQUIPMENT_OPTIONS.find(
    (opt) => opt.toLowerCase() === value.toLowerCase().trim()
  )
  if (match) return match
  const lower = value.toLowerCase()
  if (lower.includes('cable')) return 'Cable'
  if (lower.includes('dumbbell')) return 'Dumbbell'
  if (lower.includes('barbell')) return 'Barbell'
  if (lower.includes('machine')) return 'Machine'
  if (lower.includes('body')) return 'Bodyweight'
  if (lower.includes('kettle')) return 'Kettlebell'
  if (lower.includes('band')) return 'Resistance Band'
  return 'Other'
}

function coerceAnatomy(value: string | undefined, muscleGroup: string) {
  const groups = [
    'Chest',
    'Back',
    'Shoulders',
    'Arms',
    'Legs',
    'Core',
    'Glutes',
    'Full Body',
  ] as const
  const fromValue = groups.find((g) => g.toLowerCase() === (value ?? '').toLowerCase())
  if (fromValue) return fromValue
  const fromGroup = groups.find((g) => g.toLowerCase() === muscleGroup.toLowerCase())
  return fromGroup ?? 'Full Body'
}

function parseSuggestion(raw: string, fallbackName: string): CreateExerciseInput | null {
  // Prefer fenced / bare JSON object
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence?.[1]?.trim() || raw.trim()
  const first = candidate.indexOf('{')
  const last = candidate.lastIndexOf('}')
  if (first < 0 || last <= first) {
    const extracted = extractProposalPayload(raw)
    if (extracted && typeof extracted === 'object' && 'name' in (extracted as object)) {
      return normalizeSuggestion(extracted as Record<string, unknown>, fallbackName)
    }
    return null
  }

  try {
    const parsed = JSON.parse(candidate.slice(first, last + 1)) as Record<string, unknown>
    return normalizeSuggestion(parsed, fallbackName)
  } catch {
    return null
  }
}

function normalizeSuggestion(
  parsed: Record<string, unknown>,
  fallbackName: string
): CreateExerciseInput | null {
  const result = SuggestSchema.safeParse({
    name: typeof parsed.name === 'string' ? parsed.name : fallbackName,
    muscleGroup: parsed.muscleGroup,
    anatomyBaseGroup: parsed.anatomyBaseGroup,
    target: parsed.target,
    equipment: parsed.equipment,
    difficulty: parsed.difficulty,
    instructions: parsed.instructions,
    secondary: parsed.secondary,
  })

  if (!result.success) return null

  const data = result.data
  const anatomyBaseGroup = coerceAnatomy(data.anatomyBaseGroup, data.muscleGroup)
  const muscleGroup =
    EXERCISE_CATEGORIES.includes(data.muscleGroup as (typeof EXERCISE_CATEGORIES)[number])
      ? data.muscleGroup
      : anatomyBaseGroup

  return {
    name: data.name.trim() || fallbackName,
    muscleGroup,
    anatomyBaseGroup,
    target: data.target?.trim() || undefined,
    equipment: coerceEquipment(data.equipment),
    difficulty: data.difficulty,
    instructions: data.instructions.map((s) => s.trim()).filter(Boolean),
    secondary: data.secondary?.map((s) => s.trim()).filter(Boolean),
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { name?: string }
  try {
    body = (await request.json()) as { name?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: 'Exercise name is required' }, { status: 400 })
  }

  const system = `You fill Hybrid Pro custom exercise forms.
Return ONLY valid JSON (no markdown, no prose) with this shape:
{
  "name": string,
  "muscleGroup": one of ${EXERCISE_CATEGORIES.join(' | ')},
  "anatomyBaseGroup": same as muscleGroup when possible,
  "target": short primary muscle label,
  "equipment": one of ${EQUIPMENT_OPTIONS.join(' | ')},
  "difficulty": "beginner" | "intermediate" | "advanced",
  "instructions": string[] (3-6 clear coaching steps),
  "secondary": string[] (0-4 secondary muscle labels)
}
Be specific to the exercise name. Keep instructions mobile-friendly.`

  try {
    const raw = await completeGroqTextChat([
      { role: 'system', content: system },
      {
        role: 'user',
        content: `Fill exercise fields for: "${name}"`,
      },
    ])

    const suggestion = parseSuggestion(raw, name)
    if (!suggestion) {
      return NextResponse.json(
        { error: 'AI returned an invalid exercise suggestion. Try again.' },
        { status: 422 }
      )
    }

    return NextResponse.json({ suggestion })
  } catch (error) {
    console.error('Suggest exercise failed:', error)
    const message =
      error instanceof Error
        ? error.message
        : 'AI is unavailable right now. Please try again.'
    const status = /rate limit|too many requests|429|tpm/i.test(message) ? 429 : 503
    return NextResponse.json({ error: message }, { status })
  }
}
