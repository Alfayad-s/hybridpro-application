'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { ExternalLink, Music2, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import {
  getSpotifyConnectionAction,
  getSpotifyPlaybackAction,
  spotifyPlaybackAction,
} from '@/server/actions/spotify.actions'
import type { SpotifyPlayback } from '@/lib/spotify/types'
import { cn } from '@/lib/utils'

export function SpotifyMiniPlayer({
  className,
  compact,
}: {
  className?: string
  compact?: boolean
}) {
  const [connected, setConnected] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const [playback, setPlayback] = useState<SpotifyPlayback | null>(null)
  const [pending, startTransition] = useTransition()

  const refresh = () => {
    startTransition(async () => {
      try {
        const conn = await getSpotifyConnectionAction()
        if (!conn.connected) {
          setConnected(false)
          setPlayback(null)
          return
        }
        setConnected(true)
        setIsPremium(conn.isPremium)
        const p = await getSpotifyPlaybackAction()
        setPlayback(p)
      } catch {
        setConnected(false)
      }
    })
  }

  useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, 12_000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!connected) {
    return (
      <Link
        href="/spotify"
        className={cn(
          'flex items-center gap-3 rounded-[18px] border border-[#1DB954]/25 bg-[#1DB954]/10 px-3 py-2.5',
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/spotify-logo.png" alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-foreground">Add workout music</p>
          <p className="text-[10px] text-muted-foreground">Connect Spotify</p>
        </div>
      </Link>
    )
  }

  const track = playback?.track

  if (!isPremium) {
    return (
      <a
        href={track?.externalUrl || 'https://open.spotify.com'}
        target="_blank"
        rel="noreferrer"
        className={cn(
          'flex items-center gap-3 rounded-[18px] border border-border/60 bg-card/80 backdrop-blur-md px-3 py-2.5',
          className
        )}
      >
        {track?.album.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.album.imageUrl} alt="" className="w-10 h-10 rounded-xl object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <Music2 className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-foreground truncate">
            {track?.name ?? 'Open Spotify'}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            Premium required for in-app play
          </p>
        </div>
        <ExternalLink className="w-4 h-4 text-[#1DB954] shrink-0" />
      </a>
    )
  }

  return (
    <div
      className={cn(
        'rounded-[18px] border border-border/60 bg-card/80 backdrop-blur-md px-3 py-2.5 space-y-2',
        className
      )}
    >
      <div className="flex items-center gap-3">
        {track?.album.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.album.imageUrl} alt="" className="w-10 h-10 rounded-xl object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <Music2 className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-foreground truncate">
            {track?.name ?? 'Not playing'}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {track?.artists.map((a) => a.name).join(', ') || 'Hybrid Pro · Spotify'}
          </p>
        </div>
        {!compact && (
          <Link href="/spotify" className="text-[10px] font-bold text-[#1DB954]">
            Library
          </Link>
        )}
      </div>
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await spotifyPlaybackAction({ type: 'previous' })
              setPlayback(await getSpotifyPlaybackAction())
            })
          }
          className="p-1.5 text-foreground cursor-pointer disabled:opacity-50"
          aria-label="Previous"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await spotifyPlaybackAction({
                type: playback?.isPlaying ? 'pause' : 'play',
              })
              setPlayback(await getSpotifyPlaybackAction())
            })
          }
          className="w-9 h-9 rounded-full bg-[#1DB954] text-black flex items-center justify-center cursor-pointer disabled:opacity-50"
          aria-label={playback?.isPlaying ? 'Pause' : 'Play'}
        >
          {playback?.isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await spotifyPlaybackAction({ type: 'next' })
              setPlayback(await getSpotifyPlaybackAction())
            })
          }
          className="p-1.5 text-foreground cursor-pointer disabled:opacity-50"
          aria-label="Next"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
