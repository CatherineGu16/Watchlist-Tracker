import { describe, expect, it } from 'vitest'
import type { Catalog, Season, Title } from '../src/lib/types.ts'
import { classify, findTitle, normalizeName, planUpdates, summarize, type TmdbItem } from './tmdb-lib.ts'

const title = (t: Partial<Title> & Pick<Title, 'id' | 'title'>): Title => ({
  type: 'movie',
  releaseDate: null,
  universe: 'mcu',
  collection: 'marvel-studios',
  saga: 'Multiverse Saga',
  phase: 6,
  chronoIndex: null,
  studio: 'Marvel Studios',
  tmdbId: null,
  posterPath: null,
  ...t,
})

const season = (s: Partial<Season> & Pick<Season, 'titleId' | 'number'>): Season => ({
  id: `${s.titleId}-s${s.number}`,
  label: `Season ${s.number}`,
  episodeCount: null,
  premiereDate: null,
  phase: 6,
  ...s,
})

const CATALOG: Catalog = {
  schemaVersion: 1,
  generatedAt: '2026-10-01T00:00:00.000Z',
  titles: [
    title({ id: 'thunderbolts-2025', title: 'Thunderbolts*', releaseDate: '2025-05-02', phase: 5, chronoIndex: 10 }),
    title({ id: 'visionquest-2026', title: 'VisionQuest', type: 'series', releaseDate: '2026-10-14', chronoIndex: 12 }),
    title({ id: 'avengers-doomsday-2026', title: 'Avengers: Doomsday', releaseDate: '2026-12-18', chronoIndex: 14 }),
    title({ id: 'fantastic-four-2005', title: 'Fantastic Four', releaseDate: '2005-07-08', universe: 'other', collection: 'classic', saga: 'Classic Marvel', phase: null }),
  ],
  seasons: [season({ titleId: 'visionquest-2026', number: 1, premiereDate: '2026-10-14', episodeCount: 8 })],
}

const TODAY = '2026-11-10'
const NONE = { movie: [], tv: [] }
const marvel = (item: Partial<TmdbItem> & Pick<TmdbItem, 'id' | 'name'>): TmdbItem => ({ kind: 'movie', date: null, companies: ['Marvel Studios'], ...item })

describe('findTitle', () => {
  it('matches names regardless of spacing and punctuation', () => {
    expect(normalizeName('Vision Quest')).toBe(normalizeName('VisionQuest'))
    expect(findTitle(CATALOG.titles, marvel({ id: 1, name: 'Thunderbolts', date: '2025-05-02' }))?.id).toBe('thunderbolts-2025')
  })

  it("doesn't match a same-named title from another era or of another type", () => {
    expect(findTitle(CATALOG.titles, marvel({ id: 2, name: 'Fantastic Four', date: '2015-08-07' }))).toBeUndefined()
    expect(findTitle(CATALOG.titles, marvel({ id: 3, name: 'Thunderbolts*', kind: 'tv', date: '2025-05-02' }))).toBeUndefined()
  })
})

describe('classify', () => {
  it('takes saga and phase from the MCU title out just before, and goes last in story order', () => {
    const c = classify(marvel({ id: 4, name: 'Blade', date: '2027-02-01' }), CATALOG.titles)
    expect(c).toMatchObject({ universe: 'mcu', saga: 'Multiverse Saga', phase: 6, chronoIndex: 15 })
    expect(c.guessed).toContain('phase')
  })

  it('puts Sony and Fox titles in their Other Marvel groups', () => {
    expect(classify(marvel({ id: 5, name: 'x', companies: ['Sony Pictures', 'Marvel Entertainment'] }), CATALOG.titles)).toMatchObject({
      universe: 'other',
      collection: 'sony-spider-man',
      saga: 'Spider-Man',
      chronoIndex: null,
    })
    expect(classify(marvel({ id: 6, name: 'x', companies: ['20th Century Studios'] }), CATALOG.titles).collection).toBe('fox-xmen')
    expect(classify(marvel({ id: 7, name: 'x', companies: ['Marvel Entertainment', 'Lionsgate'] }), CATALOG.titles)).toMatchObject({
      collection: 'classic',
      studio: 'Lionsgate',
    })
  })
})

describe('planUpdates', () => {
  it('adds a missing title with its TMDB id', () => {
    const { catalog, changes } = planUpdates(CATALOG, [marvel({ id: 10, name: 'Shang-Chi 2', date: '2027-07-01' })], NONE, TODAY)
    expect(changes.map((c) => c.kind)).toEqual(['title'])
    expect(catalog.titles.at(-1)).toMatchObject({ id: 'shang-chi-2-2027', title: 'Shang-Chi 2', type: 'movie', tmdbId: 10, universe: 'mcu' })
  })

  it('adds new shows with their seasons, skipping specials (season 0)', () => {
    const show = marvel({
      id: 11,
      kind: 'tv',
      name: 'Wonder Woman',
      date: '2027-03-01',
      seasons: [
        { number: 0, episodeCount: 2, airDate: null },
        { number: 1, episodeCount: 8, airDate: '2027-03-01' },
      ],
    })
    const { catalog, changes } = planUpdates(CATALOG, [show], NONE, TODAY)
    expect(changes.map((c) => c.kind)).toEqual(['title', 'season'])
    // TMDB lists only some episodes of a season that hasn't started, so the count waits.
    expect(catalog.seasons.at(-1)).toMatchObject({ id: 'wonder-woman-2027-s1', titleId: 'wonder-woman-2027', episodeCount: null, premiereDate: '2027-03-01' })
  })

  it('takes episode counts only once a season has started', () => {
    const show = (episodeCount: number, airDate: string) =>
      marvel({ id: 17, kind: 'tv', name: 'Echo', date: '2026-11-01', seasons: [{ number: 1, episodeCount, airDate }] })
    const withEcho: Catalog = {
      ...CATALOG,
      titles: [...CATALOG.titles, title({ id: 'echo-2026', title: 'Echo', type: 'series', releaseDate: '2026-11-01' })],
      seasons: [...CATALOG.seasons, season({ titleId: 'echo-2026', number: 1 })],
    }
    expect(planUpdates(withEcho, [show(1, '2027-01-13')], NONE, TODAY).changes.map((c) => c.kind === 'update' && c.what)).toEqual(['Echo Season 1: premiere'])
    expect(planUpdates(withEcho, [show(6, '2026-11-01')], NONE, TODAY).changes.map((c) => c.kind === 'update' && c.what)).toEqual([
      'Echo Season 1: premiere',
      'Echo Season 1: episodes',
    ])
  })

  it('follows a title TMDB renamed, by its TMDB id', () => {
    const added = planUpdates(CATALOG, [marvel({ id: 18, name: 'Untitled X-Men Film', date: '2028-05-04' })], NONE, TODAY).catalog
    const { catalog, changes } = planUpdates(added, [marvel({ id: 18, name: 'X-Men: First Class Act', date: '2028-05-05' })], NONE, TODAY)
    expect(changes.map((c) => c.kind === 'update' && c.what)).toEqual(['Untitled X-Men Film: title', 'Untitled X-Men Film: release date'])
    expect(catalog.titles.at(-1)).toMatchObject({ id: 'untitled-x-men-film-2028', title: 'X-Men: First Class Act', releaseDate: '2028-05-05' })
    expect(catalog.titles).toHaveLength(added.titles.length)
  })

  it('adds a new season to a show already in the catalog', () => {
    const show = marvel({
      id: 12,
      kind: 'tv',
      name: 'VisionQuest',
      date: '2026-10-14',
      seasons: [
        { number: 1, episodeCount: 8, airDate: '2026-10-14' },
        { number: 2, episodeCount: null, airDate: '2028-01-05' },
      ],
    })
    const { catalog, changes } = planUpdates(CATALOG, [show], NONE, TODAY)
    expect(changes.map((c) => c.kind)).toEqual(['season'])
    expect(catalog.seasons.at(-1)).toMatchObject({ id: 'visionquest-2026-s2', number: 2, episodeCount: null, premiereDate: '2028-01-05' })
  })

  it("updates dates only for what isn't out yet, and keeps the title's id", () => {
    const items = [
      marvel({ id: 13, name: 'Avengers: Doomsday', date: '2027-01-08' }),
      marvel({ id: 14, name: 'Thunderbolts*', date: '2025-05-01' }),
    ]
    const { catalog, changes } = planUpdates(CATALOG, items, NONE, TODAY)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ kind: 'update', from: '2026-12-18', to: '2027-01-08' })
    expect(catalog.titles.find((t) => t.id === 'avengers-doomsday-2026')?.releaseDate).toBe('2027-01-08')
    expect(catalog.titles.find((t) => t.id === 'thunderbolts-2025')?.releaseDate).toBe('2025-05-02')
  })

  it('skips ignored ids and duplicates, and leaves the input catalog untouched', () => {
    const item = marvel({ id: 15, name: 'Marvel Zombies 2', date: '2027-09-01' })
    expect(planUpdates(CATALOG, [item], { movie: [15], tv: [] }, TODAY).changes).toEqual([])
    expect(planUpdates(CATALOG, [item, item], NONE, TODAY).changes).toHaveLength(1)
    expect(CATALOG.titles).toHaveLength(4)
  })

  it('reports nothing when the catalog already has everything', () => {
    const { catalog, changes } = planUpdates(CATALOG, [marvel({ id: 16, name: 'Thunderbolts*', date: '2025-05-02' })], NONE, TODAY)
    expect(changes).toEqual([])
    expect(catalog).toEqual(CATALOG)
  })
})

describe('summarize', () => {
  it('lists each change with a TMDB link and the TMDB credit', () => {
    const { changes } = planUpdates(CATALOG, [marvel({ id: 10, name: 'Shang-Chi 2', date: '2027-07-01' })], NONE, TODAY)
    const md = summarize(changes)
    expect(md).toContain('**Shang-Chi 2** (movie, 2027-07-01)')
    expect(md).toContain('https://www.themoviedb.org/movie/10')
    expect(md).toContain('not endorsed or certified by TMDB')
  })
})
