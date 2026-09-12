'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    Spotify?: {
      Player: new (opts: {
        name: string
        getOAuthToken: (cb: (token: string) => void) => void
        volume?: number
      }) => SpotifyPlayerInstance
    }
    onSpotifyWebPlaybackSDKReady?: () => void
  }
}

type SpotifyPlayerInstance = {
  connect: () => Promise<boolean>
  disconnect: () => void
  addListener: (event: string, cb: (state: unknown) => void) => void
  removeListener: (event: string) => void
  getCurrentState: () => Promise<unknown>
  setName: (name: string) => void
  getVolume: () => Promise<number>
  setVolume: (v: number) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  togglePlay: () => Promise<void>
  seek: (ms: number) => Promise<void>
  previousTrack: () => Promise<void>
  nextTrack: () => Promise<void>
  activateElement: () => Promise<void>
}

export function useSpotifyWebPlayer(enabled: boolean) {
  const playerRef = useRef<SpotifyPlayerInstance | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getToken = useCallback(async () => {
    const res = await fetch('/api/spotify/token')
    const data = (await res.json().catch(() => ({}))) as {
      accessToken?: string
      error?: string
    }
    if (!res.ok || !data.accessToken) {
      throw new Error(data.error || 'Failed to get Spotify token')
    }
    return data.accessToken
  }, [])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const init = async () => {
      try {
        await loadSdk()
        if (cancelled || !window.Spotify) return

        const player = new window.Spotify.Player({
          name: 'Hybrid Pro Player',
          getOAuthToken: (cb) => {
            void getToken()
              .then(cb)
              .catch((err) => {
                setError(err instanceof Error ? err.message : 'Token error')
              })
          },
          volume: 0.8,
        })

        player.addListener('ready', (state) => {
          const s = state as { device_id?: string }
          if (s.device_id) {
            setDeviceId(s.device_id)
            setReady(true)
            setError(null)
          }
        })

        player.addListener('not_ready', () => {
          setReady(false)
        })

        player.addListener('initialization_error', (s) => {
          const msg = (s as { message?: string }).message
          setError(msg || 'Player init failed')
        })
        player.addListener('authentication_error', (s) => {
          const msg = (s as { message?: string }).message
          setError(msg || 'Auth failed')
        })
        player.addListener('account_error', (s) => {
          const msg = (s as { message?: string }).message
          setError(msg || 'Premium required')
        })

        const ok = await player.connect()
        if (!ok) setError('Could not connect Hybrid Pro player')
        playerRef.current = player
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Player failed')
        }
      }
    }

    void init()

    return () => {
      cancelled = true
      playerRef.current?.disconnect()
      playerRef.current = null
      setReady(false)
      setDeviceId(null)
    }
  }, [enabled, getToken])

  return { deviceId, ready, error, player: playerRef }
}

function loadSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.Spotify) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const existing = document.getElementById('spotify-player-sdk')
    if (existing) {
      window.onSpotifyWebPlaybackSDKReady = () => resolve()
      if (window.Spotify) resolve()
      return
    }

    window.onSpotifyWebPlaybackSDKReady = () => resolve()
    const script = document.createElement('script')
    script.id = 'spotify-player-sdk'
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    script.onerror = () => reject(new Error('Failed to load Spotify SDK'))
    document.body.appendChild(script)
  })
}
