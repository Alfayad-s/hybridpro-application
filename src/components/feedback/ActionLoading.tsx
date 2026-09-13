'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'

type ActionLoadingContextValue = {
  visible: boolean
  message: string
  showActionLoading: (message?: string) => void
  hideActionLoading: () => void
}

const ActionLoadingContext = createContext<ActionLoadingContextValue | null>(null)

function ActionLoadingOverlay({ message }: { message: string }) {
  return (
    <div
      className="absolute inset-0 z-[80] bg-background flex flex-col items-center justify-center gap-5 px-8"
      role="status"
      aria-live="assertive"
      aria-busy="true"
    >
      <div className="w-20 h-20 rounded-[28px] overflow-hidden border border-border shadow-lg">
        <BrandLogo size={80} className="rounded-[28px]" priority />
      </div>
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm font-bold text-foreground text-center">{message}</p>
    </div>
  )
}

export function ActionLoadingProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('Loading…')

  const showActionLoading = useCallback((nextMessage = 'Loading…') => {
    setMessage(nextMessage)
    setVisible(true)
  }, [])

  const hideActionLoading = useCallback(() => {
    setVisible(false)
  }, [])

  const value = useMemo(
    () => ({ visible, message, showActionLoading, hideActionLoading }),
    [visible, message, showActionLoading, hideActionLoading]
  )

  return (
    <ActionLoadingContext.Provider value={value}>
      {children}
      {visible ? <ActionLoadingOverlay message={message} /> : null}
    </ActionLoadingContext.Provider>
  )
}

export function useActionLoading() {
  const ctx = useContext(ActionLoadingContext)
  if (!ctx) {
    return {
      visible: false,
      message: '',
      showActionLoading: () => {},
      hideActionLoading: () => {},
    }
  }
  return ctx
}
