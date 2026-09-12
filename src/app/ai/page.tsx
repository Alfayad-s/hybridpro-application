'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Bot,
  Eraser,
  FileText,
  MoreVertical,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { AgentProposalCard } from '@/components/ai/AgentProposalCard'
import { FormattedAiMessage } from '@/components/body-composition/AnalysisSections'
import { PromptInputBox } from '@/components/ui/ai-prompt-box'
import type { AgentProposal } from '@/lib/ai/agent-types'
import { buildAgentContext } from '@/lib/ai/build-agent-context'
import {
  fileToCompressedDataUrl,
  isSupportedChatFile,
  readTextFile,
} from '@/lib/ai/chat-files'
import { executeAgentActions } from '@/lib/ai/execute-agent-actions'
import { stripMarkdown } from '@/lib/body-composition/parse-analysis'
import { useAuthStore } from '@/stores/authStore'
import {
  type AiChatMessage,
  type ChatAttachment,
  useAiChatStore,
} from '@/stores/aiChatStore'
import { useProfileStore } from '@/stores/profileStore'

type ApiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

type ApiChatMessage = {
  role: 'user' | 'assistant'
  content: string | ApiContentPart[]
}

const STARTERS = [
  'Build me a push day workout',
  'What should I train today?',
  'Start a chest workout for me',
  'Log 80kg bench for set 1',
  'Set my goal weight to 75kg',
  'Switch to dark theme',
]

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function TypewriterText({
  text,
  enabled,
  onComplete,
}: {
  text: string
  enabled: boolean
  onComplete?: () => void
}) {
  const [shown, setShown] = useState(enabled ? '' : text)
  const doneRef = useRef(!enabled)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (!enabled) {
      setShown(text)
      return
    }

    doneRef.current = false
    setShown('')
    let index = 0
    const step = Math.max(1, Math.ceil(text.length / 180))
    const id = window.setInterval(() => {
      index = Math.min(text.length, index + step)
      setShown(text.slice(0, index))
      if (index >= text.length) {
        window.clearInterval(id)
        if (!doneRef.current) {
          doneRef.current = true
          onCompleteRef.current?.()
        }
      }
    }, 18)

    return () => window.clearInterval(id)
  }, [text, enabled])

  return (
    <>
      {shown}
      {enabled && shown.length < text.length && (
        <span className="inline-block w-[2px] h-[1em] ml-0.5 align-[-0.1em] bg-primary/80 animate-pulse" />
      )}
    </>
  )
}

function toApiMessages(messages: AiChatMessage[]): ApiChatMessage[] {
  return messages
    .filter((m) => m.role === 'user' || (m.role === 'assistant' && !m.proposal))
    .map((m) => {
      const images = (m.attachments ?? []).filter((a) => a.kind === 'image' && a.dataUrl)
      const textBits = [
        m.content.trim(),
        ...(m.attachments ?? [])
          .filter((a) => a.kind === 'text' && a.text)
          .map((a) => `\n\n[Attached ${a.name}]\n${a.text}`),
      ]
        .filter(Boolean)
        .join('')

      if (images.length === 0) {
        return { role: m.role, content: textBits || '(attachment)' }
      }

      const parts: ApiContentPart[] = [
        { type: 'text', text: textBits || 'Please look at the attached image(s).' },
        ...images.map((img) => ({
          type: 'image_url' as const,
          image_url: { url: img.dataUrl! },
        })),
      ]
      return { role: m.role, content: parts }
    })
}

export default function AiChatPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const profileAvatarUrl = useProfileStore((s) => s.avatarUrl)
  const avatarUrl =
    profileAvatarUrl ||
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined) ||
    null
  const userInitial =
    user?.user_metadata?.full_name?.charAt(0) ||
    user?.user_metadata?.name?.charAt(0) ||
    user?.email?.charAt(0) ||
    'U'

  const messages = useAiChatStore((s) => s.messages)
  const setMessages = useAiChatStore((s) => s.setMessages)
  const clearChat = useAiChatStore((s) => s.clearChat)
  const deleteChat = useAiChatStore((s) => s.deleteChat)
  const hydrated = useAiChatStore((s) => s.hydrated)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [lastRagHits, setLastRagHits] = useState(0)
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [retryPayload, setRetryPayload] = useState<{
    text: string
    files: File[]
  } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const executingRef = useRef(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSpeechSupported('speechSynthesis' in window)
  }, [])

  useEffect(() => {
    const finish = () => useAiChatStore.getState().setHydrated(true)
    const unsub = useAiChatStore.persist.onFinishHydration(finish)
    if (useAiChatStore.persist.hasHydrated()) finish()
    return unsub
  }, [])

  useEffect(() => {
    if (!hydrated) return
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isLoading, hydrated])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setSpeakingId(null)
  }, [])

  const handleClearChat = useCallback(() => {
    setMenuOpen(false)
    if (!confirm('Clear this chat? Messages will be removed.')) return
    stopSpeaking()
    setError(null)
    setRetryPayload(null)
    setLastRagHits(0)
    clearChat()
  }, [clearChat, stopSpeaking])

  const handleDeleteChat = useCallback(() => {
    setMenuOpen(false)
    if (!confirm('Delete this chat? This clears the conversation and leaves the AI screen.')) {
      return
    }
    stopSpeaking()
    setError(null)
    setRetryPayload(null)
    setLastRagHits(0)
    deleteChat()
    router.back()
  }, [deleteChat, router, stopSpeaking])

  const readAloud = useCallback(
    (message: AiChatMessage) => {
      if (!speechSupported) return

      if (speakingId === message.id) {
        stopSpeaking()
        return
      }

      stopSpeaking()
      const utterance = new SpeechSynthesisUtterance(stripMarkdown(message.content))
      utterance.rate = 1
      utterance.pitch = 1
      utterance.onend = () => setSpeakingId(null)
      utterance.onerror = () => setSpeakingId(null)
      setSpeakingId(message.id)
      window.speechSynthesis.speak(utterance)
    },
    [speakingId, speechSupported, stopSpeaking]
  )

  const markTyped = useCallback(
    (id: string) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === id ? { ...message, animate: false } : message
        )
      )
    },
    [setMessages]
  )

  const updateProposal = useCallback(
    (messageId: string, patch: Partial<AgentProposal>) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId && message.proposal
            ? { ...message, proposal: { ...message.proposal, ...patch } }
            : message
        )
      )
    },
    [setMessages]
  )

  const handleConfirmProposal = useCallback(
    async (messageId: string) => {
      if (executingRef.current) return

      const message = messages.find((m) => m.id === messageId)
      if (!message?.proposal || message.proposal.status !== 'pending') return

      executingRef.current = true
      stopSpeaking()
      updateProposal(messageId, { status: 'executing', error: undefined })

      try {
        const result = executeAgentActions(message.proposal.actions)
        if (!result.ok) {
          updateProposal(messageId, {
            status: 'failed',
            error: result.error ?? 'One or more actions failed',
          })
          return
        }

        updateProposal(messageId, { status: 'succeeded' })
        setMessages((current) => [
          ...current,
          {
            id: uid(),
            role: 'assistant',
            content: `Done. ${result.results.map((r) => r.message).join(' ')}`,
            animate: true,
            createdAt: new Date().toISOString(),
          },
        ])
      } catch (err) {
        updateProposal(messageId, {
          status: 'failed',
          error: err instanceof Error ? err.message : 'Execution failed',
        })
      } finally {
        executingRef.current = false
      }
    },
    [messages, setMessages, stopSpeaking, updateProposal]
  )

  const handleCancelProposal = useCallback(
    (messageId: string) => {
      updateProposal(messageId, { status: 'cancelled' })
      setMessages((current) => [
        ...current,
        {
          id: uid(),
          role: 'assistant',
          content: 'Cancelled — no changes were made.',
          animate: true,
          createdAt: new Date().toISOString(),
        },
      ])
    },
    [setMessages, updateProposal]
  )

  const sendMessage = async (text: string, files: File[] = []) => {
    const trimmed = text.trim()
    const usableFiles = files.filter(isSupportedChatFile).slice(0, 3)
    if ((!trimmed && usableFiles.length === 0) || isLoading) return

    const hasPending = messages.some((m) => m.proposal?.status === 'pending')
    if (hasPending) {
      setError('Please confirm or cancel the pending proposal first.')
      return
    }

    stopSpeaking()
    setError(null)
    setRetryPayload(null)
    setIsLoading(true)

    let userMessageId: string | null = null

    try {
      const attachments: ChatAttachment[] = []
      for (const file of usableFiles) {
        if (file.type.startsWith('image/')) {
          const dataUrl = await fileToCompressedDataUrl(file)
          attachments.push({
            id: uid(),
            name: file.name,
            mimeType: 'image/jpeg',
            kind: 'image',
            dataUrl,
          })
        } else {
          const textBody = await readTextFile(file)
          attachments.push({
            id: uid(),
            name: file.name,
            mimeType: file.type || 'text/plain',
            kind: 'text',
            text: textBody,
          })
        }
      }

      const userMessage: AiChatMessage = {
        id: uid(),
        role: 'user',
        content:
          trimmed ||
          (attachments.some((a) => a.kind === 'image')
            ? 'What do you see in this image?'
            : 'Please review the attached file.'),
        attachments: attachments.length ? attachments : undefined,
        createdAt: new Date().toISOString(),
      }
      userMessageId = userMessage.id

      const nextMessages = [...messages, userMessage]
      setMessages(nextMessages)

      const context = buildAgentContext()
      const requestBody = JSON.stringify({
        messages: toApiMessages(nextMessages),
        context,
      })

      type ChatApiResponse = {
        message?: {
          role: 'assistant'
          content: string
          proposal?: Omit<AgentProposal, 'status'>
        }
        error?: string
        ragHits?: number
      }

      const maxAttempts = 2
      let data: ChatApiResponse | null = null
      let lastFailure = 'AI is unavailable right now'

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let res: Response
        try {
          res = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestBody,
          })
        } catch {
          lastFailure = 'Network error. Check your connection and try again.'
          if (attempt < maxAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, 2000))
          }
          continue
        }

        let parsed: ChatApiResponse | null = null
        try {
          parsed = (await res.json()) as ChatApiResponse
        } catch {
          lastFailure = 'AI returned an invalid response. Please try again.'
          if ((res.status >= 500 || res.status === 429) && attempt < maxAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, res.status === 429 ? 5000 : 2000))
            continue
          }
          break
        }

        if (
          res.ok &&
          parsed?.message &&
          (parsed.message.content?.trim() || parsed.message.proposal)
        ) {
          data = parsed
          break
        }

        lastFailure = parsed?.error || 'AI is unavailable right now'
        if (res.status === 429 && attempt < maxAttempts - 1) {
          const retryAfter = Number(res.headers.get('retry-after'))
          const waitMs =
            Number.isFinite(retryAfter) && retryAfter > 0
              ? Math.min(10_000, retryAfter * 1000)
              : 5000
          await new Promise((resolve) => setTimeout(resolve, waitMs))
          continue
        }
        if (res.status >= 500 && attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000))
          continue
        }
        break
      }

      if (!data?.message || (!data.message.content?.trim() && !data.message.proposal)) {
        throw new Error(lastFailure)
      }

      setLastRagHits(typeof data.ragHits === 'number' ? data.ragHits : 0)

      const assistantMessage: AiChatMessage = {
        id: uid(),
        role: 'assistant',
        content: data.message.content?.trim() || data.message.proposal?.summary || 'Done.',
        animate: true,
        createdAt: new Date().toISOString(),
      }

      if (data.message.proposal) {
        assistantMessage.proposal = {
          ...data.message.proposal,
          status: 'pending',
        }
      }

      setMessages((current) => [...current, assistantMessage])
    } catch (err) {
      if (userMessageId) {
        setMessages((current) => current.filter((m) => m.id !== userMessageId))
      }
      setRetryPayload({ text: trimmed, files: usableFiles })
      setError(err instanceof Error ? err.message : 'AI is unavailable right now')
    } finally {
      setIsLoading(false)
    }
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="relative flex items-center justify-center">
          <button
            type="button"
            onClick={() => router.back()}
            className="absolute left-0 p-2 bg-card border border-border rounded-xl text-foreground cursor-pointer active:scale-95 transition-transform"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <h1 className="text-lg font-bold text-foreground tracking-tight">Hybrid Pro AI</h1>
            <p className="text-[11px] text-muted-foreground">
              Agentic workout coach
              {lastRagHits > 0
                ? ` · Using ${lastRagHits} memory hit${lastRagHits === 1 ? '' : 's'}`
                : ''}
            </p>
          </div>
          <div className="absolute right-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="p-2 bg-card border border-border rounded-xl text-muted-foreground hover:text-foreground cursor-pointer active:scale-95 transition-transform"
              aria-label="Chat options"
              aria-expanded={menuOpen}
              title="Chat options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-[4px] border border-border bg-card shadow-lg overflow-hidden z-30">
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium text-foreground hover:bg-muted/70 cursor-pointer"
                >
                  <Eraser className="w-4 h-4 text-muted-foreground" />
                  Clear chat
                </button>
                <button
                  type="button"
                  onClick={handleDeleteChat}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium text-destructive hover:bg-destructive/10 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete this chat
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 space-y-4 pb-[220px]">
        {messages.map((message) => {
          const isUser = message.role === 'user'
          const isSpeaking = speakingId === message.id
          const showReadAloud =
            !isUser && speechSupported && !message.animate && !message.proposal

          return (
            <div
              key={message.id}
              className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}

              <div className={`max-w-[85%] ${isUser ? '' : 'space-y-2'}`}>
                {message.attachments && message.attachments.length > 0 && (
                  <div className={`mb-1.5 flex flex-wrap gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {message.attachments.map((att) =>
                      att.kind === 'image' && att.dataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={att.id}
                          src={att.dataUrl}
                          alt={att.name}
                          className="h-28 w-28 rounded-2xl object-cover border border-border"
                        />
                      ) : (
                        <div
                          key={att.id}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/60 px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {att.name}
                        </div>
                      )
                    )}
                  </div>
                )}

                {isUser ? (
                  <div className="px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap bg-primary text-primary-foreground rounded-[22px]">
                    {message.content}
                  </div>
                ) : message.animate ? (
                  <div className="px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap bg-card border border-border text-foreground rounded-[22px]">
                    <TypewriterText
                      text={stripMarkdown(message.content)}
                      enabled
                      onComplete={() => markTyped(message.id)}
                    />
                  </div>
                ) : (
                  <FormattedAiMessage text={message.content} />
                )}

                {message.proposal && !message.animate && (
                  <AgentProposalCard
                    proposal={message.proposal}
                    onConfirm={() => void handleConfirmProposal(message.id)}
                    onCancel={() => handleCancelProposal(message.id)}
                  />
                )}

                {showReadAloud && (
                  <button
                    type="button"
                    onClick={() => readAloud(message)}
                    className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer active:scale-95 ${
                      isSpeaking
                        ? 'bg-primary/15 border-primary/30 text-primary'
                        : 'bg-muted/60 border-border text-muted-foreground hover:text-foreground'
                    }`}
                    aria-label={isSpeaking ? 'Stop reading' : 'Read response'}
                  >
                    {isSpeaking ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        Read
                      </>
                    )}
                  </button>
                )}
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-full bg-muted border border-border overflow-hidden flex items-center justify-center shrink-0">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt="You"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[11px] font-bold text-primary uppercase">
                      {userInitial}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {isLoading && (
          <div className="flex items-end gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-card border border-border rounded-[22px] px-4 py-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-[16px] bg-destructive/10 border border-destructive/20 px-4 py-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-destructive leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setRetryPayload(null)
                }}
                className="shrink-0 p-1 rounded-lg text-destructive/70 hover:text-destructive cursor-pointer"
                aria-label="Dismiss error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {retryPayload && (
              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  const payload = retryPayload
                  setRetryPayload(null)
                  setError(null)
                  void sendMessage(payload.text, payload.files)
                }}
                className="h-8 px-3 rounded-full bg-destructive/15 border border-destructive/25 text-[11px] font-semibold text-destructive cursor-pointer active:scale-95 disabled:opacity-40"
              >
                Try again
              </button>
            )}
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      <div className="fixed bottom-0 left-0 right-0 sm:max-w-[430px] mx-auto bg-background/95 backdrop-blur-md border-t border-border pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] z-30">
        <div className="overflow-x-auto scrollbar-hide px-4 pb-3">
          <div className="flex gap-2 w-max">
            {STARTERS.map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => void sendMessage(starter)}
                disabled={isLoading}
                className="shrink-0 h-9 px-3.5 rounded-full bg-card/60 border border-border/60 text-xs font-semibold text-foreground/55 cursor-pointer active:scale-95 disabled:opacity-40 whitespace-nowrap hover:text-foreground/80 hover:bg-card/80 transition-colors"
              >
                {starter}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4">
          <PromptInputBox
            isLoading={isLoading}
            placeholder="Ask, attach a photo, or hold the mic…"
            onSend={(message, files) => {
              void sendMessage(message, files ?? [])
            }}
          />
        </div>
      </div>
    </div>
  )
}
