/**
 * Checks TMDB for Marvel movies and shows missing from the catalog, and fills in TMDB ids, runtimes,
 * synopses, and posters (once a title is out). Run monthly by .github/workflows/tmdb.yml, which opens
 * a pull request with the result.
 *
 *   npm run check:tmdb [-- --summary <file>]
 *
 * Needs TMDB_TOKEN (TMDB's "API Read Access Token"), from the environment or git-ignored .env.local.
 * Writes  src/data/catalog.json and public/posters/ when anything changed, and the pull request's
 *         description to --summary.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Catalog, Title } from '../src/lib/types.ts'
import { assignIds, pickSearchResult, planUpdates, summarize, type Change, type IgnoreList, type TmdbItem, type TmdbSearchResult } from './tmdb-lib.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CATALOG = resolve(root, 'src/data/catalog.json')

/** Studios whose movies and shows are worth proposing. "Marvel Entertainment" catches Sony's and Fox's. */
const COMPANIES = ['Marvel Studios', 'Marvel Studios Animation', 'Marvel Television', 'Marvel Animation', 'Marvel Entertainment']
/** Documentaries, news, reality and talk shows: behind-the-scenes specials, not things to watch through. */
const SKIP_GENRES = { movie: '99', tv: '99|10763|10764|10767' }
/** New titles from this far back; older ones are already in the catalog. */
const LOOKBACK_DAYS = 365
/** Poster width: sharp at the size the app shows it on a 3x phone screen, about 40 KB each. */
const POSTER_SIZE = 'w342'
/** Requests at a time, well under TMDB's rate limit. */
const CONCURRENCY = 8

if (!process.env.TMDB_TOKEN && existsSync(resolve(root, '.env.local'))) process.loadEnvFile(resolve(root, '.env.local'))
const token = process.env.TMDB_TOKEN
if (!token) {
  console.error('TMDB_TOKEN is not set. Put TMDB_TOKEN=<API Read Access Token> in .env.local, or set it in the environment.')
  process.exit(1)
}

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = `https://api.themoviedb.org/3${path}?${new URLSearchParams(params)}`
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
    if (res.ok) return (await res.json()) as T
    if (res.status === 401) throw new Error('TMDB rejected the token. Use the "API Read Access Token" from themoviedb.org/settings/api.')
    if (res.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, Number(res.headers.get('retry-after') ?? 2) * 1000))
      continue
    }
    throw new Error(`TMDB ${path}: ${res.status} ${await res.text()}`)
  }
}

/** Runs fn over every item, a few at a time. */
async function mapLimited<T, R>(list: T[], fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(list.length)
  let next = 0
  const worker = async () => {
    while (next < list.length) {
      const i = next++
      out[i] = await fn(list[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker))
  return out
}

interface Page<T> {
  results: T[]
  total_pages: number
}
interface Company {
  id: number
  name: string
}
interface MovieDetails {
  id: number
  title: string
  release_date?: string
  runtime?: number | null
  overview?: string
  poster_path?: string | null
  production_companies: Company[]
  release_dates: { results: { iso_3166_1: string; release_dates: { release_date: string; type: number }[] }[] }
}
interface SeasonDetails {
  season_number: number
  episode_count?: number
  air_date?: string | null
  episodes?: { runtime?: number | null; air_date?: string | null }[]
}
interface TvDetails {
  id: number
  name: string
  first_air_date?: string
  overview?: string
  poster_path?: string | null
  production_companies: Company[]
  seasons: SeasonDetails[]
  [appended: `season/${number}`]: SeasonDetails | undefined
}

const dateOrNull = (d?: string | null) => (d ? d : null)
const isoDay = (d: Date) => d.toISOString().slice(0, 10)

async function allPages<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; page <= 10; page++) {
    const res = await tmdb<Page<T>>(path, { ...params, page: String(page) })
    out.push(...res.results)
    if (page >= res.total_pages) break
  }
  return out
}

/**
 * TMDB's own release date is the earliest anywhere, often an overseas opening days before the US.
 * Use the first US theatrical release, else digital, else TV; premieres and festival showings don't count.
 */
function usRelease(m: MovieDetails): string | null {
  const us = m.release_dates.results.find((r) => r.iso_3166_1 === 'US')?.release_dates ?? []
  for (const type of [3, 2, 4, 6]) {
    const dates = us.filter((d) => d.type === type).map((d) => d.release_date.slice(0, 10)).sort()
    if (dates.length) return dates[0]
  }
  return dateOrNull(m.release_date)
}

async function movie(id: number): Promise<TmdbItem> {
  const m = await tmdb<MovieDetails>(`/movie/${id}`, { append_to_response: 'release_dates' })
  return {
    kind: 'movie',
    id,
    name: m.title,
    date: usRelease(m),
    companies: m.production_companies.map((c) => c.name),
    runtime: m.runtime || null,
    overview: m.overview || null,
    posterPath: m.poster_path || null,
  }
}

/** A season's total minutes, once it has finished airing and every episode's length is listed. */
function seasonRuntime(s: SeasonDetails | undefined, today: string): number | null {
  const eps = s?.episodes ?? []
  if (!eps.length || eps.length !== s?.episode_count) return null
  if (eps.some((e) => !e.runtime || !e.air_date || e.air_date > today)) return null
  return eps.reduce((sum, e) => sum + e.runtime!, 0)
}

async function show(id: number, today: string): Promise<TmdbItem> {
  const t = await tmdb<TvDetails>(`/tv/${id}`)
  // Episode lengths come with each season; TMDB appends up to 20 to one request.
  const numbers = t.seasons.map((s) => s.season_number).filter((n) => n > 0)
  const withEpisodes: Partial<TvDetails> = {}
  for (let i = 0; i < numbers.length; i += 20) {
    Object.assign(withEpisodes, await tmdb<TvDetails>(`/tv/${id}`, { append_to_response: numbers.slice(i, i + 20).map((n) => `season/${n}`).join(',') }))
  }
  return {
    kind: 'tv',
    id,
    name: t.name,
    date: dateOrNull(t.first_air_date),
    companies: t.production_companies.map((c) => c.name),
    overview: t.overview || null,
    posterPath: t.poster_path || null,
    seasons: t.seasons.map((s) => ({
      number: s.season_number,
      episodeCount: s.episode_count ?? null,
      airDate: dateOrNull(s.air_date),
      runtime: seasonRuntime(withEpisodes[`season/${s.season_number}`], today),
    })),
  }
}

/** Looks a catalog title up by name and year: movies and specials as movies first, shows and specials as shows. */
async function searchFor(title: Title): Promise<{ titleId: string; tmdbType: 'movie' | 'tv'; tmdbId: number } | null> {
  const y = title.releaseDate?.slice(0, 4)
  const kinds: ('movie' | 'tv')[] = title.type === 'movie' ? ['movie'] : title.type === 'series' ? ['tv'] : ['movie', 'tv']
  for (const kind of kinds) {
    const params: Record<string, string> = { query: title.title }
    if (y) params[kind === 'movie' ? 'primary_release_year' : 'first_air_date_year'] = y
    let res = await tmdb<Page<{ id: number; title?: string; name?: string; release_date?: string; first_air_date?: string }>>(`/search/${kind}`, params)
    // Release years differ by a year now and then (festival premieres, late US releases).
    if (!res.results.length && y) res = await tmdb(`/search/${kind}`, { query: title.title })
    const results: TmdbSearchResult[] = res.results.map((r) => ({ id: r.id, name: r.title ?? r.name ?? '', date: dateOrNull(r.release_date ?? r.first_air_date) }))
    const id = pickSearchResult(title, results)
    if (id) return { titleId: title.id, tmdbType: kind, tmdbId: id }
  }
  return null
}

const describe = (c: Change) => {
  switch (c.kind) {
    case 'title':
      return `new: ${c.title.title}`
    case 'season':
      return `new: ${c.title.title} ${c.season.label}`
    case 'update':
      return `${c.what}: ${c.from} → ${c.to}`
    case 'id':
      return `matched: ${c.title.title} → ${c.tmdbType}/${c.tmdbId}`
    case 'details':
      return `${c.what}: ${c.title.title}`
    case 'poster':
      return `poster: ${c.title.title}`
  }
}

const original = JSON.parse(readFileSync(CATALOG, 'utf8')) as Catalog
const { _comment, ...ignore } = JSON.parse(readFileSync(resolve(root, 'scripts/tmdb-ignore.json'), 'utf8')) as IgnoreList & { _comment?: string }
const now = new Date()
const today = isoDay(now)
const since = isoDay(new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000))

// 1. Catalog titles without a TMDB id: find them by name and year.
const missing = original.titles.filter((t) => !t.tmdbId)
const found = (await mapLimited(missing, searchFor)).filter((f) => f !== null)
const { catalog, changes: idChanges } = assignIds(original, found)
const unmatched = catalog.titles.filter((t) => !t.tmdbId)
console.log(`Matched ${found.length} of ${missing.length} titles without a TMDB id`)

// 2. New releases from Marvel's studios.
const companyIds: number[] = []
for (const name of COMPANIES) {
  const res = await tmdb<Page<Company>>('/search/company', { query: name })
  const exact = res.results.filter((c) => c.name.toLowerCase() === name.toLowerCase())
  if (!exact.length) console.warn(`warning: no TMDB company named "${name}"`)
  companyIds.push(...exact.map((c) => c.id))
}
const withCompanies = companyIds.join('|')
const newMovies = await allPages<{ id: number }>('/discover/movie', {
  with_companies: withCompanies,
  'primary_release_date.gte': since,
  'primary_release_date.lte': today,
  without_genres: SKIP_GENRES.movie,
  sort_by: 'primary_release_date.asc',
})
const newShows = await allPages<{ id: number }>('/discover/tv', {
  with_companies: withCompanies,
  'first_air_date.gte': since,
  'first_air_date.lte': today,
  without_genres: SKIP_GENRES.tv,
  sort_by: 'first_air_date.asc',
})

// 3. Details for everything: catalog titles (runtimes, synopses, new seasons, dates) and the new releases.
const ignored = (kind: 'movie' | 'tv', id: number) => ignore[kind].includes(id)
const movieIds = new Set([...catalog.titles.filter((t) => t.tmdbType === 'movie').map((t) => t.tmdbId!), ...newMovies.map((m) => m.id)])
const showIds = new Set([...catalog.titles.filter((t) => t.tmdbType === 'tv').map((t) => t.tmdbId!), ...newShows.map((s) => s.id)])
const items: TmdbItem[] = [
  ...(await mapLimited([...movieIds].filter((id) => !ignored('movie', id)), movie)),
  ...(await mapLimited([...showIds].filter((id) => !ignored('tv', id)), (id) => show(id, today))),
]
console.log(`TMDB: ${newMovies.length} movies and ${newShows.length} shows since ${since}; details for ${items.length} titles`)

const planned = planUpdates(catalog, items, ignore, today)
let next = planned.catalog

// 4. Posters for titles newly out. One that fails to download is left for next month.
const failed = new Set<string>()
mkdirSync(resolve(root, 'public/posters'), { recursive: true })
await mapLimited(
  planned.changes.filter((c) => c.kind === 'poster'),
  async ({ title, remote }) => {
    const res = await fetch(`https://image.tmdb.org/t/p/${POSTER_SIZE}${remote}`)
    if (!res.ok || !res.headers.get('content-type')?.startsWith('image/jpeg')) {
      console.warn(`warning: no poster for ${title.title} (${res.status})`)
      failed.add(title.id)
      return
    }
    writeFileSync(resolve(root, 'public', title.posterPath!), Buffer.from(await res.arrayBuffer()))
  },
)
if (failed.size) next = { ...next, titles: next.titles.map((t) => (failed.has(t.id) ? { ...t, posterPath: null } : t)) }
const updates = planned.changes.filter((c) => !(c.kind === 'poster' && failed.has(c.title.id)))
const changes = [...idChanges, ...updates]
if (!changes.length) {
  console.log('Catalog is up to date.')
} else {
  writeFileSync(CATALOG, JSON.stringify({ ...next, generatedAt: now.toISOString() }, null, 2) + '\n')
  for (const c of changes) console.log(`- ${describe(c)}`)
}
if (unmatched.length) console.log(`Not found on TMDB: ${unmatched.map((t) => t.title).join(', ')}`)
const summaryAt = process.argv.indexOf('--summary')
if (summaryAt !== -1 && process.argv[summaryAt + 1]) writeFileSync(process.argv[summaryAt + 1], summarize(changes, unmatched))
