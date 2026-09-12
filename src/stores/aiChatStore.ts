'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AgentProposal } from '@/lib/ai/agent-types'

export type ChatAttachment = {
  id: string
  name: string
  mimeType: string
  /** data URL for images, or inline text for text files */
  kind: 'image' | 'text'
  dataUrl?: string
  text?: string
}

export type AiChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  animate?: boolean
  proposal?: AgentProposal
  attachments?: ChatAttachment[]
  createdAt: string
}

const WELCOME: AiChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Hi, I am your Hybrid Pro AI agent. I can answer workout questions and propose app changes — plans, workouts, history, progress, and settings — after you confirm each action. You can also attach images or talk with the mic.',
  animate: false,
  createdAt: new Date(0).toISOString(),
}

const MAX_MESSAGES = 80

type AiChatState = {
  messages: AiChatMessage[]
  hydrated: boolean
  setHydrated: (v: boolean) => void
  setMessages: (
    updater: AiChatMessage[] | ((current: AiChatMessage[]) => AiChatMessage[])
  ) => void
  /** Wipe transcript back to the welcome message (keeps the chat screen). */
  clearChat: () => void
  /** Same reset as clear — used when the user chooses “delete this chat”. */
  deleteChat: () => void
}

function freshWelcome(): AiChatMessage {
  return {
    ...WELCOME,
    id: `welcome-${Date.now()}`,
    createdAt: new Date().toISOString(),
  }
}

export const useAiChatStore = create<AiChatState>()(
  persist(
    (set, get) => ({
      messages: [WELCOME],
      hydrated: false,

      setHydrated: (v) => set({ hydrated: v }),

      setMessages: (updater) => {
        const next =
          typeof updater === 'function' ? updater(get().messages) : updater
        const trimmed =
          next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next
        set({ messages: trimmed.length > 0 ? trimmed : [WELCOME] })
      },

      clearChat: () => set({ messages: [freshWelcome()] }),
      deleteChat: () => set({ messages: [freshWelcome()] }),
    }),
    {
      name: 'gymtrack-ai-chat',
      partialize: (state) => ({
        messages: state.messages.map((m) => ({
          ...m,
          animate: false,
          // Cap stored image payloads so localStorage stays usable
          attachments: m.attachments?.map((a) =>
            a.kind === 'image' && a.dataUrl && a.dataUrl.length > 180_000
              ? { ...a, dataUrl: undefined, text: '[Image omitted from saved history]' }
              : a
          ),
        })),
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
    }
  )
)

export function createWelcomeMessage(): AiChatMessage {
  return freshWelcome()
}
