import { precisionOf } from '../lib/partialDate.ts'
import type { PartialDate, Watch } from '../lib/types.ts'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const parts = (d: PartialDate) => ({ y: d.slice(0, 4), m: d.length >= 7 ? MONTHS[Number(d.slice(5, 7)) - 1] : null, day: d.length === 10 ? Number(d.slice(8, 10)) : null })

/** "2018-06-19" → "Jun 19, 2018"; "2021-09" → "Sep 2021"; "2021" → "2021". */
export function formatDate(d: PartialDate): string {
  const { y, m, day } = parts(d)
  if (day !== null) return `${m} ${day}, ${y}`
  if (m) return `${m} ${y}`
  return y
}

/** Collapses shared parts: "Sep 18 – 29, 2026", "Sep 30 – Oct 5, 2026", "Dec 28, 2026 – Jan 3, 2027". */
export function formatRange(start: PartialDate, end: PartialDate): string {
  if (start === end) return formatDate(start)
  const a = parts(start)
  const b = parts(end)
  if (precisionOf(start) === 'day' && precisionOf(end) === 'day' && a.y === b.y) {
    return a.m === b.m ? `${a.m} ${a.day} – ${b.day}, ${b.y}` : `${a.m} ${a.day} – ${b.m} ${b.day}, ${b.y}`
  }
  return `${formatDate(start)} – ${formatDate(end)}`
}

/** How a watch reads in a list. */
export function formatWatch(w: Pick<Watch, 'startDate' | 'endDate' | 'approximate'>): string {
  const approx = w.approximate ? '~' : ''
  if (w.startDate === null && w.endDate === null) return 'Date unknown'
  if (w.endDate === null) return `Started ${approx}${formatDate(w.startDate!)}`
  if (w.startDate === null) return `${approx}${formatDate(w.endDate)}`
  return `${approx}${formatRange(w.startDate, w.endDate)}`
}

/** Whole days from today to a date (positive = future). Partial dates count from their first day. */
export function daysUntil(date: PartialDate, today: PartialDate): number {
  const pad = date.length === 4 ? `${date}-01-01` : date.length === 7 ? `${date}-01` : date
  return Math.round((Date.parse(pad) - Date.parse(today)) / 86_400_000)
}

export function formatCountdown(date: PartialDate, today: PartialDate): string {
  const days = daysUntil(date, today)
  if (precisionOf(date) !== 'day') return `Coming ${formatDate(date)}`
  if (days <= 0) return 'Out now'
  if (days === 1) return 'Out tomorrow'
  if (days < 60) return `Out in ${days} days`
  return `Out ${formatDate(date)}`
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
