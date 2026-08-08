'use client'

import { Drawer } from 'vaul'
import { Clock, Dumbbell, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import {
  STATUS_COLOR,
  type GroupRecovery,
  type RecoveryStatus,
} from '@/lib/muscle-recovery'

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

type RecoveryGroupSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: GroupRecovery | null
}

export function RecoveryGroupSheet({
  open,
  onOpenChange,
  group,
}: RecoveryGroupSheetProps) {
  if (!group) return null

  const volume = group.muscles.reduce((sum, m) => sum + m.volumeKg, 0)

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px]" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[70] mx-auto flex max-h-[88dvh] w-full flex-col rounded-t-[28px] border border-border bg-background outline-none sm:max-w-[430px]">
          <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted" />

          <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-3 pb-3 border-b border-border/50">
            <div className="min-w-0">
              <Drawer.Title className="text-base font-bold text-foreground tracking-tight">
                {group.group} recovery
              </Drawer.Title>
              <Drawer.Description className="text-[11px] text-muted-foreground mt-0.5">
                Detail status for each muscle in this group
              </Drawer.Description>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border border-border bg-card p-2 text-muted-foreground cursor-pointer active:scale-95"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
            <div className={`rounded-[20px] border p-4 space-y-3 ${statusBg[group.status]}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-sm font-bold ${statusStyles[group.status]}`}>
                    {group.status}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{group.label}</p>
                </div>
                <span className="text-2xl font-bold text-foreground tabular-nums">
                  {Math.round(group.recoveredPct * 100)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-background/50 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round(group.recoveredPct * 100)}%`,
                    backgroundColor: STATUS_COLOR[group.status],
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {group.lastTrained
                    ? formatDistanceToNow(new Date(group.lastTrained), { addSuffix: true })
                    : 'Not trained yet'}
                </span>
                <span className="flex items-center gap-1">
                  <Dumbbell className="w-3 h-3" />
                  {volume > 0 ? `${Math.round(volume).toLocaleString()} kg` : 'No volume yet'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-0.5">
                Muscles
              </p>
              {group.muscles.map((muscle) => (
                <div
                  key={muscle.id}
                  className="rounded-[16px] border border-border bg-card px-3.5 py-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: STATUS_COLOR[muscle.status] }}
                      />
                      <span className="text-sm font-bold text-foreground truncate">
                        {muscle.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold ${statusStyles[muscle.status]}`}>
                        {muscle.status}
                      </span>
                      <span className="text-xs font-bold text-foreground tabular-nums w-9 text-right">
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
                </div>
              ))}
            </div>
          </div>

          <div className="shrink-0 border-t border-border/50 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full h-11 rounded-[16px] bg-muted text-foreground text-sm font-bold cursor-pointer active:scale-[0.99]"
            >
              Close
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
