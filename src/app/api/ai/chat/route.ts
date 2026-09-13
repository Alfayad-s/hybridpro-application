import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import {
  AGENT_SYSTEM_PROMPT,
  JSON_FALLBACK_PROMPT,
  PROPOSE_ACTIONS_TOOL,
} from '@/lib/ai/agent-tools'
import type { AgentContext } from '@/lib/ai/agent-types'
import { leanContextForModel } from '@/lib/ai/lean-context'
import {
  completeGroqAgentChat,
  completeGroqTextChat,
  completeGroqVisionChat,
  getFailedGeneration,
  isRateLimitError,
} from '@/lib/ai/complete'
import type { GroqContentPart, GroqMessage } from '@/lib/groq'
import { extractProposalPayload, looksLikeMutationIntent, looksLikePhotoExerciseImport } from '@/lib/ai/extract-proposal'
import { validateRawProposal } from '@/lib/ai/validate-proposal'
import { formatRagContextBlock, retrieveRagChunks } from '@/lib/ai/rag'

export const maxDuration = 60

type ChatRequest = {
  messages?: GroqMessage[]
  context?: AgentContext
}

const MAX_IMAGE_DATA_URL = 900_000

function textFromContent(content: GroqMessage['content']): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text)
    .join('\n')
}

function hasImageParts(content: GroqMessage['content']): boolean {
  return Array.isArray(content) && content.some((p) => p.type === 'image_url')
}

function cleanMessages(messages: GroqMessage[] | undefined): GroqMessage[] {
  if (!Array.isArray(messages)) return []

  const cleaned: GroqMessage[] = []

  for (const message of messages) {
    if (message.role !== 'user' && message.role !== 'assistant') continue

    if (typeof message.content === 'string') {
      const content = message.content.trim().slice(0, 2000)
      if (content) cleaned.push({ role: message.role, content })
      continue
    }

    if (!Array.isArray(message.content)) continue

    const parts: GroqContentPart[] = []
    for (const part of message.content) {
      if (part.type === 'text' && typeof part.text === 'string' && part.text.trim()) {
        parts.push({ type: 'text', text: part.text.trim().slice(0, 2000) })
        continue
      }
      if (
        part.type === 'image_url' &&
        typeof part.image_url?.url === 'string' &&
        (part.image_url.url.startsWith('data:image/') ||
          /^https?:\/\//i.test(part.image_url.url)) &&
        part.image_url.url.length <= MAX_IMAGE_DATA_URL
      ) {
        parts.push({ type: 'image_url', image_url: { url: part.image_url.url } })
      }
    }

    if (parts.length > 0) {
      cleaned.push({ role: message.role, content: parts })
    }
  }

  return cleaned.slice(-6)
}

function sanitizeContext(context: unknown): AgentContext | null {
  if (!context || typeof context !== 'object') return null
  const c = context as AgentContext
  if (!c.generatedAt || !Array.isArray(c.plans) || !Array.isArray(c.exerciseCatalog)) {
    return null
  }
  if (!Array.isArray(c.historyIds)) return null
  if (!c.meals || typeof c.meals !== 'object') {
    c.meals = {
      today: new Date().toISOString().slice(0, 10),
      dailyCalorieGoal: 2500,
      dailyProteinGoal: 160,
      dailyCarbsGoal: 250,
      dailyFatGoal: 70,
      dailyWaterGoalMl: 3000,
      waterTotalMl: 0,
      todaysMeals: [],
      recentWater: [],
      activeMealPlan: null,
    }
  } else {
    if (typeof c.meals.dailyCarbsGoal !== 'number') c.meals.dailyCarbsGoal = 250
    if (typeof c.meals.dailyFatGoal !== 'number') c.meals.dailyFatGoal = 70
  }
  return c
}

function buildContextBlock(context: AgentContext) {
  const lean = leanContextForModel(context)
  const latestCustom = lean.customExercises[0]
  const hint = latestCustom
    ? `\nLatest custom exercise (for "that/this/it"): id=${latestCustom.id}, name="${latestCustom.name}".`
    : '\nNo custom exercises yet.'
  const cal = lean.calendar
  const planHint = lean.activePlanId
    ? `\nActive plan: ${lean.activePlanId}. Calendar: today=${cal.todayName} (${cal.todayWeekday}), tomorrow=${cal.tomorrowName} (${cal.tomorrowWeekday}). For "create workout for tomorrow/Monday", propose add_plan_day + add_exercise_to_day using catalog ids and recovery.`
    : `\nNo plans yet — create_plan first if the user wants a day workout. Calendar: today=${cal.todayName} (${cal.todayWeekday}), tomorrow=${cal.tomorrowName} (${cal.tomorrowWeekday}).`

  return `Hybrid Pro app snapshot (compact):${hint}${planHint}\n${JSON.stringify(lean)}`
}

function rateLimitResponse(error: unknown) {
  return NextResponse.json(
    { error: friendlyAiError(error) },
    {
      status: 429,
      headers: { 'Retry-After': '5' },
    }
  )
}

function friendlyAiError(error: unknown): string {
  if (isRateLimitError(error)) {
    return 'AI is busy right now (rate limit). Wait a few seconds and try again.'
  }
  if (error instanceof Error && error.message) {
    if (/tokens per minute|tpm|rate limit|429/i.test(error.message)) {
      return 'AI is busy right now (rate limit). Wait a few seconds and try again.'
    }
    if (/timed out|timeout|abort/i.test(error.message)) {
      return 'AI took too long to respond. Please try again.'
    }
    if (/empty response/i.test(error.message)) {
      return 'AI returned an empty reply. Please try again.'
    }
    if (error.message.length > 180) {
      return 'AI is unavailable right now. Please try again.'
    }
    return error.message
  }
  return 'AI is unavailable right now. Please try again.'
}

function proposalResponse(
  raw: { summary?: string; actions?: unknown[] },
  context: AgentContext,
  assistantText?: string | null,
  ragHits = 0
) {
  const validated = validateRawProposal(raw, context)
  if (!validated.ok) {
    return NextResponse.json({
      message: {
        role: 'assistant',
        content:
          assistantText?.trim() ||
          `I couldn't apply that change (${validated.error}). Try naming the exercise/plan and the create/update/delete action clearly.`,
      },
      ragHits,
    })
  }

  return NextResponse.json({
    message: {
      role: 'assistant',
      content: assistantText?.trim() || validated.proposal.summary,
      proposal: validated.proposal,
    },
    ragHits,
  })
}

async function jsonFallbackResponse(
  systemMessages: GroqMessage[],
  userMessages: GroqMessage[],
  context: AgentContext,
  lastUserText: string,
  ragHits = 0
) {
  const text = await completeGroqTextChat([
    ...systemMessages,
    ...userMessages,
    { role: 'system', content: JSON_FALLBACK_PROMPT },
  ])

  const extracted = extractProposalPayload(text)
  if (extracted?.actions) {
    return proposalResponse(extracted, context, null, ragHits)
  }

  if (looksLikeMutationIntent(lastUserText) && !extracted) {
    const latest = context.customExercises[0]
    return NextResponse.json({
      message: {
        role: 'assistant',
        content:
          text.trim() ||
          (latest
            ? `I can update "${latest.name}" if you confirm. Say something like: "Update ${latest.name} with these steps: …"`
            : 'Tell me what to create, update, or delete (include the exercise/plan name).'),
      },
      ragHits,
    })
  }

  return NextResponse.json({
    message: { role: 'assistant', content: text.trim() || 'How can I help with your training?' },
    ragHits,
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: ChatRequest
  try {
    body = (await request.json()) as ChatRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const userMessages = cleanMessages(body.messages)
  if (userMessages.length === 0 || userMessages[userMessages.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Send a user message first' }, { status: 400 })
  }

  const context = sanitizeContext(body.context)
  if (!context) {
    return NextResponse.json({ error: 'App context is required' }, { status: 400 })
  }

  const systemMessages: GroqMessage[] = [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
    { role: 'system', content: buildContextBlock(context) },
  ]
  const lastMessage = userMessages[userMessages.length - 1]
  const lastUserText = textFromContent(lastMessage.content)
  const lastHasImages = hasImageParts(lastMessage.content)

  let ragHitCount = 0
  try {
    const chunks = await retrieveRagChunks({
      userId: user.id,
      query: lastUserText || 'workout',
    })
    ragHitCount = chunks.length
    const ragBlock = formatRagContextBlock(chunks)
    if (ragBlock) {
      systemMessages.push({ role: 'system', content: ragBlock })
    }
  } catch (err) {
    console.warn('RAG retrieval skipped:', err)
  }

  // Multimodal turn → vision model (still tries to extract action proposals from text)
  if (lastHasImages) {
    try {
      const visionText = await completeGroqVisionChat(
        [
          ...systemMessages,
          {
            role: 'system',
            content: `The user attached image(s).

If the image shows a workout list, exercise sheet, whiteboard, app screenshot, or gym notes:
1. Read every exercise name (and sets×reps when visible).
2. Reply with propose_gymtrack_actions JSON — one create_custom_exercise per NEW exercise (skip names already in exerciseCatalog/customExercises).
3. Fill muscleGroup, equipment, difficulty, and short instructions when you can infer them from the name/photo.
4. Also include plan/day actions if they ask to build a workout from the photo.

If the image is food and they want to log it: propose log_meal with estimated macros.
Otherwise describe what you see for coaching, then ask what to do.

When proposing actions, output ONLY the JSON proposal (summary + actions array).`,
          },
          ...userMessages,
        ],
        { maxTokens: 2200, temperature: 0.2 }
      )

      const embedded = extractProposalPayload(visionText)
      const wantsImport = looksLikePhotoExerciseImport(lastUserText, true)
      if (embedded?.actions && (wantsImport || looksLikeMutationIntent(lastUserText || 'create'))) {
        return proposalResponse(embedded, context, visionText, ragHitCount)
      }

      return NextResponse.json({
        message: { role: 'assistant', content: visionText.trim() || 'I can see the image — what would you like me to do with it?' },
        ragHits: ragHitCount,
      })
    } catch (error) {
      console.error('AI vision chat failed:', error)
      if (isRateLimitError(error)) {
        return rateLimitResponse(error)
      }
      return NextResponse.json({ error: friendlyAiError(error) }, { status: 503 })
    }
  }

  try {
    const result = await completeGroqAgentChat(
      [...systemMessages, ...userMessages],
      [PROPOSE_ACTIONS_TOOL]
    )

    if (result.kind === 'text') {
      const embedded = extractProposalPayload(result.content)
      if (embedded?.actions && looksLikeMutationIntent(lastUserText)) {
        return proposalResponse(embedded, context, null, ragHitCount)
      }
      const content = result.content.trim()
      if (!content) {
        return jsonFallbackResponse(systemMessages, userMessages, context, lastUserText, ragHitCount)
      }
      return NextResponse.json({
        message: { role: 'assistant', content },
        ragHits: ragHitCount,
      })
    }

    if (result.toolName !== 'propose_gymtrack_actions') {
      return jsonFallbackResponse(systemMessages, userMessages, context, lastUserText, ragHitCount)
    }

    let parsedArgs: { summary?: string; actions?: unknown[] } | null = null
    try {
      parsedArgs = JSON.parse(result.arguments) as { summary?: string; actions?: unknown[] }
    } catch {
      parsedArgs = extractProposalPayload(result.arguments)
    }

    if (!parsedArgs) {
      return jsonFallbackResponse(systemMessages, userMessages, context, lastUserText, ragHitCount)
    }

    return proposalResponse(parsedArgs, context, result.assistantText, ragHitCount)
  } catch (error) {
    console.error('AI chat failed:', error)

    const failedGeneration = getFailedGeneration(error)
    if (failedGeneration) {
      const salvaged = extractProposalPayload(failedGeneration)
      if (salvaged?.actions) {
        return proposalResponse(salvaged, context, null, ragHitCount)
      }
    }

    if (isRateLimitError(error)) {
      return rateLimitResponse(error)
    }

    try {
      return await jsonFallbackResponse(
        systemMessages,
        userMessages,
        context,
        lastUserText,
        ragHitCount
      )
    } catch (fallbackError) {
      console.error('AI JSON fallback failed:', fallbackError)
      if (isRateLimitError(fallbackError)) {
        return rateLimitResponse(fallbackError)
      }
      return NextResponse.json(
        { error: friendlyAiError(error) },
        { status: 503 }
      )
    }
  }
}
