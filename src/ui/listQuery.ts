import type { TitleView } from '../lib/catalogView.ts'
import { comparePartialDates } from '../lib/partialDate.ts'
import type { ItemStatus } from '../lib/status.ts'
import type { TitleType, Universe } from '../lib/types.ts'
import { sagaRank } from './sagas.ts'

export type SortKey = 'release' | 'story' | 'title' | 'last-watched' | 'saga'
export type TypeFilter = 'all' | TitleType

export interface ListQuery {
  universe: Universe
  type: TypeFilter
  sagas: string[]
  phase: number | null
  status: ItemStatus | 'all'
  search: string
  sort: SortKey
}

export const DEFAULT_QUERY: ListQuery = {
  universe: 'mcu',
  type: 'all',
  sagas: [],
  phase: null,
  status: 'all',
  search: '',
  sort: 'release',
}

export interface ListGroup {
  key: string
  label: string
  /** Saga groups get a color and progress. */
  saga?: string
  items: TitleView[]
  watched: number
}

/** Ignores case, accents and punctuation: "shield" finds "Agents of S.H.I.E.L.D.". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export function filterViews(views: TitleView[], q: ListQuery): TitleView[] {
  const needle = normalize(q.search)
  return views.filter(
    (v) =>
      v.title.universe === q.universe &&
      (q.type === 'all' || v.title.type === q.type) &&
      (q.sagas.length === 0 || q.sagas.includes(v.title.saga)) &&
      (q.phase === null || v.title.phase === q.phase || v.seasons.some((s) => s.phase === q.phase)) &&
      (q.status === 'all' || v.summary.status === q.status) &&
      (!needle || normalize(v.title.title).includes(needle)),
  )
}

const byRelease = (a: TitleView, b: TitleView) =>
  comparePartialDates(a.title.releaseDate ?? '9999', b.title.releaseDate ?? '9999') || a.title.title.localeCompare(b.title.title)

const COMPARE: Record<SortKey, (a: TitleView, b: TitleView) => number> = {
  release: byRelease,
  saga: (a, b) => sagaRank(a.title.saga) - sagaRank(b.title.saga) || a.title.saga.localeCompare(b.title.saga) || byRelease(a, b),
  story: (a, b) => (a.title.chronoIndex ?? Infinity) - (b.title.chronoIndex ?? Infinity) || byRelease(a, b),
  title: (a, b) => sortableTitle(a.title.title).localeCompare(sortableTitle(b.title.title)),
  // Most recent first; never-watched at the end in release order.
  'last-watched': (a, b) => {
    const x = a.summary.lastWatched
    const y = b.summary.lastWatched
    if (x && y) return comparePartialDates(y, x) || byRelease(a, b)
    if (x) return -1
    if (y) return 1
    return byRelease(a, b)
  },
}

/** "The Avengers" files under A. */
export function sortableTitle(title: string): string {
  return title.replace(/^(the|a|an)\s+/i, '')
}

export function sortViews(views: TitleView[], sort: SortKey): TitleView[] {
  return [...views].sort(COMPARE[sort])
}

/** Groups the sorted list into headed sections that carry meaning for each sort. */
export function groupViews(sorted: TitleView[], sort: SortKey): ListGroup[] {
  const keyOf: Record<SortKey, (v: TitleView) => { key: string; label: string; saga?: string }> = {
    release: (v) => {
      const y = v.title.releaseDate?.slice(0, 4) ?? 'TBA'
      return { key: y, label: y }
    },
    saga: (v) => ({ key: v.title.saga, label: v.title.saga, saga: v.title.saga }),
    story: (v) => {
      const p = v.title.phase
      return p === null ? { key: 'none', label: 'Outside the phases' } : { key: `p${p}`, label: `Phase ${p}` }
    },
    title: (v) => {
      const c = sortableTitle(v.title.title)[0]?.toUpperCase() ?? '#'
      const letter = /[A-Z]/.test(c) ? c : '#'
      return { key: letter, label: letter }
    },
    'last-watched': (v) => {
      const y = v.summary.lastWatched?.slice(0, 4)
      return y ? { key: y, label: `Watched in ${y}` } : { key: 'never', label: 'Not watched yet' }
    },
  }

  const groups: ListGroup[] = []
  for (const v of sorted) {
    const g = keyOf[sort](v)
    let last = groups.at(-1)
    if (!last || last.key !== g.key) {
      last = { ...g, items: [], watched: 0 }
      groups.push(last)
    }
    last.items.push(v)
    if (v.summary.status === 'watched') last.watched++
  }
  return groups
}

/** The sagas present in a universe, in display order, for filter chips. */
export function sagasIn(views: TitleView[], universe: Universe): string[] {
  return [...new Set(views.filter((v) => v.title.universe === universe).map((v) => v.title.saga))].sort(
    (a, b) => sagaRank(a) - sagaRank(b) || a.localeCompare(b),
  )
}

export function phasesIn(views: TitleView[], universe: Universe): number[] {
  const set = new Set<number>()
  for (const v of views) {
    if (v.title.universe !== universe) continue
    if (v.title.phase !== null) set.add(v.title.phase)
    for (const s of v.seasons) if (s.phase !== null) set.add(s.phase)
  }
  return [...set].sort((a, b) => a - b)
}

export function activeFilterCount(q: ListQuery): number {
  return (q.type !== 'all' ? 1 : 0) + (q.sagas.length ? 1 : 0) + (q.phase !== null ? 1 : 0) + (q.status !== 'all' ? 1 : 0)
}
