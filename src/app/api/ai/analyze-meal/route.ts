import { NextResponse } from 'next/server'
import { z } from 'zod'
import { completeGroqTextChat, completeGroqVisionChat } from '@/lib/ai/complete'
import { requireFeature } from '@/lib/subscriptions/require-feature'

export const runtime = 'nodejs'
export const maxDuration = 60

const MealSuggestionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  calories: z.number().min(0).max(10000),
  proteinG: z.number().min(0).max(500),
  carbsG: z.number().min(0).max(1000),
  fatG: z.number().min(0).max(500),
  notes: z.string().trim().max(300).optional(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
})

export type MealAiSuggestion = z.infer<typeof MealSuggestionSchema>

const JSON_SHAPE = `{
  "name": string (short meal label, e.g. "Chicken rice bowl"),
  "calories": number,
  "proteinG": number,
  "carbsG": number,
  "fatG": number,
  "notes": string (optional short assumption, e.g. "Assumes grilled, 1 serving"),
  "confidence": "low" | "medium" | "high"
}`

function parseSuggestion(raw: string): MealAiSuggestion | null {
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .trim()
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence?.[1]?.trim() || cleaned
  const first = candidate.indexOf('{')
  const last = candidate.lastIndexOf('}')
  if (first < 0 || last <= first) return null

  try {
    const parsed = JSON.parse(candidate.slice(first, last + 1)) as Record<string, unknown>
    const result = MealSuggestionSchema.safeParse({
      name: typeof parsed.name === 'string' ? parsed.name : '',
      calories: Number(parsed.calories) || 0,
      proteinG: Number(parsed.proteinG ?? parsed.protein) || 0,
      carbsG: Number(parsed.carbsG ?? parsed.carbs) || 0,
      fatG: Number(parsed.fatG ?? parsed.fat) || 0,
      notes: typeof parsed.notes === 'string' ? parsed.notes : undefined,
      confidence:
        parsed.confidence === 'low' ||
        parsed.confidence === 'medium' ||
        parsed.confidence === 'high'
          ? parsed.confidence
          : undefined,
    })
    if (!result.success) return null
    return {
      ...result.data,
      calories: Math.round(result.data.calories),
      proteinG: Math.round(result.data.proteinG),
      carbsG: Math.round(result.data.carbsG),
      fatG: Math.round(result.data.fatG),
    }
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const gate = await requireFeature('ai')
  if (!gate.ok) return gate.response

  let body: { imageUrl?: string; hint?: string; description?: string }
  try {
    body = (await request.json()) as {
      imageUrl?: string
      hint?: string
      description?: string
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : ''
  const description =
    (typeof body.description === 'string' ? body.description.trim() : '') ||
    (typeof body.hint === 'string' ? body.hint.trim() : '')
  const hint = typeof body.hint === 'string' ? body.hint.trim().slice(0, 400) : ''

  if (!imageUrl && !description) {
    return NextResponse.json(
      { error: 'Describe what you ate or upload a meal photo.' },
      { status: 400 }
    )
  }

  if (imageUrl && !/^https?:\/\//i.test(imageUrl) && !imageUrl.startsWith('data:image/')) {
    return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 })
  }

  try {
    let raw: string

    if (imageUrl) {
      const system = `You are a nutrition assistant for Hybrid Pro.
Look at the meal photo and estimate macros for a single serving shown.
Return ONLY valid JSON (no markdown, no prose) with this shape:
${JSON_SHAPE}
Be realistic. Prefer whole numbers. If the food is unclear, still guess best-effort with confidence "low".`

      const userText = hint
        ? `Identify this meal and estimate macros. Extra context from user: ${hint}`
        : 'Identify this meal and estimate calories plus protein, carbs, and fat for the portion shown.'

      raw = await completeGroqVisionChat([
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ])
    } else {
      const system = `You are a nutrition assistant for Hybrid Pro.
The user describes foods they ate in plain text (amounts, items, brands if any).
Estimate total macros for everything listed as one meal/log entry.
Sum all items together into a single totals object.
Return ONLY valid JSON (no markdown, no prose) with this shape:
${JSON_SHAPE}
Rules:
- Use realistic USDA-style estimates for common foods
- Respect quantities (e.g. "2 eggs", "1 cup rice", "200g chicken")
- If amount is vague, assume a normal single serving and note it in "notes"
- Prefer whole numbers
- "name" should be a short summary of the foods`

      raw = await completeGroqTextChat([
        { role: 'system', content: system },
        {
          role: 'user',
          content: `Estimate macros for this meal description:\n${description.slice(0, 800)}`,
        },
      ])
    }

    const suggestion = parseSuggestion(raw)
    if (!suggestion) {
      return NextResponse.json(
        {
          error: imageUrl
            ? 'AI returned an invalid meal estimate. Try another photo.'
            : 'AI could not read that description. Try clearer amounts (e.g. "2 eggs, 1 cup rice").',
        },
        { status: 422 }
      )
    }

    return NextResponse.json({ suggestion })
  } catch (error) {
    console.error('Analyze meal failed:', error)
    const message =
      error instanceof Error ? error.message : 'AI is unavailable right now. Please try again.'
    const friendly = /does not exist|do not have access|model_not_found/i.test(message)
      ? 'AI model is unavailable. Try again later or fill macros manually.'
      : message
    return NextResponse.json({ error: friendly }, { status: 503 })
  }
}
