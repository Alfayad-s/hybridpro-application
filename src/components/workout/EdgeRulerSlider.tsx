'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface EdgeRulerSliderProps {
  side: 'left' | 'right'
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  label: string
  unit?: string
  /** Major tick every N steps (default 5) */
  majorEvery?: number
  className?: string
}

const TRACK_HEIGHT = 440
/** Pixels of finger travel per step — higher = less sensitive / smoother feel */
const PX_PER_STEP = 18
const WINDOW_STEPS = Math.ceil(TRACK_HEIGHT / PX_PER_STEP) + 10

const NEON_GREEN = '#39FF14'
const TICK_WHITE = 'rgba(255, 255, 255, 1)'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function roundToStep(n: number, step: number) {
  const rounded = Math.round(n / step) * step
  // Avoid float dust (e.g. 5.5000000002)
  const decimals = step < 1 ? String(step).split('.')[1]?.length ?? 2 : 0
  return Number(rounded.toFixed(decimals))
}

function buzz() {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  try {
    navigator.vibrate(10)
  } catch {
    /* ignore */
  }
}

function lockPageScroll() {
  const html = document.documentElement
  const body = document.body
  if (body.dataset.edgeSliderScrollLock) return
  html.dataset.edgeSliderScrollLock = '1'
  body.dataset.edgeSliderScrollLock = '1'
  html.style.overflow = 'hidden'
  body.style.overflow = 'hidden'
  body.style.touchAction = 'none'
  body.style.overscrollBehavior = 'none'
}

function unlockPageScroll() {
  const html = document.documentElement
  const body = document.body
  if (!body.dataset.edgeSliderScrollLock) return
  delete html.dataset.edgeSliderScrollLock
  delete body.dataset.edgeSliderScrollLock
  html.style.overflow = ''
  body.style.overflow = ''
  body.style.touchAction = ''
  body.style.overscrollBehavior = ''
}

export function EdgeRulerSlider({
  side,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  unit,
  majorEvery = 5,
  className = '',
}: EdgeRulerSliderProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const visualRef = useRef(clamp(value, min, max))
  const lastCommittedRef = useRef(clamp(roundToStep(value, step), min, max))
  const draggingRef = useRef(false)
  const pointerIdRef = useRef<number | null>(null)
  const startYRef = useRef(0)
  const startValueRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const pendingYRef = useRef<number | null>(null)
  const windowCenterRef = useRef(0)

  const [dragging, setDragging] = useState(false)
  const [displayValue, setDisplayValue] = useState(() =>
    clamp(roundToStep(value, step), min, max)
  )
  const [windowCenter, setWindowCenter] = useState(() =>
    Math.round((clamp(value, min, max) - min) / step)
  )

  const safeCommitted = clamp(roundToStep(value, step), min, max)

  const applyStripTransform = useCallback(
    (visual: number) => {
      const strip = stripRef.current
      if (!strip) return
      // Place value at vertical center: translate so visual maps to mid track
      const stepsFromMin = (visual - min) / step
      const y = TRACK_HEIGHT / 2 - stepsFromMin * PX_PER_STEP
      strip.style.transform = `translate3d(0, ${y}px, 0)`
    },
    [min, step]
  )

  // Sync from store when not dragging
  useEffect(() => {
    if (draggingRef.current) return
    visualRef.current = safeCommitted
    lastCommittedRef.current = safeCommitted
    setDisplayValue(safeCommitted)
    const center = Math.round((safeCommitted - min) / step)
    windowCenterRef.current = center
    setWindowCenter(center)
    applyStripTransform(safeCommitted)
  }, [safeCommitted, min, step, applyStripTransform])

  // Initial paint
  useEffect(() => {
    applyStripTransform(visualRef.current)
  }, [applyStripTransform])

  const commitIfNeeded = useCallback(
    (visual: number) => {
      const snapped = clamp(roundToStep(visual, step), min, max)
      if (snapped !== lastCommittedRef.current) {
        lastCommittedRef.current = snapped
        setDisplayValue(snapped)
        buzz()
        onChange(snapped)
      }

      // Re-center tick window when we drift far from generated ticks
      const idx = Math.round((visual - min) / step)
      if (Math.abs(idx - windowCenterRef.current) > WINDOW_STEPS / 3) {
        windowCenterRef.current = idx
        setWindowCenter(idx)
      }
    },
    [min, max, step, onChange]
  )

  const applyDragY = useCallback(
    (clientY: number) => {
      if (!draggingRef.current) return
      const deltaY = clientY - startYRef.current
      const raw = startValueRef.current + (-deltaY / PX_PER_STEP) * step
      const nextVisual = clamp(raw, min, max)
      visualRef.current = nextVisual
      applyStripTransform(nextVisual)
      commitIfNeeded(nextVisual)
    },
    [min, max, step, applyStripTransform, commitIfNeeded]
  )

  const scheduleDragY = useCallback(
    (clientY: number) => {
      pendingYRef.current = clientY
      if (rafRef.current != null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const y = pendingYRef.current
        if (y == null) return
        applyDragY(y)
      })
    },
    [applyDragY]
  )

  const endDrag = useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    pointerIdRef.current = null
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (pendingYRef.current != null) {
      applyDragY(pendingYRef.current)
      pendingYRef.current = null
    }
    const snapped = clamp(roundToStep(visualRef.current, step), min, max)
    visualRef.current = snapped
    lastCommittedRef.current = snapped
    setDisplayValue(snapped)
    applyStripTransform(snapped)
    setDragging(false)
    unlockPageScroll()
  }, [min, max, step, applyDragY, applyStripTransform])

  const startDrag = useCallback(
    (clientY: number, pointerId: number | null) => {
      draggingRef.current = true
      pointerIdRef.current = pointerId
      startYRef.current = clientY
      startValueRef.current = visualRef.current
      lastCommittedRef.current = safeCommitted
      setDragging(true)
      lockPageScroll()
    },
    [safeCommitted]
  )

  // Native non-passive touch listeners — required to block page scroll on iOS/Android
  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      e.preventDefault()
      startDrag(e.touches[0].clientY, null)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!draggingRef.current) return
      e.preventDefault()
      e.stopPropagation()
      if (e.touches.length !== 1) return
      scheduleDragY(e.touches[0].clientY)
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!draggingRef.current) return
      e.preventDefault()
      endDrag()
    }

    // Block scroll anywhere on the page while this dial is active
    const onDocTouchMove = (e: TouchEvent) => {
      if (!draggingRef.current) return
      e.preventDefault()
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: false })
    el.addEventListener('touchcancel', onTouchEnd, { passive: false })
    document.addEventListener('touchmove', onDocTouchMove, { passive: false })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
      document.removeEventListener('touchmove', onDocTouchMove)
      unlockPageScroll()
    }
  }, [startDrag, scheduleDragY, endDrag])

  // Pointer path for mouse / stylus
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return // handled by native touch
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    startDrag(e.clientY, e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return
    if (!draggingRef.current || pointerIdRef.current !== e.pointerId) return
    e.preventDefault()
    scheduleDragY(e.clientY)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return
    if (!draggingRef.current || pointerIdRef.current !== e.pointerId) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    endDrag()
  }

  const ticks = useMemo(() => {
    const half = Math.ceil(WINDOW_STEPS / 2)
    const out: { index: number; major: boolean; label?: string }[] = []
    for (let i = windowCenter - half; i <= windowCenter + half; i++) {
      const v = min + i * step
      if (v < min - step || v > max + step) continue
      const major = i % majorEvery === 0
      out.push({
        index: i,
        major,
        label: major && v >= min && v <= max ? formatTick(v, step) : undefined,
      })
    }
    return out
  }, [windowCenter, min, max, step, majorEvery])

  // After window regenerates, keep strip transform in sync
  useEffect(() => {
    applyStripTransform(visualRef.current)
  }, [ticks, applyStripTransform])

  const isLeft = side === 'left'
  const activeLabel = formatTick(displayValue, step)
  const ariaValue =
    step < 1 ? Number(displayValue.toFixed(2)) : displayValue

  const bump = (dir: 1 | -1) => {
    const next = clamp(roundToStep(displayValue + dir * step, step), min, max)
    if (next === displayValue) return
    visualRef.current = next
    lastCommittedRef.current = next
    setDisplayValue(next)
    applyStripTransform(next)
    buzz()
    onChange(next)
  }

  return (
    <div
      ref={rootRef}
      className={`pointer-events-auto absolute top-1/2 z-40 -translate-y-1/2 select-none touch-none overscroll-none ${
        isLeft ? 'left-0' : 'right-0'
      } ${className}`}
      style={{
        touchAction: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        // Wide hit area for thumbs on phone edges
        paddingLeft: isLeft ? 2 : 10,
        paddingRight: isLeft ? 10 : 2,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={ariaValue}
        aria-valuetext={unit ? `${ariaValue} ${unit}` : String(ariaValue)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
            e.preventDefault()
            bump(1)
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
            e.preventDefault()
            bump(-1)
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`relative flex outline-none overflow-visible ${
          isLeft ? 'items-start' : 'items-end'
        } ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          height: TRACK_HEIGHT,
          minWidth: 72,
          touchAction: 'none',
        }}
      >
        <div
          className="relative overflow-hidden"
          style={{ height: TRACK_HEIGHT, width: 72 }}
        >
          <div
            ref={stripRef}
            className="absolute left-0 right-0 top-0 will-change-transform"
            style={{
              // transform set via ref for 60fps; no CSS transition while dragging
              transition: dragging
                ? 'none'
                : 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {ticks.map((tick) => {
              const y = tick.index * PX_PER_STEP
              const isActive =
                tick.index === Math.round((displayValue - min) / step)
              const tickW = tick.major ? 18 : 11

              return (
                <div
                  key={tick.index}
                  className="absolute flex items-center"
                  style={{
                    top: y,
                    [isLeft ? 'left' : 'right']: 0,
                    transform: 'translateY(-50%)',
                    opacity: isActive ? 0 : 0.1,
                    flexDirection: isLeft ? 'row' : 'row-reverse',
                    gap: 4,
                  }}
                >
                  <span
                    className="block shrink-0 rounded-full"
                    style={{
                      width: tickW,
                      height: tick.major ? 2 : 1.5,
                      backgroundColor: TICK_WHITE,
                    }}
                  />
                  {tick.label != null && !isActive && (
                    <span className="whitespace-nowrap text-[9px] font-semibold tabular-nums leading-none text-white">
                      {tick.label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div
          className={`pointer-events-none absolute top-1/2 z-10 flex -translate-y-1/2 items-center gap-1.5 ${
            isLeft ? 'left-1' : 'right-1 flex-row-reverse'
          }`}
        >
          <span
            className="shrink-0 rounded-full"
            style={{
              width: 32,
              height: 5,
              backgroundColor: NEON_GREEN,
              boxShadow: `0 0 10px ${NEON_GREEN}, 0 0 22px ${NEON_GREEN}`,
            }}
          />
          <span
            className="shrink-0 whitespace-nowrap text-[12px] font-bold tabular-nums leading-none"
            style={{ color: NEON_GREEN, opacity: 1 }}
          >
            {activeLabel}
            {unit ? (
              <span className="ml-0.5 text-[9px] font-semibold opacity-90">{unit}</span>
            ) : null}
          </span>
        </div>
      </div>
    </div>
  )
}

function formatTick(v: number, step: number) {
  if (step < 1) {
    return Number(v.toFixed(step <= 0.25 ? 2 : 1)).toString()
  }
  return String(Math.round(v))
}
