'use client'

import { useEffect } from 'react'
import { listenForRestSoundMessages } from '@/lib/notifications'

/**
 * Registers the GymTrack service worker in production for offline shell
 * and background rest-timer notifications. Skipped in development so
 * ServiceWorkerCleanup can keep stale workers away from Turbopack.
 *
 * Also forces SW updates and one reload when a new worker takes control,
 * so CSS/JS hashes from a fresh deploy are not stuck behind an old shell.
 */
export function PwaRegister() {
  useEffect(() => {
    const unlisten = listenForRestSoundMessages()

    if (process.env.NODE_ENV !== 'production') {
      return unlisten
    }
    if (!('serviceWorker' in navigator)) {
      return unlisten
    }

    let refreshing = false
    const onControllerChange = () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        void reg.update()
        // If a waiting worker is already installed (previous deploy), activate it
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
          reg.waiting.postMessage({ type: 'CANCEL_REST' })
          // skipWaiting is already called on install; claim via activate
        }
      })
      .catch(() => {
        /* ignore registration failures */
      })

    // Clear legacy shell caches that used to store /_next CSS (breaks styles)
    if ('caches' in window) {
      void caches.keys().then((keys) => {
        for (const key of keys) {
          if (
            key === 'gymtrack-shell-v1' ||
            key === 'gymtrack-shell-v2' ||
            key.includes('workbox') ||
            key.includes('next-pwa')
          ) {
            void caches.delete(key)
          }
        }
      })
    }

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      unlisten()
    }
  }, [])

  return null
}
