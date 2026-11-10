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
  seasons?: TmdbSeason[]
}

export interface TmdbSeason {
  number: number
  episodeCount: number | null
  airDate: string | null
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

/** "VisionQuest" and "Vision Quest", "Thunderbolts*" and "Thunderbolts" are the same title. */
export const normalizeName = (name: string) => name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')

const year = (date: string | null) => (date ? Number(date.slice(0, 4)) : null)

/**
 * The catalog title TMDB's item refers to, if any: the one with its TMDB id (so a renamed
 * "Untitled X-Men Film" still matches), else the same name, a compatible type, and released within a year.
 */
export function findTitle(titles: Title[], item: TmdbItem): Title | undefined {
  const name = normalizeName(item.name)
  const types = item.kind === 'movie' ? ['movie', 'special'] : ['series', 'special']
  const byId = titles.find((t) => t.tmdbId === item.id && types.includes(t.type))
  if (byId) return byId
  return titles.find((t) => {
    if (normalizeName(t.title) !== name || !types.includes(t.type)) return false
    const [a, b] = [year(t.releaseDate), year(item.date)]
    return a === null || b === null || Math.abs(a - b) <= 1
  })
}

/** Not out yet (or undated), so TMDB's date may be newer news than ours. */
const unreleased = (date: PartialDate | null, today: string) => date === null || date > today

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
  }
}

/**
 * Compares what TMDB knows with the catalog: titles missing from it, seasons missing from shows,
 * and dates or episode counts for things not out yet. Released titles are left alone, so the
 * catalog's own facts win once something is out. Returns the updated catalog and what changed.
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
      title = { id, title: item.name, type: item.kind === 'movie' ? 'movie' : 'series', releaseDate: item.date, tmdbId: item.id, posterPath: null, ...meta }
      titles.push(title)
      changes.push({ kind: 'title', item, title, guessed })
    } else if (unreleased(title.releaseDate, today)) {
      // Not out yet: take TMDB's newer name and date. The id stays, since watches point at it.
      const i = titles.indexOf(title)
      const next = { ...title, tmdbId: item.id }
      if (normalizeName(item.name) !== normalizeName(title.title)) {
        changes.push({ kind: 'update', item, what: `${title.title}: title`, from: title.title, to: item.name })
        next.title = item.name
      }
      if (item.date && item.date !== title.releaseDate) {
        changes.push({ kind: 'update', item, what: `${title.title}: release date`, from: title.releaseDate ?? 'TBA', to: item.date })
        next.releaseDate = item.date
      }
      title = titles[i] = next
    }

    if (title.type !== 'series') continue
    for (const s of item.seasons ?? []) {
      if (s.number < 1) continue
      const i = seasons.findIndex((x) => x.titleId === title.id && x.number === s.number)
      if (i === -1) {
        const season = makeSeason(title, s, titles, today)
        seasons.push(season)
        changes.push({ kind: 'season', item, title, season })
        continue
      }
      const old = seasons[i]
      if (!unreleased(old.premiereDate, today)) continue
      const label = `${title.title} ${old.label}`
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

const link = (item: TmdbItem) => `[TMDB](https://www.themoviedb.org/${item.kind}/${item.id})`

/** The pull request's description. */
export function summarize(changes: Change[]): string {
  const titles = changes.filter((c) => c.kind === 'title')
  const seasons = changes.filter((c) => c.kind === 'season')
  const updates = changes.filter((c) => c.kind === 'update')
  const lines = ['Monthly check of TMDB for Marvel movies and shows released in the past year or coming up.', '']
  if (titles.length) {
    lines.push('### New titles', '')
    for (const { item, title, guessed } of titles) {
      const where = title.universe === 'mcu' ? `MCU, ${title.saga}, phase ${title.phase ?? '?'}` : `Other Marvel, ${title.saga}`
      lines.push(`- **${title.title}** (${title.type}, ${title.releaseDate ?? 'TBA'}) · ${where} · ${link(item)}  \n  Guessed: ${guessed.join(', ')}`)
    }
    lines.push('')
  }
  if (seasons.length) {
    lines.push('### New seasons', '')
    for (const { item, title, season } of seasons)
      lines.push(`- **${title.title}** ${season.label}: ${season.premiereDate ?? 'TBA'}, ${season.episodeCount ?? '?'} episodes · ${link(item)}`)
    lines.push('')
  }
  if (updates.length) {
    lines.push('### Updated dates and episode counts', '')
    for (const { item, what, from, to } of updates) lines.push(`- ${what}: ${from} → ${to} · ${link(item)}`)
    lines.push('')
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
