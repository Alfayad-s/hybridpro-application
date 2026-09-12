/** Hybrid Pro dayOfWeek: 1 = Monday … 7 = Sunday (matches plan store). */

export const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

/** JS Date.getDay() (0=Sun) → Hybrid Pro 1–7 (Mon–Sun). */
export function jsDayToPlanDay(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay
}

export function planDayLabel(dayOfWeek: number): string {
  return WEEKDAY_NAMES[dayOfWeek - 1] ?? `Day ${dayOfWeek}`
}

export type AgentCalendar = {
  todayIso: string
  todayWeekday: number
  todayName: string
  tomorrowWeekday: number
  tomorrowName: string
  weekdayNames: typeof WEEKDAY_NAMES
}

export function buildAgentCalendar(now = new Date()): AgentCalendar {
  const todayWeekday = jsDayToPlanDay(now.getDay())
  const tomorrowWeekday = todayWeekday === 7 ? 1 : todayWeekday + 1
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')

  return {
    todayIso: `${y}-${m}-${d}`,
    todayWeekday,
    todayName: planDayLabel(todayWeekday),
    tomorrowWeekday,
    tomorrowName: planDayLabel(tomorrowWeekday),
    weekdayNames: WEEKDAY_NAMES,
  }
}

/**
 * Resolve dayOfWeek from number or relative/weekday strings.
 * Returns undefined if the value cannot be interpreted.
 */
export function resolveDayOfWeek(
  value: unknown,
  now = new Date()
): number | null | undefined {
  if (value === null) return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.round(value)
    if (n >= 1 && n <= 7) return n
    return undefined
  }
  if (typeof value !== 'string') return undefined

  const s = value.trim().toLowerCase()
  if (!s) return undefined
  if (s === 'null' || s === 'none' || s === 'any') return null

  const cal = buildAgentCalendar(now)
  if (s === 'today') return cal.todayWeekday
  if (s === 'tomorrow' || s === 'tmrw' || s === 'tommorow' || s === 'tommorrow') {
    return cal.tomorrowWeekday
  }

  const idx = WEEKDAY_NAMES.findIndex((n) => n.toLowerCase() === s || n.toLowerCase().startsWith(s.slice(0, 3)))
  if (idx >= 0) return idx + 1

  const asNum = Number(s)
  if (Number.isFinite(asNum)) {
    const n = Math.round(asNum)
    if (n >= 1 && n <= 7) return n
  }

  return undefined
}
