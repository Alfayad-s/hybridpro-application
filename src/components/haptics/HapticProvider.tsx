'use client'

import { useEffect } from 'react'
import { findHapticTarget, hapticStyleForTarget, triggerHaptic } from '@/lib/haptics'

const PRESSED_CLASS = 'is-pressed'

function isTextField(el: Element) {
  return el.matches('input, textarea, select, [contenteditable="true"]')
}

/**
 * App-wide tap feedback: visual press (iOS has no :active / vibrate) + haptics where available.
 */
export function HapticProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let lastAt = 0
    let lastTarget: Element | null = null
    let pressedEl: Element | null = null

    const clearPress = () => {
      pressedEl?.classList.remove(PRESSED_CLASS)
      pressedEl = null
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return

      const target = findHapticTarget(event.target)
      if (!target) return

      const now = Date.now()
      if (target === lastTarget && now - lastAt < 80) return
      lastAt = now
      lastTarget = target

      if (!isTextField(target)) {
        clearPress()
        target.classList.add(PRESSED_CLASS)
        pressedEl = target
      }

      triggerHaptic(hapticStyleForTarget(target))
    }

    const onPointerEnd = () => {
      window.setTimeout(clearPress, 90)
    }

    document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true })
    document.addEventListener('pointerup', onPointerEnd, { capture: true, passive: true })
    document.addEventListener('pointercancel', onPointerEnd, { capture: true, passive: true })
    // Empty touchstart is required for iOS to honor tap visuals.
    document.addEventListener('touchstart', () => {}, { capture: true, passive: true })

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointerup', onPointerEnd, true)
      document.removeEventListener('pointercancel', onPointerEnd, true)
      clearPress()
    }
  }, [])

  return <>{children}</>
}
