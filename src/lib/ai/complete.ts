import 'server-only'

import {
  completeGroqAgentChat as groqAgentChat,
  completeGroqChat as groqChat,
  completeGroqTextChat as groqTextChat,
  completeGroqVisionChat as groqVisionChat,
  getFailedGeneration,
  getGroqKeys,
  isRateLimitError,
  type GroqChatResult,
  type GroqMessage,
} from '@/lib/groq'

export { getFailedGeneration, isRateLimitError }
export type { GroqChatResult, GroqMessage }

type ChatMode = 'text' | 'chat' | 'agent' | 'vision'

type OpenAiToolCall = {
  id?: string
  type?: string
  function?: { name?: string; arguments?: string }
}

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null
      tool_calls?: OpenAiToolCall[]
    }
  }>
  error?: { message?: string }
}

type GeminiPart = {
  text?: string
  functionCall?: { name?: string; args?: Record<string, unknown> }
  inline_data?: { mime_type: string; data: string }
  inlineData?: { mimeType: string; data: string }
}

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] }
    finishReason?: string
  }>
  error?: { message?: string; status?: string }
}

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']
const OPENAI_CHAT_MODELS = ['gpt-4o-mini', 'gpt-4o']
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

function geminiKey() {
  return process.env.GOOGLE_GEMINI_API_KEY?.trim() || ''
}

function openAiKey() {
  return process.env.OPENAI_API_KEY?.trim() || ''
}

export function isGeminiAvailable() {
  return Boolean(geminiKey())
}

export function isOpenAiChatAvailable() {
  return Boolean(openAiKey())
}

export function isGroqAvailable() {
  return getGroqKeys().length > 0
}

function contentToText(content: GroqMessage['content']): string {
  if (typeof content === 'string') return content
  return content
    .filter((part) => part.type === 'text')
    .map((part) => ('text' in part ? part.text : ''))
    .join('\n')
    .trim()
}

function parseDataUrl(url: string): { mime: string; data: string } | null {
  const match = url.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return { mime: match[1], data: match[2] }
}

function groqToolsToGemini(tools: unknown[] | undefined) {
  if (!tools?.length) return undefined
  const declarations = tools
    .map((tool) => {
      const fn = (tool as { function?: { name?: string; description?: string; parameters?: unknown } })
        .function
      if (!fn?.name) return null
      return {
        name: fn.name,
        description: fn.description || '',
        parameters: fn.parameters ?? { type: 'object', properties: {} },
      }
    })
    .filter(Boolean)
  if (!declarations.length) return undefined
  return [{ functionDeclarations: declarations }]
}

function groqMessagesToGemini(messages: GroqMessage[]) {
  const systemChunks: string[] = []
  const contents: Array<{ role: 'user' | 'model'; parts: Record<string, unknown>[] }> = []

  for (const message of messages) {
    if (message.role === 'system') {
      const text = contentToText(message.content)
      if (text) systemChunks.push(text)
      continue
    }
    if (message.role === 'tool') {
      const text = contentToText(message.content)
      contents.push({
        role: 'user',
        parts: [{ text: text || 'Tool result received.' }],
      })
      continue
    }

    const role = message.role === 'assistant' ? 'model' : 'user'
    const parts: Record<string, unknown>[] = []

    if (typeof message.content === 'string') {
      if (message.content.trim()) parts.push({ text: message.content })
    } else {
      for (const part of message.content) {
        if (part.type === 'text' && part.text.trim()) {
          parts.push({ text: part.text })
          continue
        }
        if (part.type === 'image_url') {
          const parsed = parseDataUrl(part.image_url.url)
          if (parsed) {
            parts.push({ inline_data: { mime_type: parsed.mime, data: parsed.data } })
          } else {
            parts.push({ text: `[Image] ${part.image_url.url}` })
          }
        }
      }
    }

    if (!parts.length) parts.push({ text: ' ' })
    contents.push({ role, parts })
  }

  return {
    systemInstruction: systemChunks.length
      ? { parts: [{ text: systemChunks.join('\n\n') }] }
      : undefined,
    contents,
  }
}

function parseGeminiResult(data: GeminiResponse): GroqChatResult {
  if (data.error?.message) throw new Error(data.error.message)
  const parts = data.candidates?.[0]?.content?.parts ?? []
  const fn = parts.find((part) => part.functionCall?.name)?.functionCall
  const text = parts
    .map((part) => part.text ?? '')
    .join('\n')
    .trim()

  if (fn?.name) {
    return {
      kind: 'tool_call',
      toolName: fn.name,
      arguments: JSON.stringify(fn.args ?? {}),
      assistantText: text || null,
    }
  }
  if (!text) throw new Error('Gemini returned an empty response')
  return { kind: 'text', content: text }
}

async function callGemini(params: {
  messages: GroqMessage[]
  tools?: unknown[]
  temperature: number
  maxTokens: number
  timeoutMs: number
}): Promise<GroqChatResult> {
  const key = geminiKey()
  if (!key) throw new Error('Gemini is not configured')

  const { systemInstruction, contents } = groqMessagesToGemini(params.messages)
  const tools = groqToolsToGemini(params.tools)
  let lastError = 'Gemini request failed'

  for (const model of GEMINI_MODELS) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), params.timeoutMs)
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
          },
          body: JSON.stringify({
            systemInstruction,
            contents,
            generationConfig: {
              temperature: params.temperature,
              maxOutputTokens: params.maxTokens,
            },
            ...(tools
              ? {
                  tools,
                  toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
                }
              : {}),
          }),
          signal: controller.signal,
        }
      )
      const data = (await response.json().catch(() => ({}))) as GeminiResponse
      if (!response.ok) {
        lastError = data.error?.message || `Gemini error ${response.status}`
        if (response.status === 401 || response.status === 403) break
        continue
      }
      return parseGeminiResult(data)
    } catch (error) {
      lastError =
        error instanceof Error && error.name === 'AbortError'
          ? 'Gemini request timed out'
          : error instanceof Error
            ? error.message
            : lastError
    } finally {
      clearTimeout(timeout)
    }
  }

  throw new Error(lastError)
}

function parseOpenAiResult(data: OpenAiChatResponse): GroqChatResult {
  if (data.error?.message) throw new Error(data.error.message)
  const message = data.choices?.[0]?.message
  if (!message) throw new Error('OpenAI returned an empty response')

  const toolCall = message.tool_calls?.[0]
  if (toolCall?.function?.name) {
    return {
      kind: 'tool_call',
      toolName: toolCall.function.name,
      arguments: toolCall.function.arguments ?? '{}',
      assistantText: message.content?.trim() || null,
    }
  }

  const content = message.content?.trim()
  if (!content) throw new Error('OpenAI returned an empty response')
  return { kind: 'text', content }
}

async function callOpenAi(params: {
  messages: GroqMessage[]
  tools?: unknown[]
  temperature: number
  maxTokens: number
  timeoutMs: number
}): Promise<GroqChatResult> {
  const key = openAiKey()
  if (!key) throw new Error('OpenAI is not configured')

  let lastError = 'OpenAI request failed'
  for (const model of OPENAI_CHAT_MODELS) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), params.timeoutMs)
    try {
      const body: Record<string, unknown> = {
        model,
        messages: params.messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
      }
      if (params.tools?.length) {
        body.tools = params.tools
        body.tool_choice = 'auto'
      }

      const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      const data = (await response.json().catch(() => ({}))) as OpenAiChatResponse
      if (!response.ok) {
        lastError = data.error?.message || `OpenAI error ${response.status}`
        if (response.status === 401 || response.status === 403) break
        continue
      }
      return parseOpenAiResult(data)
    } catch (error) {
      lastError =
        error instanceof Error && error.name === 'AbortError'
          ? 'OpenAI request timed out'
          : error instanceof Error
            ? error.message
            : lastError
    } finally {
      clearTimeout(timeout)
    }
  }

  throw new Error(lastError)
}

async function runWithProviderFallback(
  mode: ChatMode,
  messages: GroqMessage[],
  tools?: unknown[],
  visionOptions?: { maxTokens?: number; temperature?: number }
): Promise<GroqChatResult> {
  const temperature =
    mode === 'agent' ? 0.2 : mode === 'vision' ? (visionOptions?.temperature ?? 0.1) : mode === 'chat' ? 0.55 : 0.25
  const maxTokens =
    mode === 'vision' ? (visionOptions?.maxTokens ?? 1800) : mode === 'agent' ? 900 : mode === 'chat' ? 1000 : 800
  const timeoutMs = mode === 'vision' ? 45_000 : 25_000
  const errors: string[] = []

  if (isGeminiAvailable()) {
    try {
      return await callGemini({
        messages,
        tools: mode === 'agent' ? tools : undefined,
        temperature,
        maxTokens,
        timeoutMs,
      })
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Gemini failed')
    }
  }

  if (isOpenAiChatAvailable()) {
    try {
      return await callOpenAi({
        messages,
        tools: mode === 'agent' ? tools : undefined,
        temperature,
        maxTokens,
        timeoutMs,
      })
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'OpenAI failed')
    }
  }

  if (isGroqAvailable()) {
    if (mode === 'agent') return groqAgentChat(messages, tools ?? [])
    if (mode === 'vision') {
      const content = await groqVisionChat(messages, visionOptions)
      return { kind: 'text', content }
    }
    if (mode === 'chat') {
      const content = await groqChat(messages)
      return { kind: 'text', content }
    }
    const content = await groqTextChat(messages)
    return { kind: 'text', content }
  }

  throw new Error(
    errors[0] || 'No AI provider is configured. Add GOOGLE_GEMINI_API_KEY, OPENAI_API_KEY, or GROQ_API_KEYS.'
  )
}

function textFromResult(result: GroqChatResult) {
  if (result.kind === 'text') return result.content
  return result.arguments || result.assistantText || ''
}

export async function completeGroqChat(messages: GroqMessage[]) {
  const result = await runWithProviderFallback('chat', messages)
  if (result.kind !== 'text') throw new Error('Expected text response from AI')
  return result.content
}

export async function completeGroqAgentChat(
  messages: GroqMessage[],
  tools: unknown[]
): Promise<GroqChatResult> {
  return runWithProviderFallback('agent', messages, tools)
}

export async function completeGroqTextChat(messages: GroqMessage[]) {
  return textFromResult(await runWithProviderFallback('text', messages))
}

export async function completeGroqVisionChat(
  messages: GroqMessage[],
  options?: { maxTokens?: number; temperature?: number }
) {
  const result = await runWithProviderFallback('vision', messages, undefined, options)
  if (result.kind !== 'text') throw new Error('Expected text response from AI vision')
  return result.content
}
