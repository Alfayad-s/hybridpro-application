'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { ChartLine } from '@/components/animate-ui/icons/chart-line'
import { Cherry } from '@/components/animate-ui/icons/cherry'
import { Gauge } from '@/components/animate-ui/icons/gauge'
import { RotateCcw } from '@/components/animate-ui/icons/rotate-ccw'
import { CompanyMark } from '@/components/brand/CompanyMark'
import { WeatherNavTag } from '@/components/layout/WeatherNavTag'
import { useWeather } from '@/hooks/useWeather'
import { shouldPlayRainVideo } from '@/lib/weather/styles'
import { useSubscription } from '@/hooks/useSubscription'

const RAIN_VIDEO_SRC = '/media/video/rainy-wallpaper.mp4'

export function BottomNavigation() {
  const pathname = usePathname()
  const videoRef = useRef<HTMLVideoElement>(null)
  const weather = useWeather()
  const showRainVideo = shouldPlayRainVideo(weather?.label)
  const { canAccess } = useSubscription()
  const canUseAi = canAccess('ai')

  const hideNav =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/subscribe' ||
    pathname === '/forgot-password' ||
    pathname === '/workout' ||
    pathname === '/ai' ||
    pathname?.startsWith('/auth/')

  useEffect(() => {
    if (hideNav || !showRainVideo) return
    const video = videoRef.current
    if (!video) return

    video.muted = true
    video.defaultMuted = true
    video.playsInline = true
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    video.setAttribute('disablepictureinpicture', '')
    video.setAttribute('controlslist', 'nodownload nofullscreen noremoteplayback')

    const tryPlay = () => {
      const playPromise = video.play()
      if (playPromise) void playPromise.catch(() => {})
    }

    tryPlay()
    video.addEventListener('loadeddata', tryPlay)
    video.addEventListener('canplay', tryPlay)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tryPlay()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      video.removeEventListener('loadeddata', tryPlay)
      video.removeEventListener('canplay', tryPlay)
      document.removeEventListener('visibilitychange', onVisibility)
      video.pause()
    }
  }, [hideNav, showRainVideo])

  if (hideNav) return null

  const isTabActive = (href: string) =>
    pathname === href || Boolean(pathname?.startsWith(`${href}/`))

  const homeActive = isTabActive('/dashboard')
  const historyActive = isTabActive('/history')
  const progressActive = isTabActive('/progress')
  const mealsActive = isTabActive('/meals')

  return (
    <div className="fixed bottom-0 left-0 right-0 sm:max-w-[430px] mx-auto z-50 bg-black">
      <div
        className={`relative border-t border-border/60 pt-3 pb-2.5 px-[var(--app-page-x)] overflow-visible min-h-[var(--app-nav-height)] max-[700px]:pt-2 max-[700px]:pb-1.5 ${
          showRainVideo ? '' : 'bg-black'
        }`}
      >
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full z-20 pointer-events-none">
          <WeatherNavTag weather={weather} />
        </div>

        {showRainVideo && (
          <>
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover pointer-events-none select-none -z-10"
              src={RAIN_VIDEO_SRC}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              tabIndex={-1}
              aria-hidden
              disablePictureInPicture
              disableRemotePlayback
            />
            <div className="absolute inset-0 bg-background/35 dark:bg-background/40 pointer-events-none -z-10" />
          </>
        )}

        <div className="relative z-10 grid grid-cols-5 items-center gap-1">
          <Link
            href="/dashboard"
            replace
            prefetch
            className={`flex flex-col items-center justify-center gap-1 min-h-11 py-1.5 transition-all duration-200 active:scale-95 ${
              homeActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Gauge
              size={20}
              animateOnTap
              strokeWidth={homeActive ? 2.5 : 2}
              className="h-5 w-5"
            />
            <span className="text-[10px] font-medium">Home</span>
          </Link>

          <Link
            href="/history"
            replace
            prefetch
            className={`flex flex-col items-center justify-center gap-1 min-h-11 py-1.5 transition-all duration-200 active:scale-95 ${
              historyActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <RotateCcw
              size={20}
              animateOnTap
              animation="rotate"
              strokeWidth={historyActive ? 2.5 : 2}
              className="h-5 w-5"
            />
            <span className="text-[10px] font-medium">History</span>
          </Link>

          <Link
            href={canUseAi ? '/ai' : '/subscribe?upgrade=performance'}
            aria-label={canUseAi ? 'Open AI chat' : 'Upgrade for AI coach'}
            className="flex flex-col items-center justify-center gap-1 min-h-11 py-1.5 text-primary transition-all duration-200 active:scale-95"
          >
            <CompanyMark className="h-7 w-auto" />
            <span className="text-[10px] font-medium">AI</span>
          </Link>

          <Link
            href="/progress"
            replace
            prefetch
            className={`flex flex-col items-center justify-center gap-1 min-h-11 py-1.5 transition-all duration-200 active:scale-95 ${
              progressActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ChartLine
              size={20}
              animateOnTap
              strokeWidth={progressActive ? 2.5 : 2}
              className="h-5 w-5"
            />
            <span className="text-[10px] font-medium">Progress</span>
          </Link>

          <Link
            href="/meals"
            replace
            prefetch
            className={`flex flex-col items-center justify-center gap-1 min-h-11 py-1.5 transition-all duration-200 active:scale-95 ${
              mealsActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Cherry
              size={20}
              animateOnTap
              strokeWidth={mealsActive ? 2.5 : 2}
              className="h-5 w-5"
            />
            <span className="text-[10px] font-medium">Meals</span>
          </Link>
        </div>
      </div>
      {/* Paint phone home-indicator / gesture safe area the same black as the nav */}
      <div
        className="w-full bg-black"
        style={{ height: 'env(safe-area-inset-bottom, 0px)' }}
        aria-hidden
      />
    </div>
  )
}
