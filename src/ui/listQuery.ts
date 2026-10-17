import type { TitleView } from '../lib/catalogView.ts'
import { comparePartialDates } from '../lib/partialDate.ts'
import { compareWatches, isFinished, seasonStatus, type ItemStatus } from '../lib/status.ts'
import type { PartialDate, Season, TitleType, Universe } from '../lib/types.ts'
import { sagaRank } from './sagas.ts'

/** "release-seasons" lists each season of a show on its own, by premiere date. */
export type SortKey = 'release' | 'release-seasons' | 'story' | 'title' | 'last-watched' | 'saga'
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

/** The part of the query set from the Filters drawer or sidebar. */
export type FilterValues = Pick<ListQuery, 'sagas' | 'phase' | 'status'>
export const NO_FILTERS: FilterValues = { sagas: [], phase: null, status: 'all' }

export const DEFAULT_QUERY: ListQuery = {
  universe: 'mcu',
  type: 'all',
  sagas: [],
  phase: null,
  status: 'all',
  search: '',
  sort: 'release',
}

/**
 * One row of the list: a whole title, or (in "Release by season") one season of a show,
 * carrying that season's own date, status and watches.
 */
export interface ListEntry {
  key: string
  view: TitleView
  season: Season | null
  releaseDate: PartialDate | null
  status: ItemStatus
  lastWatched: PartialDate | null
  watchCount: number
}

export interface ListGroup {
  key: string
  label: string
  /** Saga groups get a color and progress. */
  saga?: string
  items: ListEntry[]
  watched: number
}

export function toEntries(views: TitleView[], bySeason: boolean, today: PartialDate): ListEntry[] {
  return views.flatMap((view): ListEntry[] => {
    if (!bySeason || view.title.type !== 'series' || view.seasons.length === 0) {
      const { status, lastWatched, watchCount } = view.summary
      return [{ key: view.title.id, view, season: null, releaseDate: view.title.releaseDate, status, lastWatched, watchCount }]
    }
    return view.seasons.map((season) => {
      const mine = view.watches.filter((w) => w.seasonId === season.id).sort(compareWatches)
      const dated = mine.map((w) => w.endDate ?? w.startDate).filter((d): d is PartialDate => d !== null).sort(comparePartialDates)
      return {
        key: season.id,
        view,
        season,
        releaseDate: season.premiereDate,
        status: seasonStatus(season, mine, today),
        lastWatched: dated.at(-1) ?? null,
        watchCount: mine.filter(isFinished).length,
      }
    })
  })
}

/** Ignores case, accents and punctuation: "shield" finds "Agents of S.H.I.E.L.D.". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

const matchesPhase = (e: ListEntry, phase: number) =>
  e.season ? (e.season.phase ?? e.view.title.phase) === phase : e.view.title.phase === phase || e.view.seasons.some((s) => s.phase === phase)

export function filterEntries(entries: ListEntry[], q: ListQuery): ListEntry[] {
  const needle = normalize(q.search)
  return entries.filter(
    (e) =>
      e.view.title.universe === q.universe &&
      (q.type === 'all' || e.view.title.type === q.type) &&
      (q.sagas.length === 0 || q.sagas.includes(e.view.title.saga)) &&
      (q.phase === null || matchesPhase(e, q.phase)) &&
      (q.status === 'all' || e.status === q.status) &&
      (!needle || normalize(e.view.title.title).includes(needle)),
  )
}

const seasonNo = (e: ListEntry) => e.season?.number ?? 0

const byRelease = (a: ListEntry, b: ListEntry) =>
  comparePartialDates(a.releaseDate ?? '9999', b.releaseDate ?? '9999') ||
  a.view.title.title.localeCompare(b.view.title.title) ||
  seasonNo(a) - seasonNo(b)

const COMPARE: Record<SortKey, (a: ListEntry, b: ListEntry) => number> = {
  release: byRelease,
  'release-seasons': byRelease,
  saga: (a, b) => sagaRank(a.view.title.saga) - sagaRank(b.view.title.saga) || a.view.title.saga.localeCompare(b.view.title.saga) || byRelease(a, b),
  story: (a, b) => (a.view.title.chronoIndex ?? Infinity) - (b.view.title.chronoIndex ?? Infinity) || byRelease(a, b),
  title: (a, b) => sortableTitle(a.view.title.title).localeCompare(sortableTitle(b.view.title.title)) || seasonNo(a) - seasonNo(b),
  // Most recent first; never-watched at the end in release order.
  'last-watched': (a, b) => {
    const x = a.lastWatched
    const y = b.lastWatched
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

export function sortEntries(entries: ListEntry[], sort: SortKey): ListEntry[] {
  return [...entries].sort(COMPARE[sort])
}

const byYear = (e: ListEntry) => {
  const y = e.releaseDate?.slice(0, 4) ?? 'TBA'
  return { key: y, label: y }
}

/** Groups the sorted list into headed sections that carry meaning for each sort. */
export function groupEntries(sorted: ListEntry[], sort: SortKey): ListGroup[] {
  const keyOf: Record<SortKey, (e: ListEntry) => { key: string; label: string; saga?: string }> = {
    release: byYear,
    'release-seasons': byYear,
    saga: ({ view: v }) => ({ key: v.title.saga, label: v.title.saga, saga: v.title.saga }),
    // Story order jumps between phases (Captain Marvel sits among Phase 1), so it's one run.
    story: () => ({ key: 'story', label: 'In story order' }),
    title: ({ view: v }) => {
      const c = sortableTitle(v.title.title)[0]?.toUpperCase() ?? '#'
      const letter = /[A-Z]/.test(c) ? c : '#'
      return { key: letter, label: letter }
    },
    'last-watched': (e) => {
      const y = e.lastWatched?.slice(0, 4)
      return y ? { key: y, label: `Watched in ${y}` } : { key: 'never', label: 'Not watched yet' }
    },
  }

  const groups: ListGroup[] = []
  for (const v of sorted) {
    const g = keyOf[sort](v)
    let last = groups.at(-1)
    if (!last || last.key !== g.key) {
      // Keys stay unique even if a sort ever splits a group.
      const repeat = groups.filter((x) => x.key.split('~')[0] === g.key).length
      last = { ...g, key: repeat ? `${g.key}~${repeat}` : g.key, items: [], watched: 0 }
      groups.push(last)
    }
    last.items.push(v)
    if (v.status === 'watched') last.watched++
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
