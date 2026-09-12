'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'gymtrack-install-dismissed'

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(DISMISS_KEY) === '1') return

    // Already installed as standalone
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator &&
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
    if (standalone) return

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (!visible || !deferred) return null

  return (
    <div className="mb-1 rounded-[20px] border border-border bg-card p-4 flex items-start gap-3 shadow-sm">
      <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
        <Download className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">Install Hybrid Pro</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Add to your home screen for offline access and rest timer alerts.
        </p>
        <button
          type="button"
          onClick={async () => {
            await deferred.prompt()
            const choice = await deferred.userChoice
            setVisible(false)
            setDeferred(null)
            if (choice.outcome === 'dismissed') {
              localStorage.setItem(DISMISS_KEY, '1')
            }
          }}
          className="mt-2 h-9 px-4 rounded-full bg-primary text-primary-foreground text-xs font-bold cursor-pointer active:scale-95"
        >
          Install app
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          setVisible(false)
          localStorage.setItem(DISMISS_KEY, '1')
        }}
        className="p-1 text-muted-foreground cursor-pointer"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

/** Hook for Settings page — exposes install prompt when available. */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator &&
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
    setIsStandalone(standalone)

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const promptInstall = async () => {
    if (!deferred) return false
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    return true
  }

  return { canInstall: Boolean(deferred) && !isStandalone, isStandalone, promptInstall }
}
