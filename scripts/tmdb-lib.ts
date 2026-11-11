import type { Catalog, Collection, PartialDate, Season, Title, Universe } from '../src/lib/types.ts'
import { titleId } from './import-lib.ts'

/** A movie or show as TMDB describes it, trimmed to what the catalog needs. */
export interface TmdbItem {
  kind: 'movie' | 'tv'
  id: number
  name: string
  /** Release date (movies) or first air date (shows), YYYY-MM-DD. */
  date: string | null
  companies: string[]
  /** Minutes, movies only. */
  runtime?: number | null
  overview?: string | null
  /** TMDB's main poster, e.g. "/abc123.jpg". */
  posterPath?: string | null
  seasons?: TmdbSeason[]
}

export interface TmdbSeason {
  number: number
  episodeCount: number | null
  airDate: string | null
  /** Minutes for the whole season, when every episode's length is known. */
  runtime?: number | null
}

/** A search result: enough to tell whether it's the title we mean. */
export interface TmdbSearchResult {
  id: number
  name: string
  date: string | null
}

/** TMDB ids never to propose again, kept in scripts/tmdb-ignore.json. */
export interface IgnoreList {
  movie: number[]
  tv: number[]
}

export type Change =
  | { kind: 'title'; item: TmdbItem; title: Title; guessed: string[] }
  | { kind: 'season'; item: TmdbItem; title: Title; season: Season }
  | { kind: 'update'; item: TmdbItem; what: string; from: string; to: string }
  | { kind: 'id'; title: Title; tmdbType: 'movie' | 'tv'; tmdbId: number }
  | { kind: 'details'; title: Title; what: 'runtime' | 'synopsis' | 'season runtime' }
  /** A poster to download from TMDB's `remote` path to the catalog's `posterPath` under public/. */
  | { kind: 'poster'; title: Title; remote: string }

/** "VisionQuest" and "Vision Quest", "Thunderbolts*" and "Thunderbolts" are the same title. */
export const normalizeName = (name: string) => name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')

const year = (date: string | null) => (date ? Number(date.slice(0, 4)) : null)
const nearYear = (a: string | null, b: string | null, slack = 1) => {
  const [x, y] = [year(a), year(b)]
  return x === null || y === null || Math.abs(x - y) <= slack
}

const typesFor = (kind: TmdbItem['kind']) => (kind === 'movie' ? ['movie', 'special'] : ['series', 'special'])

/**
 * The catalog title TMDB's item refers to, if any: the one with its TMDB id (so a renamed
 * "Untitled X-Men Film" still matches), else the same name, a compatible type, and released within a year.
 */
export function findTitle(titles: Title[], item: TmdbItem): Title | undefined {
  const types = typesFor(item.kind)
  const byId = titles.find((t) => t.tmdbId === item.id && (t.tmdbType ? t.tmdbType === item.kind : types.includes(t.type)))
  if (byId) return byId
  const name = normalizeName(item.name)
  return titles.find((t) => !t.tmdbId && normalizeName(t.title) === name && types.includes(t.type) && nearYear(t.releaseDate, item.date))
}

/**
 * Which search result is the catalog title: the same name released within a year, else the only
 * result from the same year whose name contains the other ("Thor" in "Thor: The Dark World" doesn't count
 * when both are in the results). Null when unsure, so a person can fill it in.
 */
export function pickSearchResult(title: Title, results: TmdbSearchResult[]): number | null {
  const name = normalizeName(title.title)
  const exact = results.find((r) => normalizeName(r.name) === name && nearYear(title.releaseDate, r.date))
  if (exact) return exact.id
  const close = results.filter((r) => {
    const other = normalizeName(r.name)
    return nearYear(title.releaseDate, r.date, 0) && year(title.releaseDate) !== null && (other.includes(name) || name.includes(other))
  })
  return close.length === 1 ? close[0].id : null
}

/** Records the TMDB ids found for catalog titles that had none. */
export function assignIds(catalog: Catalog, found: { titleId: string; tmdbType: 'movie' | 'tv'; tmdbId: number }[]): { catalog: Catalog; changes: Change[] } {
  const changes: Change[] = []
  const titles = catalog.titles.map((t) => {
    const f = found.find((x) => x.titleId === t.id)
    if (!f || t.tmdbId) return t
    const next = { ...t, tmdbId: f.tmdbId, tmdbType: f.tmdbType }
    changes.push({ kind: 'id', title: next, tmdbType: f.tmdbType, tmdbId: f.tmdbId })
    return next
  })
  return { catalog: { ...catalog, titles }, changes }
}

/** Not out yet (or undated), so TMDB's date may be newer news than ours. */
const unreleased = (date: PartialDate | null, today: string) => date === null || date > today

/** Where a title's poster lives under public/. */
export const posterFile = (titleId: string) => `posters/${titleId}.jpg`

/**
 * Studios swap posters until release (teasers, then the final one), so a poster is fetched once,
 * at the first check after release, and kept from then on.
 */
function withPoster(title: Title, item: TmdbItem, today: string, changes: Change[]): Title {
  if (title.posterPath || !item.posterPath || unreleased(title.releaseDate, today)) return title
  const next = { ...title, posterPath: posterFile(title.id) }
  changes.push({ kind: 'poster', title: next, remote: item.posterPath })
  return next
}

/**
 * Where a new title belongs, from the companies that made it. MCU titles take their saga and phase
 * from the MCU title released most recently before them, and go to the end of story order.
 * Everything here is a guess for the pull request's reviewer to check.
 */
export function classify(item: TmdbItem, titles: Title[]): Omit<Title, 'id' | 'title' | 'type' | 'releaseDate' | 'tmdbId' | 'posterPath'> & { guessed: string[] } {
  const has = (name: string) => item.companies.some((c) => c.toLowerCase().includes(name.toLowerCase()))
  if (has('Marvel Studios')) {
    const mcu = titles.filter((t) => t.universe === 'mcu' && t.releaseDate)
    const before = mcu.filter((t) => !item.date || t.releaseDate! <= item.date)
    const latest = (before.length ? before : mcu).reduce<Title | undefined>((a, t) => (!a || t.releaseDate! > a.releaseDate! ? t : a), undefined)
    const chrono = Math.max(0, ...titles.map((t) => t.chronoIndex ?? 0)) + 1
    return {
      universe: 'mcu',
      collection: 'marvel-studios',
      saga: latest?.saga ?? 'Multiverse Saga',
      phase: latest?.phase ?? null,
      chronoIndex: chrono,
      studio: has('Marvel Studios Animation') ? 'Marvel Studios Animation' : 'Marvel Studios',
      guessed: ['MCU', 'saga', 'phase', 'story order (placed last)'],
    }
  }
  const other = (collection: Collection, saga: string, studio: string) => ({
    universe: 'other' as Universe,
    collection,
    saga,
    phase: null,
    chronoIndex: null,
    studio,
    guessed: ['Other Marvel', 'group'],
  })
  if (has('Sony')) return other('sony-spider-man', 'Spider-Man', has('Sony Pictures Animation') ? 'Sony Pictures Animation' : 'Sony Pictures')
  if (has('20th Century')) return other('fox-xmen', 'X-Men', '20th Century Studios')
  return other('classic', 'Classic Marvel', item.companies.find((c) => !/^Marvel Entertainment$/i.test(c)) ?? item.companies[0] ?? 'Marvel')
}

/** TMDB counts only the episodes listed so far, so a count is trusted once the season has started. */
const episodesOf = (s: TmdbSeason, today: string) => (s.airDate && s.airDate <= today && s.episodeCount) || null

function makeSeason(title: Title, s: TmdbSeason, titles: Title[], today: string): Season {
  // A season of an MCU show belongs to the phase running when it premieres.
  const phase =
    title.universe === 'mcu' && s.airDate ? (classify({ kind: 'tv', id: 0, name: '', date: s.airDate, companies: ['Marvel Studios'] }, titles).phase ?? title.phase) : title.phase
  return {
    id: `${title.id}-s${s.number}`,
    titleId: title.id,
    number: s.number,
    label: `Season ${s.number}`,
    episodeCount: episodesOf(s, today),
    premiereDate: s.airDate,
    phase,
    runtime: s.runtime || null,
  }
}

/**
 * Fills a title's runtime and synopsis: missing ones always, and for titles not out yet, newer ones
 * too. Once something is out its details stay as they are.
 */
function withDetails(title: Title, item: TmdbItem, today: string, changes: Change[]): Title {
  const next = { ...title }
  const fresh = unreleased(title.releaseDate, today)
  if (item.overview && (!title.overview || (fresh && item.overview !== title.overview))) {
    next.overview = item.overview
    changes.push({ kind: 'details', title, what: 'synopsis' })
  }
  if (title.type !== 'series' && item.runtime && (!title.runtime || (fresh && item.runtime !== title.runtime))) {
    next.runtime = item.runtime
    changes.push({ kind: 'details', title, what: 'runtime' })
  }
  return next
}

/**
 * Compares what TMDB knows with the catalog: titles missing from it, seasons added after the ones
 * it has, dates or episode counts for things not out yet, and missing runtimes and synopses.
 * Released titles' dates are left alone, so the catalog's own facts win once something is out.
 * Returns the updated catalog and what changed.
 */
export function planUpdates(catalog: Catalog, items: TmdbItem[], ignore: IgnoreList, today: string): { catalog: Catalog; changes: Change[] } {
  const titles = [...catalog.titles]
  const seasons = [...catalog.seasons]
  const changes: Change[] = []
  const seen = new Set<string>()

  for (const item of items) {
    const key = `${item.kind}:${item.id}`
    if (seen.has(key) || ignore[item.kind].includes(item.id)) continue
    seen.add(key)

    let title = findTitle(titles, item)
    if (!title) {
      const { guessed, ...meta } = classify(item, titles)
      let id = titleId(item.name, item.date)
      for (let n = 2; titles.some((t) => t.id === id); n++) id = `${titleId(item.name, item.date)}-${n}`
      title = {
        id,
        title: item.name,
        type: item.kind === 'movie' ? 'movie' : 'series',
        releaseDate: item.date,
        tmdbId: item.id,
        tmdbType: item.kind,
        posterPath: null,
        ...meta,
        ...(item.kind === 'movie' && item.runtime ? { runtime: item.runtime } : {}),
        ...(item.overview ? { overview: item.overview } : {}),
      }
      changes.push({ kind: 'title', item, title, guessed })
      title = withPoster(title, item, today, changes)
      titles.push(title)
    } else {
      const i = titles.indexOf(title)
      const next = withDetails({ ...title, tmdbId: item.id, tmdbType: item.kind }, item, today, changes)
      if (unreleased(title.releaseDate, today)) {
        // Not out yet: take TMDB's newer name and date. The id stays, since watches point at it.
        if (normalizeName(item.name) !== normalizeName(title.title)) {
          changes.push({ kind: 'update', item, what: `${title.title}: title`, from: title.title, to: item.name })
          next.title = item.name
        }
        if (item.date && item.date !== title.releaseDate) {
          changes.push({ kind: 'update', item, what: `${title.title}: release date`, from: title.releaseDate ?? 'TBA', to: item.date })
          next.releaseDate = item.date
        }
      }
      title = titles[i] = withPoster(next, item, today, changes)
    }

    if (title.type !== 'series') continue
    // Only seasons after the last one the catalog has: TMDB sometimes splits older shows differently.
    const last = Math.max(0, ...seasons.filter((x) => x.titleId === title.id).map((x) => x.number))
    for (const s of item.seasons ?? []) {
      if (s.number < 1) continue
      const i = seasons.findIndex((x) => x.titleId === title.id && x.number === s.number)
      if (i === -1) {
        if (s.number <= last) continue
        const season = makeSeason(title, s, titles, today)
        seasons.push(season)
        changes.push({ kind: 'season', item, title, season })
        continue
      }
      const old = seasons[i]
      const label = `${title.title} ${old.label}`
      if (s.runtime && !old.runtime) {
        seasons[i] = { ...seasons[i], runtime: s.runtime }
        changes.push({ kind: 'details', title, what: 'season runtime' })
      }
      if (!unreleased(old.premiereDate, today)) continue
      if (s.airDate && s.airDate !== old.premiereDate) {
        changes.push({ kind: 'update', item, what: `${label}: premiere`, from: old.premiereDate ?? 'TBA', to: s.airDate })
        seasons[i] = { ...seasons[i], premiereDate: s.airDate }
      }
      const episodes = episodesOf(s, today)
      if (episodes && episodes !== old.episodeCount) {
        changes.push({ kind: 'update', item, what: `${label}: episodes`, from: String(old.episodeCount ?? 'TBA'), to: String(episodes) })
        seasons[i] = { ...seasons[i], episodeCount: episodes }
      }
    }
  }
  return { catalog: { ...catalog, titles, seasons }, changes }
}

const link = (kind: TmdbItem['kind'], id: number) => `[TMDB](https://www.themoviedb.org/${kind}/${id})`
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** The pull request's description. `unmatched` lists catalog titles TMDB's search couldn't pin down. */
export function summarize(changes: Change[], unmatched: Title[] = []): string {
  const pick = <K extends Change['kind']>(kind: K) => changes.filter((c): c is Extract<Change, { kind: K }> => c.kind === kind)
  const titles = pick('title')
  const seasons = pick('season')
  const updates = pick('update')
  const ids = pick('id')
  const details = pick('details')
  const posters = pick('poster')
  const lines = ['Monthly check of TMDB for Marvel movies and shows released in the past year or coming up.', '']
  if (titles.length) {
    lines.push('### New titles', '')
    for (const { item, title, guessed } of titles) {
      const where = title.universe === 'mcu' ? `MCU, ${title.saga}, phase ${title.phase ?? '?'}` : `Other Marvel, ${title.saga}`
      lines.push(`- **${title.title}** (${title.type}, ${title.releaseDate ?? 'TBA'}) · ${where} · ${link(item.kind, item.id)}  \n  Guessed: ${guessed.join(', ')}`)
    }
    lines.push('')
  }
  if (seasons.length) {
    lines.push('### New seasons', '')
    for (const { item, title, season } of seasons)
      lines.push(`- **${title.title}** ${season.label}: ${season.premiereDate ?? 'TBA'}, ${season.episodeCount ?? '?'} episodes · ${link(item.kind, item.id)}`)
    lines.push('')
  }
  if (updates.length) {
    lines.push('### Updated dates and episode counts', '')
    for (const { item, what, from, to } of updates) lines.push(`- ${what}: ${from} → ${to} · ${link(item.kind, item.id)}`)
    lines.push('')
  }
  if (details.length) {
    const count = (what: string) => new Set(details.filter((d) => d.what === what).map((d) => d.title.id)).size
    const parts = [
      count('runtime') && plural(count('runtime'), 'runtime'),
      count('season runtime') && plural(count('season runtime'), 'season runtime'),
      count('synopsis') && `${count('synopsis')} ${count('synopsis') === 1 ? 'synopsis' : 'synopses'}`,
    ].filter(Boolean)
    lines.push('### Runtimes and synopses', '', `Added or refreshed ${parts.join(', ')}. Spot-check a few in the app before merging.`, '')
  }
  if (posters.length) {
    lines.push(
      '### Posters',
      '',
      `${plural(posters.length, 'poster')} for titles that are out now, kept from now on${posters.length <= 15 ? `: ${posters.map((p) => p.title.title).join(', ')}` : ''}.`,
      '',
    )
  }
  if (ids.length) {
    lines.push(
      '### Matched to TMDB',
      '',
      `${plural(ids.length, 'catalog title')} matched to TMDB by name and year. A wrong match brings in the wrong runtime and synopsis, so check the links; fix one by editing its \`tmdbId\` and \`tmdbType\`.`,
      '',
      '<details><summary>Matches</summary>',
      '',
      ...ids.map(({ title, tmdbType, tmdbId }) => `- ${title.title} (${title.releaseDate?.slice(0, 4) ?? 'TBA'}) · ${link(tmdbType, tmdbId)}`),
      '',
      '</details>',
      '',
    )
  }
  if (unmatched.length) {
    lines.push(
      '### Not found on TMDB',
      '',
      "These have no runtime or synopsis. To add one, find it on themoviedb.org and set its `tmdbId` (the number in the address) and `tmdbType` (`movie` or `tv`) in `src/data/catalog.json`.",
      '',
      ...unmatched.map((t) => `- ${t.title} (${t.releaseDate?.slice(0, 4) ?? 'TBA'}, ${t.type})`),
      '',
    )
  }
  lines.push(
    '### Before merging',
    '',
    '- Check the guessed fields, and fix them in `src/data/catalog.json` on this branch. New MCU titles go to the end of story order (`chronoIndex`).',
    "- Not something you want in the catalog? Remove it from `src/data/catalog.json` and add its TMDB id to `scripts/tmdb-ignore.json`, so it isn't proposed again.",
    "- While this pull request is open, next month's check leaves it alone, so merge or close it before then.",
    '',
    '_This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB._',
  )
  return lines.join('\n') + '\n'
}
