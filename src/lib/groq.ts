import 'server-only'

type GroqRole = 'system' | 'user' | 'assistant' | 'tool'

export type GroqTextPart = { type: 'text'; text: string }
export type GroqImagePart = {
  type: 'image_url'
  image_url: { url: string }
}
export type GroqContentPart = GroqTextPart | GroqImagePart

export type GroqMessage = {
  role: GroqRole
  content: string | GroqContentPart[]
  tool_call_id?: string
}

export type GroqToolCall = {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export type GroqAssistantMessage = {
  role: 'assistant'
  content: string | null
  /** gpt-oss / reasoning models may put text here when content is empty */
  reasoning?: string | null
  reasoning_content?: string | null
  tool_calls?: GroqToolCall[]
}

type GroqChatResponse = {
  choices?: Array<{
    message?: GroqAssistantMessage
    finish_reason?: string
  }>
  error?: {
    message?: string
    type?: string
    code?: string
    failed_generation?: string | Record<string, unknown>
  }
}

export type GroqChatResult =
  | { kind: 'text'; content: string }
  | { kind: 'tool_call'; toolName: string; arguments: string; assistantText: string | null }

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504])

/**
 * Model picks matching your Groq org limits (console → Limits):
 *
 * | Model                    | RPM | RPD   | TPM | Why it’s here                  |
 * |--------------------------|-----|-------|-----|--------------------------------|
 * | llama-3.1-8b-instant     | 30  | 14.4K | 6K  | Highest daily volume           |
 * | allam-2-7b               | 30  | 7K    | 6K  | Separate TPM bucket            |
 * | llama-3.3-70b-versatile  | 30  | 1K    | 12K | Higher TPM headroom            |
 * | openai/gpt-oss-20b       | 30  | 1K    | 8K  | Quality fallback               |
 * | openai/gpt-oss-120b      | 30  | 1K    | 8K  | Quality fallback               |
 * | qwen/qwen3.6-27b         | 30  | 1K    | 8K  | Vision / multimodal            |
 *
 * IMPORTANT: Groq rate limits are per ORGANIZATION + per MODEL — not per API key.
 * Keys created under the same org/project share one quota. Rotating same-org keys
 * does not increase limits. Switching models uses a separate quota bucket.
 * Set GROQ_MULTI_ORG_KEYS=1 only if keys belong to different Groq orgs/accounts.
 */
const PRIMARY_CHAT_MODEL = 'llama-3.1-8b-instant'
const CHAT_FALLBACK_MODELS = [
  'allam-2-7b',
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
] as const
const PRIMARY_VISION_MODEL = 'qwen/qwen3.6-27b'

/** Default cooldown when retry-after is missing (TPM often resets in ~8–15s). */
const MODEL_COOLDOWN_MS = 10_000
const KEY_COOLDOWN_MS = 8_000
const PAIR_COOLDOWN_MS = 12_000
const MAX_FULL_ROUNDS = 3
const modelCooldownUntil = new Map<string, number>()
const keyCooldownUntil = new Map<string, number>()
const pairCooldownUntil = new Map<string, number>()

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function pairId(model: string, key: string) {
  return `${model}::${key.slice(0, 12)}`
}

/** Keys from different Groq orgs get independent quotas — enable via env. */
function keysAreMultiOrg() {
  return /^(1|true|yes)$/i.test(process.env.GROQ_MULTI_ORG_KEYS ?? '')
}

export function getGroqKeys() {
  return (process.env.GROQ_API_KEYS ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean)
}

function parseCsvList(value: string | undefined): string[] {
  if (!value?.trim()) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function uniqueModels(models: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const model of models) {
    if (!model || seen.has(model)) continue
    seen.add(model)
    out.push(model)
  }
  return out
}

/** Chat / agent / suggest chain — primary + fallbacks with separate rate-limit buckets. */
export function getChatModelChain(preferred?: string): string[] {
  const primary = preferred || process.env.GROQ_MODEL || PRIMARY_CHAT_MODEL
  const envFallbacks = parseCsvList(process.env.GROQ_MODEL_FALLBACKS)
  const defaults = envFallbacks.length > 0 ? envFallbacks : [...CHAT_FALLBACK_MODELS]
  return uniqueModels([primary, ...defaults])
}

/** Vision chain — Qwen first; text models as last-resort if vision is rate-limited. */
export function getVisionModelChain(preferred?: string): string[] {
  const primary = preferred || process.env.GROQ_VISION_MODEL || PRIMARY_VISION_MODEL
  const envFallbacks = parseCsvList(process.env.GROQ_VISION_MODEL_FALLBACKS)
  return uniqueModels([
    primary,
    ...envFallbacks,
    'llama-3.1-8b-instant',
    'allam-2-7b',
    'openai/gpt-oss-20b',
  ])
}

function getStartIndex(keysLength: number) {
  if (keysLength <= 1) return 0
  return Math.floor(Math.random() * keysLength)
}

function isCoolingDown(map: Map<string, number>, id: string) {
  return (map.get(id) ?? 0) > Date.now()
}

function coolDown(map: Map<string, number>, id: string, ms: number) {
  const until = Date.now() + Math.max(1_000, ms)
  const prev = map.get(id) ?? 0
  if (until > prev) map.set(id, until)
}

function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(120_000, Math.max(1_000, seconds * 1000))
  }
  const dateMs = Date.parse(header)
  if (Number.isFinite(dateMs)) {
    return Math.min(120_000, Math.max(1_000, dateMs - Date.now()))
  }
  return null
}

function isToolUseFailure(message: string) {
  return /tool call validation failed|did not match schema|failed to call a function|tool_use_failed|failed_generation/i.test(
    message
  )
}

function isTpmOrRateLimitMessage(message: string) {
  return /tokens per minute|tpm|rate limit|too many requests|429|requests per (day|minute)|rpd|rpm/i.test(
    message
  )
}

export function isRateLimitError(error: unknown): boolean {
  if (!error) return false
  if (error instanceof Error) return isTpmOrRateLimitMessage(error.message)
  if (typeof error === 'string') return isTpmOrRateLimitMessage(error)
  return false
}

function stringifyFailedGeneration(
  value: string | Record<string, unknown> | undefined
): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

/** Only gpt-oss / Qwen accept reasoning_* params; llama fallbacks reject them. */
function modelSupportsReasoningParams(model: string) {
  return /gpt-oss|qwen/i.test(model)
}

function stripReasoningWrappers(text: string) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/^\s*analysis[\s\S]*?assistantfinal\s*/i, '')
    .trim()
}

async function callGroq(params: {
  apiKey: string
  messages: GroqMessage[]
  tools?: unknown[]
  toolChoice?: 'auto' | 'none'
  temperature?: number
  model: string
  maxTokens?: number
  reasoningEffort?: 'none' | 'default' | 'low' | 'medium' | 'high'
  signal: AbortSignal
}) {
  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    temperature: params.temperature ?? 0.45,
    max_tokens: params.maxTokens ?? 1200,
  }
  if (params.tools?.length) {
    body.tools = params.tools
    body.tool_choice = params.toolChoice ?? 'auto'
  }
  // Prefer final answer only — gpt-oss often returns empty `content` when
  // reasoning is returned in a separate field / channel.
  // Never send these on llama/etc. or Groq returns 400.
  if (modelSupportsReasoningParams(params.model)) {
    body.reasoning_format = 'hidden'
    body.reasoning_effort = params.reasoningEffort ?? 'low'
  }

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: params.signal,
  })

  const data = (await response.json().catch(() => ({}))) as GroqChatResponse
  return { response, data }
}

function parseGroqResult(data: GroqChatResponse): GroqChatResult {
  const message = data.choices?.[0]?.message
  if (!message) throw new Error('Groq returned an empty response')

  const toolCall = message.tool_calls?.[0]
  if (toolCall?.function?.name) {
    const assistantText =
      stripReasoningWrappers(message.content ?? '') ||
      stripReasoningWrappers(message.reasoning_content ?? '') ||
      stripReasoningWrappers(message.reasoning ?? '') ||
      null
    return {
      kind: 'tool_call',
      toolName: toolCall.function.name,
      arguments: toolCall.function.arguments ?? '{}',
      assistantText,
    }
  }

  const content =
    stripReasoningWrappers(message.content ?? '') ||
    stripReasoningWrappers(message.reasoning_content ?? '') ||
    stripReasoningWrappers(message.reasoning ?? '')

  if (!content) throw new Error('Groq returned an empty response')
  return { kind: 'text', content }
}

type RunOptions = {
  tools?: unknown[]
  toolChoice?: 'auto' | 'none'
  temperature?: number
  allowToolFallback?: boolean
  /** Explicit single model; otherwise use modelChain / chat defaults. */
  model?: string
  /** Ordered failover list (separate rate-limit buckets). */
  modelChain?: string[]
  maxTokens?: number
  timeoutMs?: number
  reasoningEffort?: 'none' | 'default' | 'low' | 'medium' | 'high'
}

function orderedKeys(keys: string[]): string[] {
  const startIndex = getStartIndex(keys.length)
  return keys.map((_, i) => keys[(startIndex + i) % keys.length])
}

function orderedModels(models: string[]): string[] {
  // Prefer models that are not cooling down, but still include all for a full round.
  const ready = models.filter((m) => !isCoolingDown(modelCooldownUntil, m))
  const cooling = models.filter((m) => isCoolingDown(modelCooldownUntil, m))
  return [...ready, ...cooling]
}

async function attemptRoundRobin(
  messages: GroqMessage[],
  keys: string[],
  modelChain: string[],
  options: RunOptions
): Promise<{
  result?: GroqChatResult
  lastError: string
  failedGeneration: string | null
  sawToolSchemaError: boolean
  longestRetryMs: number
  attempts: number
}> {
  let lastError = 'Groq request failed'
  let failedGeneration: string | null = null
  let sawToolSchemaError = false
  let longestRetryMs = 0
  let attempts = 0

  const models = orderedModels(modelChain)
  const keysRotated = orderedKeys(keys)
  const multiOrg = keysAreMultiOrg()

  for (const model of models) {
    if (
      !multiOrg &&
      isCoolingDown(modelCooldownUntil, model) &&
      models.some((m) => !isCoolingDown(modelCooldownUntil, m))
    ) {
      // Same-org: model TPM is shared across all keys — skip to a ready model.
      continue
    }

    for (const key of keysRotated) {
      const pair = pairId(model, key)
      if (isCoolingDown(pairCooldownUntil, pair)) continue
      if (
        isCoolingDown(keyCooldownUntil, key) &&
        keysRotated.some((k) => !isCoolingDown(keyCooldownUntil, k))
      ) {
        continue
      }

      attempts += 1
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000)

      try {
        const { response, data } = await callGroq({
          apiKey: key,
          messages,
          tools: options.tools,
          toolChoice: options.toolChoice,
          temperature: options.temperature,
          model,
          maxTokens: options.maxTokens,
          reasoningEffort: options.reasoningEffort,
          signal: controller.signal,
        })

        if (response.ok) {
          try {
            return {
              result: parseGroqResult(data),
              lastError,
              failedGeneration,
              sawToolSchemaError,
              longestRetryMs,
              attempts,
            }
          } catch (parseError) {
            lastError =
              parseError instanceof Error ? parseError.message : 'Groq returned an empty response'
            continue
          }
        }

        lastError = data.error?.message || `Groq error ${response.status}`
        failedGeneration = stringifyFailedGeneration(data.error?.failed_generation)

        if (isToolUseFailure(lastError) || data.error?.code === 'tool_use_failed') {
          sawToolSchemaError = true
          coolDown(modelCooldownUntil, model, MODEL_COOLDOWN_MS)
          break
        }

        if (response.status === 429 || isTpmOrRateLimitMessage(lastError)) {
          const retryMs =
            parseRetryAfterMs(response.headers.get('retry-after')) ?? PAIR_COOLDOWN_MS
          longestRetryMs = Math.max(longestRetryMs, retryMs)
          coolDown(pairCooldownUntil, pair, retryMs)
          coolDown(keyCooldownUntil, key, Math.min(retryMs, KEY_COOLDOWN_MS))
          coolDown(modelCooldownUntil, model, retryMs)
          lastError = `Rate limited on ${model}. Trying next model/key…`

          // Same org: other keys share this model's TPM — jump to next model.
          // Multi-org keys (GROQ_MULTI_ORG_KEYS=1): keep trying remaining keys.
          if (!multiOrg) break
          continue
        }

        if (!RETRYABLE_STATUS.has(response.status)) {
          if (response.status === 401 || response.status === 403) {
            coolDown(keyCooldownUntil, key, 60_000)
            lastError = `Key rejected (${response.status}). Trying next key…`
            continue
          }
          const err = new Error(lastError) as Error & { failedGeneration?: string | null }
          err.failedGeneration = failedGeneration
          throw err
        }
      } catch (error) {
        if (error instanceof Error && (error as { failedGeneration?: string }).failedGeneration) {
          throw error
        }
        lastError =
          error instanceof Error && error.name === 'AbortError'
            ? 'Groq request timed out'
            : error instanceof Error
              ? error.message
              : lastError
        if (isToolUseFailure(lastError)) {
          sawToolSchemaError = true
          coolDown(modelCooldownUntil, model, MODEL_COOLDOWN_MS)
          break
        }
        if (isTpmOrRateLimitMessage(lastError)) {
          coolDown(pairCooldownUntil, pair, PAIR_COOLDOWN_MS)
          coolDown(keyCooldownUntil, key, KEY_COOLDOWN_MS)
          coolDown(modelCooldownUntil, model, MODEL_COOLDOWN_MS)
          longestRetryMs = Math.max(longestRetryMs, PAIR_COOLDOWN_MS)
          if (!multiOrg) break
          continue
        }
        continue
      } finally {
        clearTimeout(timeout)
      }
    }
  }

  return { lastError, failedGeneration, sawToolSchemaError, longestRetryMs, attempts }
}

async function runGroqChat(
  messages: GroqMessage[],
  options: RunOptions = {}
): Promise<GroqChatResult & { failedGeneration?: string | null }> {
  const keys = getGroqKeys()
  if (keys.length === 0) {
    throw new Error('GROQ_API_KEYS is not configured')
  }

  const modelChain = uniqueModels(
    options.modelChain?.length
      ? options.modelChain
      : options.model
        ? [options.model]
        : getChatModelChain()
  )

  let lastAttempt: Awaited<ReturnType<typeof attemptRoundRobin>> | null = null

  for (let round = 0; round < MAX_FULL_ROUNDS; round++) {
    const attempt = await attemptRoundRobin(messages, keys, modelChain, options)
    lastAttempt = attempt
    if (attempt.result) return attempt.result

    const rateLimited =
      !attempt.sawToolSchemaError && isTpmOrRateLimitMessage(attempt.lastError)

    if (!rateLimited) break
    if (round >= MAX_FULL_ROUNDS - 1) break

    // Full model×key sweep hit limits — wait for TPM window, then rotate again.
    const waitMs = Math.min(
      10_000,
      Math.max(1_500, Math.floor((attempt.longestRetryMs || MODEL_COOLDOWN_MS) * 0.5))
    )
    await sleep(waitMs)
  }

  if (
    lastAttempt?.sawToolSchemaError &&
    options.allowToolFallback !== false &&
    options.tools?.length &&
    options.toolChoice !== 'none'
  ) {
    try {
      return await runGroqChat(messages, {
        ...options,
        temperature: Math.max(0.1, (options.temperature ?? 0.3) - 0.15),
        allowToolFallback: false,
      })
    } catch {
      // continue to surface failed generation
    }
  }

  const lastError = lastAttempt?.lastError ?? 'Groq request failed'
  const err = new Error(
    isTpmOrRateLimitMessage(lastError)
      ? 'AI is busy right now (rate limit). Wait a few seconds and try again.'
      : lastError
  ) as Error & { failedGeneration?: string | null }
  err.failedGeneration = lastAttempt?.failedGeneration ?? null
  throw err
}

/** Legacy text-only completion. */
export async function completeGroqChat(messages: GroqMessage[]) {
  const result = await runGroqChat(messages, {
    toolChoice: 'none',
    temperature: 0.55,
    modelChain: getChatModelChain(),
    maxTokens: 1000,
  })
  if (result.kind !== 'text') {
    throw new Error('Expected text response from Groq')
  }
  return result.content
}

/** Agent chat with optional tool calling — rotates all models × keys on rate limit. */
export async function completeGroqAgentChat(
  messages: GroqMessage[],
  tools: unknown[]
): Promise<GroqChatResult> {
  return runGroqChat(messages, {
    tools,
    toolChoice: 'auto',
    temperature: 0.2,
    allowToolFallback: true,
    modelChain: getChatModelChain(),
    maxTokens: 900,
    timeoutMs: 25_000,
    reasoningEffort: 'low',
  })
}

/** Plain text completion used when tool calling fails / form fill. */
export async function completeGroqTextChat(messages: GroqMessage[]) {
  const result = await runGroqChat(messages, {
    toolChoice: 'none',
    temperature: 0.25,
    allowToolFallback: false,
    modelChain: getChatModelChain(),
    maxTokens: 800,
    timeoutMs: 25_000,
    reasoningEffort: 'low',
  })
  if (result.kind === 'text') return result.content
  if (result.kind === 'tool_call') {
    return result.arguments || result.assistantText || ''
  }
  return ''
}

/** Vision / multimodal — Qwen 3.6 (only strong vision model on Groq right now). */
export async function completeGroqVisionChat(
  messages: GroqMessage[],
  options?: { maxTokens?: number; temperature?: number }
) {
  const result = await runGroqChat(messages, {
    toolChoice: 'none',
    temperature: options?.temperature ?? 0.1,
    allowToolFallback: false,
    modelChain: getVisionModelChain(),
    maxTokens: options?.maxTokens ?? 1800,
    timeoutMs: 45_000,
    // Qwen 3.6: reasoning_effort=none keeps output clean (no thinking tokens).
    reasoningEffort: 'none',
  })

  if (result.kind !== 'text') {
    throw new Error('Expected text response from Groq vision')
  }
  return result.content
}

export function getFailedGeneration(error: unknown): string | null {
  if (error && typeof error === 'object' && 'failedGeneration' in error) {
    const value = (error as { failedGeneration?: string | null }).failedGeneration
    return value ?? null
  }
  return null
}
