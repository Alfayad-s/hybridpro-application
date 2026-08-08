'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Flame, Loader2, RefreshCw, Target } from 'lucide-react'
import { motion } from 'framer-motion'
import { formatDateKey } from '@/lib/challenges/dates'
import { useChallengeContext } from '@/hooks/useChallengeContext'
import { getTodayChallengesAction } from '@/server/actions/challenge.actions'
import { useChallengeWidgetStore } from '@/stores/challengeWidgetStore'

export function ChallengesWidget() {
  const router = useRouter()
  const context = useChallengeContext()
  const snapshot = useChallengeWidgetStore((s) => s.snapshot)
  const setSnapshot = useChallengeWidgetStore((s) => s.setSnapshot)

  const todayKey = formatDateKey(new Date())
  const view = snapshot?.dateKey === todayKey ? snapshot : null

  const [loading, setLoading] = useState(() => !useChallengeWidgetStore.getState().hasTodayCache())
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force ?? false
      if (!force && useChallengeWidgetStore.getState().hasTodayCache()) {
        setLoading(false)
        setRefreshing(false)
        return
      }

      if (force) setRefreshing(true)
      else setLoading(true)

      try {
        const data = await getTodayChallengesAction(context)
        const done = data.challenges.filter((c) => c.status === 'completed')
        const pending = data.challenges.filter((c) => c.status === 'pending')
        setSnapshot({
          dateKey: formatDateKey(new Date()),
          completed: done.length,
          total: data.challenges.length || 5,
          xp: done.reduce((s, c) => s + c.xpReward, 0),
          coins: done.reduce((s, c) => s + c.coinReward, 0),
          streak: data.rewards.currentStreak,
          remainingTitles: pending.slice(0, 3).map((c) => c.title),
          fetchedAt: Date.now(),
        })
      } catch {
        /* silent — widget is best-effort */
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [context, setSnapshot]
  )

  useEffect(() => {
    void load({ force: false })
    // Cache survives remounts; only auto-fetch when cold.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const completed = view?.completed ?? 0
  const total = view?.total ?? 5
  const xp = view?.xp ?? 0
  const coins = view?.coins ?? 0
  const streak = view?.streak ?? 0
  const remainingTitles = view?.remainingTitles ?? []

  const pct = total ? Math.round((completed / total) * 100) : 0
  const r = 28
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const busy = loading || refreshing

  return (
    <div className="w-full rounded-[24px] border border-primary/25 bg-gradient-to-br from-primary/10 via-transparent to-transparent p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => router.push('/challenges')}
          className="flex items-center gap-2 min-w-0 cursor-pointer"
        >
          <Target className="w-4 h-4 text-primary shrink-0" />
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-primary">
            Today&apos;s Challenges
          </h2>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => void load({ force: true })}
            disabled={busy}
            className="p-1.5 rounded-lg text-primary hover:bg-primary/10 cursor-pointer active:scale-95 disabled:opacity-50"
            aria-label="Refresh challenges"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => router.push('/challenges')}
            className="p-1.5 rounded-lg text-primary cursor-pointer active:scale-95"
            aria-label="Open challenges"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => router.push('/challenges')}
        className="w-full text-left cursor-pointer active:scale-[0.99] transition-transform space-y-3"
      >
        {loading && !view ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading challenges…
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 shrink-0">
                <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
                  <circle cx="36" cy="36" r={r} fill="none" stroke="var(--muted)" strokeWidth="6" />
                  <motion.circle
                    cx="36"
                    cy="36"
                    r={r}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    initial={false}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 0.6 }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold tabular-nums text-foreground">
                    {completed}/{total}
                  </span>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-3 gap-2">
                <MiniStat label="XP" value={`+${xp}`} />
                <MiniStat label="Coins" value={`+${coins}`} />
                <MiniStat
                  label="Streak"
                  value={String(streak)}
                  icon={<Flame className="w-3 h-3 text-warning" />}
                />
              </div>
            </div>
            {remainingTitles.length > 0 ? (
              <div className="space-y-1.5">
                {remainingTitles.map((t) => (
                  <div
                    key={t}
                    className="rounded-[12px] bg-background/50 border border-border/40 px-3 py-2 text-xs font-semibold text-foreground truncate"
                  >
                    {t}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">All challenges complete — nice work!</p>
            )}
          </>
        )}
      </button>
    </div>
  )
}

function MiniStat({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-[12px] bg-background/50 border border-border/40 px-2 py-1.5 text-center">
      <div className="flex items-center justify-center gap-0.5 text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="text-sm font-bold text-foreground tabular-nums">{value}</p>
    </div>
  )
}
