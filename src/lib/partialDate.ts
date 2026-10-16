import type { PartialDate } from './types.ts'

const PARTIAL_DATE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/

export type DatePrecision = 'year' | 'month' | 'day'

export function isPartialDate(value: string): value is PartialDate {
  return PARTIAL_DATE.test(value)
}

export function precisionOf(date: PartialDate): DatePrecision {
  return date.length === 4 ? 'year' : date.length === 7 ? 'month' : 'day'
}

/**
 * Orders partial dates. A less precise date sorts before more precise dates it contains
 * ("2021" < "2021-03" < "2021-03-05"), which is what plain string comparison gives us.
 */
export function comparePartialDates(a: PartialDate, b: PartialDate): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** True once the date has started, e.g. "2026" is reached on 2026-01-01. */
export function isOnOrBefore(date: PartialDate, today: PartialDate): boolean {
  return comparePartialDates(date, today) <= 0
}

export function todayIso(now: Date = new Date()): PartialDate {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "7/14/2000" → "2000-07-14". Returns null for anything else ("Fall 2026 (TBA)", ""). */
export function parseUsDate(text: string): PartialDate | null {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const iso = `${m[3]}-${pad(Number(m[1]))}-${pad(Number(m[2]))}`
  return isPartialDate(iso) ? iso : null
}

export interface WatchSpan {
  start: PartialDate | null
  end: PartialDate | null
  approximate: boolean
}

/**
 * Parses one watch-date cell from the Google Sheet into watch spans.
 *
 *   "07/04/2024"            → finished on that day
 *   "2019" / "2018?"        → finished that year (the "?" marks it approximate)
 *   "2019, 2024"            → two watches
 *   "03/04 - 03/15/2024"    → start and end; the start inherits the end's year
 *   "2019 - "               → started, not finished
 */
export function parseWatchCell(cell: string): WatchSpan[] {
  const text = cell.trim()
  if (!text) return []
  return text.split(',').map((part) => parseWatchPart(part.trim()))
}

function parseWatchPart(part: string): WatchSpan {
  const range = part.match(/^(.*?)\s*-\s*(.*)$/)
  if (range && !isPartialDate(part)) {
    const end = range[2] ? parseSingle(range[2]) : null
    const start = parseSingle(range[1], end?.date)
    if (!start) throw new Error(`Unrecognized watch date: "${part}"`)
    return {
      start: start.date,
      end: end?.date ?? null,
      approximate: start.approximate || (end?.approximate ?? false),
    }
  }
  const single = parseSingle(part)
  if (!single) throw new Error(`Unrecognized watch date: "${part}"`)
  return { start: null, end: single.date, approximate: single.approximate }
}

function parseSingle(
  text: string,
  yearSource?: PartialDate,
): { date: PartialDate; approximate: boolean } | null {
  const approximate = text.endsWith('?')
  const clean = text.replace(/\?$/, '').trim()

  if (/^\d{4}$/.test(clean)) return { date: clean, approximate }

  const full = parseUsDate(clean)
  if (full) return { date: full, approximate }

  // "03/04" inside a range takes its year from the end date.
  const monthDay = clean.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (monthDay && yearSource) {
    const endYear = Number(yearSource.slice(0, 4))
    const endMonth = yearSource.length >= 7 ? Number(yearSource.slice(5, 7)) : 12
    const month = Number(monthDay[1])
    const year = month > endMonth ? endYear - 1 : endYear
    const iso = `${year}-${pad(month)}-${pad(Number(monthDay[2]))}`
    if (isPartialDate(iso)) return { date: iso, approximate }
  }
  return null
}
