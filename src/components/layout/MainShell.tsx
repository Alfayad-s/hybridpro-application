'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Dumbbell } from 'lucide-react'
import { useWorkoutStore } from '@/stores/workoutStore'

export function MainShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const activeSession = useWorkoutStore((s) => s.activeSession)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  const hideBottomPad =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/subscribe' ||
    pathname === '/forgot-password' ||
    pathname === '/workout' ||
    pathname === '/ai' ||
    pathname?.startsWith('/auth/')

  const showResumeBanner =
    hydrated &&
    Boolean(activeSession) &&
    pathname !== '/workout' &&
    pathname !== '/ai' &&
    pathname !== '/' &&
    pathname !== '/login' &&
    pathname !== '/subscribe' &&
    pathname !== '/forgot-password' &&
    !pathname?.startsWith('/auth/')

  return (
    <main
      className={`app-main-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto scrollbar-hide ${
        hideBottomPad ? '' : 'pt-[var(--safe-top)] pb-[var(--app-bottom-pad)]'
      }`}
    >
      {showResumeBanner && (
        <div className="sticky top-0 z-30 px-4 pt-3 pb-1">
          <Link
            href="/workout"
            className="flex items-center gap-3 rounded-[18px] border border-primary/40 bg-primary/15 backdrop-blur-md px-4 py-3 shadow-sm active:scale-[0.99] transition-transform"
          >
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0">
              <Dumbbell className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Workout in progress
              </p>
              <p className="text-sm font-semibold text-foreground truncate">
                {activeSession?.name ?? 'Active session'} — Continue
              </p>
            </div>
          </Link>
        </div>
      )}
      {children}
    </main>
  )
}
