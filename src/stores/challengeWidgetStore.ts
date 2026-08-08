'use client'

import { create } from 'zustand'
import { formatDateKey } from '@/lib/challenges/dates'

export type ChallengeWidgetSnapshot = {
  dateKey: string
  completed: number
  total: number
  xp: number
  coins: number
  streak: number
  remainingTitles: string[]
  fetchedAt: number
}

type ChallengeWidgetState = {
  snapshot: ChallengeWidgetSnapshot | null
  setSnapshot: (snapshot: ChallengeWidgetSnapshot) => void
  clear: () => void
  /** True when we already have today's snapshot and should skip auto-fetch. */
  hasTodayCache: () => boolean
}

export const useChallengeWidgetStore = create<ChallengeWidgetState>((set, get) => ({
  snapshot: null,

  setSnapshot: (snapshot) => set({ snapshot }),

  clear: () => set({ snapshot: null }),

  hasTodayCache: () => {
    const snap = get().snapshot
    if (!snap) return false
    return snap.dateKey === formatDateKey(new Date())
  },
}))
