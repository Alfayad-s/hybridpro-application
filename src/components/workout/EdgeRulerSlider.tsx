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

const TRACK_HEIGHT = 420
const PX_PER_STEP = 14
const VISIBLE_STEPS = Math.ceil(TRACK_HEIGHT / PX_PER_STEP) + 6

/** Fluorescent center marker */
const NEON_GREEN = '#39FF14'
const TICK_WHITE = 'rgba(255, 255, 255, 1)'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function roundToStep(n: number, step: number) {
  return Math.round(n / step) * step
}

function buzz() {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  try {
    navigator.vibrate(12)
  } catch {
    /* ignore */
  }
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
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    startY: number
    startValue: number
  } | null>(null)
  const lastCommittedRef = useRef(value)
  const rafRef = useRef<number | null>(null)
  const pendingYRef = useRef<number | null>(null)

  const [dragging, setDragging] = useState(false)
  // Continuous visual value for smooth scroll (may be mid-step while dragging)
  const [visualValue, setVisualValue] = useState(() => clamp(value, min, max))

  const safeCommitted = clamp(roundToStep(value, step), min, max)

  // Sync visual from external value when not dragging
  useEffect(() => {
    if (dragRef.current) return
    setVisualValue(safeCommitted)
    lastCommittedRef.current = safeCommitted
  }, [safeCommitted])

  const applyDragY = useCallback(
    (clientY: number) => {
      const drag = dragRef.current
      if (!drag) return

      const deltaY = clientY - drag.startY
      // Drag up → increase
      const raw = drag.startValue + (-deltaY / PX_PER_STEP) * step
      const nextVisual = clamp(raw, min, max)
      setVisualValue(nextVisual)

      const snapped = clamp(roundToStep(nextVisual, step), min, max)
      if (snapped !== lastCommittedRef.current) {
        lastCommittedRef.current = snapped
        buzz()
        onChange(snapped)
      }
    },
    [min, max, step, onChange]
  )

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startValue: visualValue,
    }
    lastCommittedRef.current = safeCommitted
    setDragging(true)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    pendingYRef.current = e.clientY
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const y = pendingYRef.current
      if (y == null) return
      applyDragY(y)
    })
  }

  const endDrag = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (pendingYRef.current != null) {
      applyDragY(pendingYRef.current)
      pendingYRef.current = null
    }
    dragRef.current = null
    setDragging(false)
    const snapped = clamp(roundToStep(lastCommittedRef.current, step), min, max)
    setVisualValue(snapped)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }

  const stepIndexExact = (visualValue - min) / step
  const centerIndex = Math.round(stepIndexExact)
  const fractionalOffset = (stepIndexExact - centerIndex) * PX_PER_STEP

  const ticks = useMemo(() => {
    const half = Math.ceil(VISIBLE_STEPS / 2)
    const out: { index: number; major: boolean; label?: string }[] = []
    for (let i = centerIndex - half; i <= centerIndex + half; i++) {
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
  }, [centerIndex, min, max, step, majorEvery])

  const isLeft = side === 'left'
  const displayValue = step < 1 ? Number(safeCommitted.toFixed(2)) : safeCommitted
  const activeLabel = formatTick(safeCommitted, step)

  const bump = (dir: 1 | -1) => {
    const next = clamp(roundToStep(safeCommitted + dir * step, step), min, max)
    if (next !== safeCommitted) {
      buzz()
      setVisualValue(next)
      onChange(next)
    }
  }

  return (
    <div
      className={`pointer-events-auto absolute top-1/2 z-40 -translate-y-1/2 select-none ${
        isLeft ? 'left-0' : 'right-0'
      } ${className}`}
      style={{ touchAction: 'none' }}
    >
      <div
        ref={trackRef}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={safeCommitted}
        aria-valuetext={unit ? `${displayValue} ${unit}` : String(displayValue)}
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
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`relative flex h-[420px] min-w-[4.5rem] flex-col outline-none overflow-visible ${
          isLeft ? 'items-start pl-1' : 'items-end pr-1'
        } ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        {/* Vertical clip only; wide enough that tick labels aren't cut off */}
        <div
          className={`relative h-full overflow-y-hidden overflow-x-visible ${
            isLeft ? 'w-[4.5rem]' : 'w-[4.5rem]'
          }`}
        >
          <div
            className="absolute inset-0 will-change-transform"
            style={{
              transform: `translateY(${-fractionalOffset}px)`,
              transition: dragging ? 'none' : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {ticks.map((tick) => {
              const offsetY = (tick.index - centerIndex) * PX_PER_STEP
              const isActive = tick.index === Math.round((safeCommitted - min) / step)
              const tickW = tick.major ? 18 : 11

              return (
                <div
                  key={tick.index}
                  className="absolute flex items-center"
                  style={{
                    top: `calc(50% + ${offsetY}px)`,
                    [isLeft ? 'left' : 'right']: 0,
                    transform: 'translateY(-50%)',
                    opacity: isActive ? 0 : 0.1,
                    flexDirection: isLeft ? 'row' : 'row-reverse',
                    gap: 4,
                  }}
                >
                  <span
                    className="block rounded-full shrink-0"
                    style={{
                      width: tickW,
                      height: tick.major ? 2 : 1.5,
                      backgroundColor: TICK_WHITE,
                    }}
                  />
                  {tick.label != null && !isActive && (
                    <span className="text-[9px] font-semibold tabular-nums leading-none text-white whitespace-nowrap">
                      {tick.label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Center marker + number sit outside overflow clip so the full value shows */}
        <div
          className={`pointer-events-none absolute top-1/2 z-10 flex -translate-y-1/2 items-center gap-1.5 ${
            isLeft ? 'left-1' : 'right-1 flex-row-reverse'
          }`}
        >
          <span
            className="rounded-full shrink-0"
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
