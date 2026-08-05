'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, Clock, Dumbbell } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { useRecoveryStore } from '@/stores/recoveryStore'
import { useHistoryStore } from '@/stores/historyStore'
import {
  RECOVERY_GROUPS,
  GROUP_TO_MAP,
  GROUP_MUSCLES,
  STATUS_COLOR,
  getGroupRecovery,
  getMuscleRecovery,
  muscleIdFromSlug,
  muscleSlugToGroup,
  type RecoveryGroup,
  type RecoveryMuscleId,
  type RecoveryStatus,
} from '@/lib/muscle-recovery'
import { MuscleMap, ZoomableAnatomy, MUSCLE_LABELS, type MuscleHighlights } from '@/components/muscle-map'

const statusStyles: Record<RecoveryStatus, string> = {
  Ready: 'text-primary',
  Recovering: 'text-warning',
  Fatigued: 'text-destructive',
}

const statusBg: Record<RecoveryStatus, string> = {
  Ready: 'bg-primary/10 border-primary/25',
  Recovering: 'bg-warning/10 border-warning/25',
  Fatigued: 'bg-destructive/10 border-destructive/25',
}

export default function RecoveryDetailPage() {
  const router = useRouter()
  const lastTrained = useRecoveryStore((s) => s.lastTrained)
  const [bodyView, setBodyView] = useState<'front' | 'back'>('front')
  const [selectedGroup, setSelectedGroup] = useState<RecoveryGroup | null>(null)
  const [selectedMuscleId, setSelectedMuscleId] = useState<RecoveryMuscleId | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<RecoveryGroup>>(
    () => new Set(RECOVERY_GROUPS)
  )
  const [hydrated, setHydrated] = useState(false)
  const [nowTick, setNowTick] = useState(() => Date.now())

  useEffect(() => {
    setHydrated(true)
    const id = setInterval(() => setNowTick(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const recoveryList = useMemo(() => {
    void nowTick
    return RECOVERY_GROUPS.map((group) => getGroupRecovery(group, lastTrained, Date.now()))
  }, [lastTrained, nowTick])

  const recoveryHighlights = useMemo(() => {
    const map: MuscleHighlights = {}
    for (const group of recoveryList) {
      for (const muscle of group.muscles) {
        const opacity = 0.35 + (1 - muscle.recoveredPct) * 0.6
        const def = GROUP_MUSCLES[group.group].find((m) => m.id === muscle.id)
        for (const slug of def?.mapSlugs ?? [muscle.id]) {
          map[slug] = { color: STATUS_COLOR[muscle.status], opacity }
        }
      }
    }
    return map
  }, [recoveryList])

  const selectedMapIds = useMemo(() => {
    if (selectedMuscleId) {
      const def = Object.values(GROUP_MUSCLES)
        .flat()
        .find((m) => m.id === selectedMuscleId)
      return def ? [...def.mapSlugs] : [selectedMuscleId]
    }
    if (selectedGroup) return [...GROUP_TO_MAP[selectedGroup]]
    return null
  }, [selectedMuscleId, selectedGroup])

  const selectedGroupDetail = selectedGroup
    ? recoveryList.find((item) => item.group === selectedGroup) ?? null
    : null

  const selectedMuscleDetail = useMemo(() => {
    if (!selectedMuscleId) return null
    const record = lastTrained[selectedMuscleId]
    return getMuscleRecovery(
      selectedMuscleId,
      record?.date ?? null,
      record?.volumeKg ?? 0,
      Date.now()
    )
  }, [selectedMuscleId, lastTrained, nowTick])

  const toggleExpanded = (group: RecoveryGroup) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  // Keep recovery in sync if history was cleared before this fix
  useEffect(() => {
    if (!hydrated) return
    useRecoveryStore.getState().rebuildFromWorkouts(useHistoryStore.getState().workouts)
  }, [hydrated])

  return (
    <div className="px-5 pt-5 pb-10 space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 bg-card border border-border rounded-xl text-foreground cursor-pointer active:scale-95 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground tracking-tight">Muscle Recovery</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Detailed status by muscle — delts, biceps, quads, and more
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-[24px] p-5 space-y-5">
        <div className="flex items-center justify-center gap-2">
          {(['front', 'back'] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setBodyView(view)}
              className={`h-9 px-5 rounded-full text-xs font-bold capitalize transition-colors cursor-pointer ${
                bodyView === view
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {view}
            </button>
          ))}
        </div>

        <div className="flex justify-center py-2">
          <ZoomableAnatomy className="w-full max-w-[360px]">
            <MuscleMap
              view={bodyView}
              highlights={recoveryHighlights}
              selected={selectedMapIds}
              defaultFill="var(--muscle-default)"
              className="w-full max-w-[320px] max-h-[min(62vh,520px)]"
              onMuscleClick={(muscle) => {
                const id = muscleIdFromSlug(muscle)
                const group = muscleSlugToGroup(muscle)
                setSelectedMuscleId(id)
                setSelectedGroup(group)
                if (group) {
                  setExpandedGroups((prev) => new Set(prev).add(group))
                }
              }}
            />
          </ZoomableAnatomy>
        </div>

        <div className="flex items-center justify-center gap-4 text-[10px] font-medium">
          <span className="flex items-center gap-1.5 text-primary">
            <span className="w-2 h-2 rounded-full bg-primary" /> Ready
          </span>
          <span className="flex items-center gap-1.5 text-warning">
            <span className="w-2 h-2 rounded-full bg-warning" /> Recovering
          </span>
          <span className="flex items-center gap-1.5 text-destructive">
            <span className="w-2 h-2 rounded-full bg-destructive" /> Fatigued
          </span>
        </div>

        {(selectedMuscleDetail || selectedGroupDetail) && (
          <p className="text-center text-xs text-muted-foreground">
            Selected:{' '}
            <span className="font-semibold text-foreground">
              {selectedMuscleDetail?.label ??
                (selectedMuscleId
                  ? MUSCLE_LABELS[selectedMuscleId] ?? selectedMuscleId
                  : selectedGroupDetail?.group)}
            </span>
            {selectedGroupDetail ? ` · ${selectedGroupDetail.group}` : ''}
          </p>
        )}
      </div>

      {selectedMuscleDetail && (
        <div
          className={`rounded-[24px] border p-5 space-y-3 ${statusBg[selectedMuscleDetail.status]}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {selectedMuscleDetail.group}
              </p>
              <h2 className="text-lg font-bold text-foreground">{selectedMuscleDetail.label}</h2>
              <p className={`text-sm font-semibold ${statusStyles[selectedMuscleDetail.status]}`}>
                {selectedMuscleDetail.status}
              </p>
            </div>
            <span className="text-2xl font-bold text-foreground tabular-nums">
              {Math.round(selectedMuscleDetail.recoveredPct * 100)}%
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-background/50 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.round(selectedMuscleDetail.recoveredPct * 100)}%`,
                backgroundColor: STATUS_COLOR[selectedMuscleDetail.status],
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                Status
              </p>
              <p className="text-sm font-semibold text-foreground">
                {selectedMuscleDetail.labelStatus}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                Window
              </p>
              <p className="text-sm font-semibold text-foreground">
                {selectedMuscleDetail.recoveryHours}h recovery
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                Last trained
              </p>
              <p className="text-sm font-semibold text-foreground">
                {selectedMuscleDetail.lastTrained
                  ? formatDistanceToNow(new Date(selectedMuscleDetail.lastTrained), {
                      addSuffix: true,
                    })
                  : 'Not yet'}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                Last volume
              </p>
              <p className="text-sm font-semibold text-foreground">
                {selectedMuscleDetail.volumeKg > 0
                  ? `${Math.round(selectedMuscleDetail.volumeKg).toLocaleString()} kg`
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-0.5">
          Muscle groups &amp; detail
        </h3>
        <div className="space-y-2.5">
          {recoveryList.map((item) => {
            const isExpanded = expandedGroups.has(item.group)
            const isGroupSelected = selectedGroup === item.group && !selectedMuscleId
            const volume = item.muscles.reduce((sum, m) => sum + m.volumeKg, 0)

            return (
              <div
                key={item.group}
                className={`bg-card border rounded-[20px] overflow-hidden transition-colors ${
                  isGroupSelected || (selectedGroup === item.group && selectedMuscleId)
                    ? 'border-primary/50'
                    : 'border-border'
                }`}
              >
                <div className="flex items-stretch">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGroup(item.group)
                      setSelectedMuscleId(null)
                    }}
                    className={`flex-1 text-left p-4 space-y-3 cursor-pointer active:scale-[0.99] ${
                      isGroupSelected ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: STATUS_COLOR[item.status] }}
                        />
                        <span className="text-sm font-bold text-foreground">{item.group}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {item.muscles.length} muscles
                        </span>
                      </div>
                      <span className={`text-xs font-bold ${statusStyles[item.status]}`}>
                        {item.status}
                      </span>
                    </div>

                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.round(item.recoveredPct * 100)}%`,
                          backgroundColor: STATUS_COLOR[item.status],
                        }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground tabular-nums">
                        {Math.round(item.recoveredPct * 100)}% recovered
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {item.label}
                      </span>
                      <span className="flex items-center gap-1">
                        <Dumbbell className="w-3 h-3" />
                        {volume > 0 ? `${Math.round(volume).toLocaleString()} kg` : 'No volume yet'}
                      </span>
                    </div>

                    {hydrated && item.lastTrained && (
                      <p className="text-[10px] text-muted-foreground">
                        Last session {format(new Date(item.lastTrained), 'EEE, d MMM · h:mm a')}
                        {item.readyAt && item.status !== 'Ready'
                          ? ` · Ready ${format(item.readyAt, 'EEE h:mm a')}`
                          : ''}
                      </p>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleExpanded(item.group)}
                    className="px-3 border-l border-border text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-border px-3 py-2.5 space-y-1.5 bg-muted/20">
                    {item.muscles.map((muscle) => {
                      const isSelected = selectedMuscleId === muscle.id
                      return (
                        <button
                          key={muscle.id}
                          type="button"
                          onClick={() => {
                            setSelectedGroup(item.group)
                            setSelectedMuscleId(muscle.id)
                          }}
                          className={`w-full text-left rounded-[14px] px-3 py-2.5 space-y-2 transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-primary/10 border border-primary/30'
                              : 'bg-card/80 border border-transparent hover:border-border'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: STATUS_COLOR[muscle.status] }}
                              />
                              <span className="text-xs font-bold text-foreground truncate">
                                {muscle.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-[10px] font-bold ${statusStyles[muscle.status]}`}>
                                {muscle.status}
                              </span>
                              <span className="text-[11px] font-bold text-foreground tabular-nums w-9 text-right">
                                {Math.round(muscle.recoveredPct * 100)}%
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.round(muscle.recoveredPct * 100)}%`,
                                backgroundColor: STATUS_COLOR[muscle.status],
                              }}
                            />
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                            <span>{muscle.labelStatus}</span>
                            <span>· {muscle.recoveryHours}h window</span>
                            {muscle.volumeKg > 0 && (
                              <span>· {Math.round(muscle.volumeKg).toLocaleString()} kg</span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
