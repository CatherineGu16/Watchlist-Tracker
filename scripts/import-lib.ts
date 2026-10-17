import { csvRecords } from '../src/lib/csv.ts'
import { comparePartialDates, parseUsDate, parseWatchCell, type WatchSpan } from '../src/lib/partialDate.ts'
import type { Catalog, Collection, PartialDate, PrivateData, Season, Title, TitleType, Watch } from '../src/lib/types.ts'
import {
  EXTRA_SEASONS,
  EXTRA_TITLES,
  COLLECTION_BY_SAGA,
  LEGACY_MARVEL_TV,
  NETFLIX_DEFENDERS,
  MCU_CHRONO_ORDER,
  MCU_PHASE,
  SAGA_NAMES,
  SEASON_CORRECTIONS,
  SEASON_PHASE,
  STUDIO_BY_SAGA,
  type ExtraSeason,
} from './catalog-meta.ts'

/**
 * Season rows to import differently from the sheet, keyed by show then season number.
 * "checked" imports the row's dates as a finished watch; spans replace the row's dates.
 * Personal, so the real list lives in git-ignored data/source/watch-overrides.json.
 */
export type WatchOverrides = Record<string, Record<number, 'checked' | WatchSpan[]>>

const TYPE_BY_SHEET: Record<string, TitleType> = { Movie: 'movie', 'TV Series': 'series', Special: 'special' }

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function titleId(title: string, releaseDate: PartialDate | null): string {
  return `${slugify(title)}-${releaseDate?.slice(0, 4) ?? 'tba'}`
}

export interface ImportResult {
  catalog: Catalog
  privateData: PrivateData
  warnings: string[]
}

export interface ImportOptions {
  /** Fail when story order or extra seasons name a title that isn't in the data. Off for test fixtures. */
  strict?: boolean
  overrides?: WatchOverrides
}

export function buildFromSheet(mainCsv: string, seriesCsv: string, now: Date, { strict = true, overrides = {} }: ImportOptions = {}): ImportResult {
  const stamp = now.toISOString()
  const warnings: string[] = []
  const titles: Title[] = []
  const seasons: Season[] = []
  const watches: Watch[] = []

  const makeWatch = (t: Title, seasonId: string | null, span: WatchSpan, n: number): Watch => ({
    id: `${seasonId ?? t.id}--w${n}`,
    titleId: t.id,
    seasonId,
    startDate: span.start,
    endDate: span.end,
    approximate: span.approximate,
    episodesWatched: null,
    note: '',
    createdAt: stamp,
    updatedAt: stamp,
  })

  // Main List: header is on the third row (title + blank row above it).
  const mainRows = csvRecords(mainCsv, 2)
  const byName = new Map<string, Title>()

  for (const row of mainRows) {
    const name = row['Title']
    const type = TYPE_BY_SHEET[row['Type']]
    if (!type) throw new Error(`Unknown type "${row['Type']}" for ${name}`)
    const saga = SAGA_NAMES[row['Phase']]
    if (!saga) throw new Error(`Unknown saga "${row['Phase']}" for ${name}`)
    const releaseDate = parseUsDate(row['Release Date'])
    const collection: Collection = NETFLIX_DEFENDERS.has(name)
      ? 'netflix'
      : LEGACY_MARVEL_TV.has(name)
        ? 'marvel-tv'
        : (COLLECTION_BY_SAGA[saga] ?? 'marvel-studios')
    const universe = collection === 'marvel-studios' || collection === 'netflix' ? 'mcu' : 'other'

    const title: Title = {
      id: titleId(name, releaseDate),
      title: name,
      type,
      releaseDate,
      universe,
      collection,
      saga,
      phase: universe === 'mcu' ? (MCU_PHASE[name] ?? null) : null,
      chronoIndex: null,
      studio: STUDIO_BY_SAGA[saga] ?? (collection === 'marvel-studios' ? 'Marvel Studios' : 'Marvel Television'),
      tmdbId: null,
      posterPath: null,
    }
    titles.push(title)
    byName.set(name, title)

    // Series watches come from the Series Tracker tab.
    if (type === 'series') continue
    const watched = row['Watched'] === 'TRUE'
    const spans = [...parseWatchCell(row['First Watch']), ...parseWatchCell(row['Additional Watches'])]
    if (!watched) {
      if (spans.length) warnings.push(`${name}: unchecked but has watch dates; dates skipped`)
      continue
    }
    const list = spans.length ? spans : [{ start: null, end: null, approximate: false }]
    list.forEach((span, i) => {
      // A movie is watched in one sitting.
      const one = { ...span, start: span.start ?? span.end }
      watches.push(makeWatch(title, null, one, i + 1))
    })
  }

  // Series Tracker
  for (const row of csvRecords(seriesCsv, 0)) {
    const show = row['Show']
    const title = byName.get(show)
    if (!title || title.type !== 'series') throw new Error(`Season row for unknown series "${show}"`)
    const number = Number(row['Season'].match(/Season (\d+)/)?.[1])
    if (!number) throw new Error(`Bad season label "${row['Season']}" for ${show}`)

    const correction = SEASON_CORRECTIONS[show]?.[number]
    const season: Season = {
      id: `${title.id}-s${number}`,
      titleId: title.id,
      number,
      label: row['Season'],
      episodeCount: /^\d+$/.test(row['Episodes']) ? Number(row['Episodes']) : null,
      premiereDate: correction?.premiereDate ?? parseUsDate(row['Premiere / Notes']),
      phase: seasonPhase(title, number),
      ...(correction?.note ? { note: correction.note } : {}),
    }
    seasons.push(season)

    const override = overrides[show]?.[number]
    const rowSpans = [...parseWatchCell(row['Completion Date']), ...parseWatchCell(row['Additional watches'])]
    let spans: WatchSpan[]
    if (Array.isArray(override)) spans = override
    else if (row['Watched'] === 'TRUE' || override === 'checked')
      spans = rowSpans.length ? rowSpans : [{ start: null, end: null, approximate: false }]
    else {
      if (rowSpans.length) warnings.push(`${show} ${row['Season']}: unchecked but has watch dates; dates skipped`)
      spans = []
    }
    spans.forEach((span, i) => watches.push(makeWatch(title, season.id, span, i + 1)))
  }

  // Extras: seasons for sheet shows, then titles missing from the sheet.
  for (const [show, extra] of Object.entries(EXTRA_SEASONS)) {
    const title = byName.get(show)
    if (!title) {
      if (strict) throw new Error(`Extra seasons for unknown show "${show}"`)
      continue
    }
    const start = Math.max(...seasons.filter((s) => s.titleId === title.id).map((s) => s.number))
    extra.forEach((s, i) => seasons.push(makeSeason(title, start + i + 1, s)))
  }
  for (const extra of EXTRA_TITLES) {
    const title: Title = {
      id: titleId(extra.title, extra.releaseDate),
      title: extra.title,
      type: extra.type,
      releaseDate: extra.releaseDate,
      universe: extra.universe,
      collection: extra.collection,
      saga: extra.saga,
      phase: extra.phase ?? null,
      chronoIndex: null,
      studio: extra.studio,
      tmdbId: null,
      posterPath: null,
      ...(extra.note ? { note: extra.note } : {}),
    }
    titles.push(title)
    extra.seasons?.forEach((s, i) => seasons.push(makeSeason(title, i + 1, s)))
  }

  // Story order for MCU titles.
  MCU_CHRONO_ORDER.forEach((name, i) => {
    const title = titles.find((t) => t.title === name && t.universe === 'mcu')
    if (title) title.chronoIndex = i + 1
    else if (strict) throw new Error(`Story order lists unknown MCU title "${name}"`)
  })

  validate(titles, seasons, mainRows, warnings)

  titles.sort((a, b) => comparePartialDates(a.releaseDate ?? '9999', b.releaseDate ?? '9999') || a.title.localeCompare(b.title))
  seasons.sort((a, b) => a.titleId.localeCompare(b.titleId) || a.number - b.number)

  return {
    catalog: { schemaVersion: 1, generatedAt: stamp, titles, seasons },
    privateData: { schemaVersion: 1, updatedAt: stamp, watches, customTitles: [], customSeasons: [], titleOverrides: {} },
    warnings,
  }
}

function seasonPhase(title: Title, number: number): number | null {
  if (title.universe !== 'mcu') return null
  return SEASON_PHASE[title.title]?.[number] ?? title.phase
}

function makeSeason(title: Title, number: number, s: ExtraSeason): Season {
  return {
    id: `${title.id}-s${number}`,
    titleId: title.id,
    number,
    label: s.label ?? `Season ${number}`,
    episodeCount: s.episodeCount,
    premiereDate: s.premiereDate,
    phase: seasonPhase(title, number),
  }
}

function validate(titles: Title[], seasons: Season[], mainRows: Record<string, string>[], warnings: string[]) {
  const ids = new Set<string>()
  for (const t of [...titles, ...seasons]) {
    if (ids.has(t.id)) throw new Error(`Duplicate id ${t.id}`)
    ids.add(t.id)
  }
  for (const t of titles) {
    if (t.universe === 'mcu' && t.phase === null && t.collection !== 'netflix') warnings.push(`${t.title}: MCU title without a phase`)
    if (t.universe === 'mcu' && t.chronoIndex === null) warnings.push(`${t.title}: MCU title missing from story order`)
    if (t.type === 'series' && !seasons.some((s) => s.titleId === t.id)) throw new Error(`${t.title}: series with no seasons`)
  }
  // Cross-check the Main List's "N seasons" summary against the Series Tracker rows.
  for (const row of mainRows) {
    const count = row['Seasons/Episodes'].match(/^(\d+) seasons?/)?.[1]
    if (!count) continue
    const title = titles.find((t) => t.title === row['Title'] && t.type === 'series')
    const have = seasons.filter((s) => s.titleId === title?.id && s.premiereDate !== null).length
    if (Number(count) !== have) warnings.push(`${row['Title']}: Main List says ${count} seasons, Series Tracker has ${have} dated`)
  }
}
