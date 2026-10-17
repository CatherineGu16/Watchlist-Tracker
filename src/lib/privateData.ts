import { isPartialDate } from './partialDate.ts'
import type { PrivateData, Season, Title, Watch } from './types.ts'

/**
 * Combines two copies of your data, record by record: the newer updatedAt wins, and deletes travel
 * as tombstones. Used for Import (merge) now and GitHub sync later.
 */
export function mergeData(a: PrivateData, b: PrivateData): PrivateData {
  const overrides = { ...a.titleOverrides }
  for (const [id, o] of Object.entries(b.titleOverrides)) overrides[id] = { ...overrides[id], ...o }

  return {
    schemaVersion: 1,
    updatedAt: a.updatedAt > b.updatedAt ? a.updatedAt : b.updatedAt,
    watches: newestById<Watch>(a.watches, b.watches),
    customTitles: newestById<Title>(a.customTitles, b.customTitles),
    customSeasons: newestById<Season>(a.customSeasons, b.customSeasons),
    titleOverrides: overrides,
  }
}

type Synced = { id: string; updatedAt?: string; deleted?: boolean }

/** Per id, the newer updatedAt wins; on a tie, a delete wins so it can't be undone by an older copy. */
function newestById<T extends Synced>(xs: T[], ys: T[]): T[] {
  const out = new Map<string, T>()
  for (const x of [...xs, ...ys]) {
    const have = out.get(x.id)
    const [t, h] = [x.updatedAt ?? '', have?.updatedAt ?? '']
    if (!have || t > h || (t === h && x.deleted)) out.set(x.id, x)
  }
  return [...out.values()]
}

/** Checks a file someone picked for Import before it can touch your data. */
export function parsePrivateData(input: unknown): PrivateData {
  const fail = (msg: string): never => {
    throw new Error(`This doesn't look like a watchlist backup: ${msg}`)
  }
  if (!isObject(input)) fail('not a JSON object')
  const o = input as Record<string, unknown>
  if (o.schemaVersion !== 1) fail('unknown version')
  if (!Array.isArray(o.watches)) fail('missing watches')

  const dateOrNull = (v: unknown) => v === null || (typeof v === 'string' && isPartialDate(v))
  ;(o.watches as unknown[]).forEach((w, i) => {
    if (!isObject(w)) fail(`watch ${i + 1} is not an object`)
    const x = w as Record<string, unknown>
    if (typeof x.id !== 'string' || typeof x.titleId !== 'string') fail(`watch ${i + 1} has no id`)
    if (!(x.seasonId === null || typeof x.seasonId === 'string')) fail(`watch ${i + 1} has a bad season`)
    if (!dateOrNull(x.startDate) || !dateOrNull(x.endDate)) fail(`watch ${i + 1} has a bad date`)
    if (typeof x.updatedAt !== 'string') fail(`watch ${i + 1} has no timestamp`)
  })

  return {
    schemaVersion: 1,
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date(0).toISOString(),
    watches: (o.watches as Watch[]).map((w) => ({
      ...w,
      approximate: Boolean(w.approximate),
      episodesWatched: typeof w.episodesWatched === 'number' ? w.episodesWatched : null,
      note: typeof w.note === 'string' ? w.note : '',
      createdAt: typeof w.createdAt === 'string' ? w.createdAt : w.updatedAt,
    })),
    // Titles and seasons you added: drop anything malformed rather than letting it break the list.
    customTitles: (Array.isArray(o.customTitles) ? (o.customTitles as Title[]) : []).filter(
      (t) => isObject(t) && typeof t.id === 'string' && typeof t.title === 'string' && ['movie', 'series', 'special'].includes(t.type),
    ),
    customSeasons: (Array.isArray(o.customSeasons) ? (o.customSeasons as Season[]) : []).filter(
      (s) => isObject(s) && typeof s.id === 'string' && typeof s.titleId === 'string' && typeof s.number === 'number',
    ),
    titleOverrides: isObject(o.titleOverrides) ? (o.titleOverrides as PrivateData['titleOverrides']) : {},
  }
}

function isObject(v: unknown): v is object {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
