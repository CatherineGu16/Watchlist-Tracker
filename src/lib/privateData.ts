import { isPartialDate } from './partialDate.ts'
import type { PrivateData, Season, Title, Watch } from './types.ts'

/**
 * Combines two copies of your data, record by record: the newer updatedAt wins, and deletes travel
 * as tombstones. Used for Import (merge) now and GitHub sync later.
 */
export function mergeData(a: PrivateData, b: PrivateData): PrivateData {
  const watches = new Map<string, Watch>()
  for (const w of [...a.watches, ...b.watches]) {
    const have = watches.get(w.id)
    if (!have || w.updatedAt > have.updatedAt || (w.updatedAt === have.updatedAt && w.deleted)) watches.set(w.id, w)
  }
  const byId = <T extends { id: string }>(xs: T[], ys: T[]) => [...new Map([...xs, ...ys].map((x) => [x.id, x])).values()]
  const overrides = { ...a.titleOverrides }
  for (const [id, o] of Object.entries(b.titleOverrides)) overrides[id] = { ...overrides[id], ...o }

  return {
    schemaVersion: 1,
    updatedAt: a.updatedAt > b.updatedAt ? a.updatedAt : b.updatedAt,
    watches: [...watches.values()],
    customTitles: byId<Title>(a.customTitles, b.customTitles),
    customSeasons: byId<Season>(a.customSeasons, b.customSeasons),
    titleOverrides: overrides,
  }
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
    customTitles: Array.isArray(o.customTitles) ? (o.customTitles as Title[]) : [],
    customSeasons: Array.isArray(o.customSeasons) ? (o.customSeasons as Season[]) : [],
    titleOverrides: isObject(o.titleOverrides) ? (o.titleOverrides as PrivateData['titleOverrides']) : {},
  }
}

function isObject(v: unknown): v is object {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
