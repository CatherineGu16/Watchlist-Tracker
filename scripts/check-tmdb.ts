/**
 * Checks TMDB for Marvel movies and shows missing from the catalog. Run monthly by
 * .github/workflows/tmdb.yml, which opens a pull request with the result.
 *
 *   npm run check:tmdb [-- --summary <file>]
 *
 * Needs TMDB_TOKEN (TMDB's "API Read Access Token"), from the environment or git-ignored .env.local.
 * Writes  src/data/catalog.json when anything changed, and the pull request's description to --summary.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Catalog, Title } from '../src/lib/types.ts'
import { planUpdates, summarize, type IgnoreList, type TmdbItem } from './tmdb-lib.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CATALOG = resolve(root, 'src/data/catalog.json')

/** Studios whose movies and shows are worth proposing. "Marvel Entertainment" catches Sony's and Fox's. */
const COMPANIES = ['Marvel Studios', 'Marvel Studios Animation', 'Marvel Television', 'Marvel Animation', 'Marvel Entertainment']
/** Documentaries, news, reality and talk shows: behind-the-scenes specials, not things to watch through. */
const SKIP_GENRES = { movie: '99', tv: '99|10763|10764|10767' }
/** New titles from this far back; older ones are already in the catalog. */
const LOOKBACK_DAYS = 365
/** Shows with a season this recent might get another. */
const ONGOING_YEARS = 3

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
  production_companies: Company[]
}
interface TvDetails {
  id: number
  name: string
  first_air_date?: string
  production_companies: Company[]
  seasons: { season_number: number; episode_count?: number; air_date?: string | null }[]
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

async function movie(id: number): Promise<TmdbItem> {
  const m = await tmdb<MovieDetails>(`/movie/${id}`)
  return { kind: 'movie', id, name: m.title, date: dateOrNull(m.release_date), companies: m.production_companies.map((c) => c.name) }
}

async function show(id: number): Promise<TmdbItem> {
  const t = await tmdb<TvDetails>(`/tv/${id}`)
  return {
    kind: 'tv',
    id,
    name: t.name,
    date: dateOrNull(t.first_air_date),
    companies: t.production_companies.map((c) => c.name),
    seasons: t.seasons.map((s) => ({ number: s.season_number, episodeCount: s.episode_count ?? null, airDate: dateOrNull(s.air_date) })),
  }
}

/** TMDB's id for a catalog show, found by name and first-air year. */
async function findShow(title: Title): Promise<number | null> {
  if (title.tmdbId) return title.tmdbId
  const params: Record<string, string> = { query: title.title }
  if (title.releaseDate) params.first_air_date_year = title.releaseDate.slice(0, 4)
  const res = await tmdb<Page<{ id: number; name: string }>>('/search/tv', params)
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  return res.results.find((r) => norm(r.name) === norm(title.title))?.id ?? null
}

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8')) as Catalog
const { _comment, ...ignore } = JSON.parse(readFileSync(resolve(root, 'scripts/tmdb-ignore.json'), 'utf8')) as IgnoreList & { _comment?: string }
const now = new Date()
const today = isoDay(now)
const since = isoDay(new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000))

const companyIds: number[] = []
for (const name of COMPANIES) {
  const res = await tmdb<Page<Company>>('/search/company', { query: name })
  const exact = res.results.filter((c) => c.name.toLowerCase() === name.toLowerCase())
  if (!exact.length) console.warn(`warning: no TMDB company named "${name}"`)
  companyIds.push(...exact.map((c) => c.id))
}
const withCompanies = companyIds.join('|')

const movies = await allPages<{ id: number }>('/discover/movie', {
  with_companies: withCompanies,
  'primary_release_date.gte': since,
  without_genres: SKIP_GENRES.movie,
  sort_by: 'primary_release_date.asc',
})
const shows = await allPages<{ id: number }>('/discover/tv', {
  with_companies: withCompanies,
  'first_air_date.gte': since,
  without_genres: SKIP_GENRES.tv,
  sort_by: 'first_air_date.asc',
})

// Shows already in the catalog that may have new seasons: any with a season in the last few years or still undated.
const recent = String(now.getFullYear() - ONGOING_YEARS)
const ongoing = catalog.titles.filter((t) => {
  if (t.type !== 'series') return false
  const dates = [t.releaseDate, ...catalog.seasons.filter((s) => s.titleId === t.id).map((s) => s.premiereDate)]
  return dates.some((d) => d === null || d >= recent)
})
const ongoingIds = (await Promise.all(ongoing.map(findShow))).filter((id): id is number => id !== null)

const items: TmdbItem[] = [
  ...(await Promise.all(movies.map((m) => movie(m.id)))),
  ...(await Promise.all([...new Set([...shows.map((s) => s.id), ...ongoingIds])].map(show))),
]
console.log(`TMDB: ${movies.length} movies and ${shows.length} new shows since ${since}, ${ongoingIds.length} catalog shows checked for new seasons`)

const { catalog: next, changes } = planUpdates(catalog, items, ignore, today)
const summaryAt = process.argv.indexOf('--summary')
if (!changes.length) {
  console.log('Catalog is up to date.')
} else {
  writeFileSync(CATALOG, JSON.stringify({ ...next, generatedAt: now.toISOString() }, null, 2) + '\n')
  for (const c of changes) console.log(`- ${c.kind === 'update' ? `${c.what}: ${c.from} → ${c.to}` : c.kind === 'title' ? `new: ${c.title.title}` : `new: ${c.title.title} ${c.season.label}`}`)
}
if (summaryAt !== -1 && process.argv[summaryAt + 1]) writeFileSync(process.argv[summaryAt + 1], summarize(changes))
