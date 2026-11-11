import { describe, expect, it } from 'vitest'
import type { Catalog, Season, Title } from '../src/lib/types.ts'
import { assignIds, classify, findTitle, normalizeName, pickSearchResult, planUpdates, summarize, type TmdbItem } from './tmdb-lib.ts'

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
    const { catalog, changes } = planUpdates(CATALOG, [marvel({ id: 10, name: 'Shang-Chi 2', date: '2026-07-01' })], NONE, TODAY)
    expect(changes.map((c) => c.kind)).toEqual(['title'])
    expect(catalog.titles.at(-1)).toMatchObject({ id: 'shang-chi-2-2026', title: 'Shang-Chi 2', type: 'movie', tmdbId: 10, universe: 'mcu' })
  })

  it("doesn't add titles or seasons that aren't out yet", () => {
    const items = [
      marvel({ id: 40, name: 'Black Panther 3', date: '2028-12-13' }),
      marvel({ id: 41, name: 'Untitled Marvel Film' }),
      marvel({ id: 42, kind: 'tv', name: 'VisionQuest', date: '2026-10-14', seasons: [{ number: 2, episodeCount: null, airDate: '2028-01-05' }] }),
    ]
    expect(planUpdates(CATALOG, items, NONE, TODAY).changes).toEqual([])
  })

  it('adds new shows with their seasons, skipping specials (season 0)', () => {
    const show = marvel({
      id: 11,
      kind: 'tv',
      name: 'Wonder Woman',
      date: '2026-09-01',
      seasons: [
        { number: 0, episodeCount: 2, airDate: null },
        { number: 1, episodeCount: 8, airDate: '2026-09-01' },
      ],
    })
    const { catalog, changes } = planUpdates(CATALOG, [show], NONE, TODAY)
    expect(changes.map((c) => c.kind)).toEqual(['title', 'season'])
    expect(catalog.seasons.at(-1)).toMatchObject({ id: 'wonder-woman-2026-s1', titleId: 'wonder-woman-2026', episodeCount: 8, premiereDate: '2026-09-01' })
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
    const added: Catalog = {
      ...CATALOG,
      titles: [...CATALOG.titles, title({ id: 'untitled-x-men-film-2028', title: 'Untitled X-Men Film', releaseDate: '2028-05-04', tmdbId: 18, tmdbType: 'movie' })],
    }
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
        { number: 2, episodeCount: 4, airDate: '2026-11-01' },
      ],
    })
    const { catalog, changes } = planUpdates(CATALOG, [show], NONE, TODAY)
    expect(changes.map((c) => c.kind)).toEqual(['season'])
    expect(catalog.seasons.at(-1)).toMatchObject({ id: 'visionquest-2026-s2', number: 2, episodeCount: 4, premiereDate: '2026-11-01' })
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
    const item = marvel({ id: 15, name: 'Marvel Zombies 2', date: '2026-09-01' })
    expect(planUpdates(CATALOG, [item], { movie: [15], tv: [] }, TODAY).changes).toEqual([])
    expect(planUpdates(CATALOG, [item, item], NONE, TODAY).changes).toHaveLength(1)
    expect(CATALOG.titles).toHaveLength(4)
  })

  it('reports nothing when the catalog already has everything, but notes the TMDB id it matched', () => {
    const { catalog, changes } = planUpdates(CATALOG, [marvel({ id: 16, name: 'Thunderbolts*', date: '2025-05-02' })], NONE, TODAY)
    expect(changes).toEqual([])
    expect(catalog.titles[0]).toEqual({ ...CATALOG.titles[0], tmdbId: 16, tmdbType: 'movie' })
  })

  it('fills missing runtimes and synopses, refreshes them before release, then leaves them alone', () => {
    const withDetails: Catalog = {
      ...CATALOG,
      titles: CATALOG.titles.map((t) => (t.id === 'thunderbolts-2025' ? { ...t, runtime: 127, overview: 'Old.' } : t)),
    }
    const items = [
      marvel({ id: 20, name: 'Thunderbolts*', date: '2025-05-02', runtime: 130, overview: 'New.' }),
      marvel({ id: 21, name: 'Avengers: Doomsday', date: '2026-12-18', runtime: 160, overview: 'Doom arrives.' }),
    ]
    const { catalog, changes } = planUpdates(withDetails, items, NONE, TODAY)
    expect(catalog.titles.find((t) => t.id === 'thunderbolts-2025')).toMatchObject({ runtime: 127, overview: 'Old.' })
    expect(catalog.titles.find((t) => t.id === 'avengers-doomsday-2026')).toMatchObject({ runtime: 160, overview: 'Doom arrives.' })
    expect(changes.map((c) => c.kind === 'details' && c.what)).toEqual(['synopsis', 'runtime'])

    const later = planUpdates(catalog, [marvel({ id: 21, name: 'Avengers: Doomsday', date: '2026-12-18', runtime: 165 })], NONE, TODAY)
    expect(later.catalog.titles.find((t) => t.id === 'avengers-doomsday-2026')?.runtime).toBe(165)
  })

  it("adds season runtimes, and doesn't re-add seasons TMDB numbers differently", () => {
    const show = marvel({
      id: 22,
      kind: 'tv',
      name: 'VisionQuest',
      date: '2026-10-14',
      seasons: [{ number: 1, episodeCount: 8, airDate: '2026-10-14', runtime: 400 }],
    })
    const { catalog, changes } = planUpdates(CATALOG, [show], NONE, TODAY)
    expect(changes.map((c) => c.kind === 'details' && c.what)).toEqual(['season runtime'])
    expect(catalog.seasons[0].runtime).toBe(400)

    const older: Catalog = {
      ...CATALOG,
      seasons: [season({ titleId: 'visionquest-2026', number: 1 }), season({ titleId: 'visionquest-2026', number: 3 })],
    }
    const split = marvel({ ...show, seasons: [{ number: 2, episodeCount: 6, airDate: '2026-10-20' }] })
    expect(planUpdates(older, [split], NONE, TODAY).changes).toEqual([])
  })
})

describe('posters', () => {
  const poster = (over: Partial<TmdbItem> = {}) => marvel({ id: 30, name: 'Thunderbolts*', date: '2025-05-02', posterPath: '/tb.jpg', ...over })

  it('downloads a poster once a title is out, to a file named after the title', () => {
    const { catalog, changes } = planUpdates(CATALOG, [poster()], NONE, TODAY)
    expect(changes).toEqual([expect.objectContaining({ kind: 'poster', remote: '/tb.jpg' })])
    expect(catalog.titles[0].posterPath).toBe('posters/thunderbolts-2025.jpg')
  })

  it("waits for release, and doesn't replace a poster it already has", () => {
    expect(planUpdates(CATALOG, [marvel({ id: 31, name: 'Avengers: Doomsday', date: '2026-12-18', posterPath: '/teaser.jpg' })], NONE, TODAY).changes).toEqual([])
    const has = planUpdates(CATALOG, [poster()], NONE, TODAY).catalog
    expect(planUpdates(has, [poster({ posterPath: '/newer.jpg' })], NONE, TODAY).changes).toEqual([])
  })

  it('gets one with a new title that is already out', () => {
    const { changes } = planUpdates(CATALOG, [marvel({ id: 32, name: 'Eyes of Wakanda', kind: 'tv', date: '2025-08-01', posterPath: '/ew.jpg' })], NONE, TODAY)
    expect(changes.map((c) => c.kind)).toEqual(['title', 'poster'])
  })
})

describe('pickSearchResult', () => {
  const thunderbolts = CATALOG.titles[0]
  it('takes the same name from about the same year', () => {
    expect(pickSearchResult(thunderbolts, [{ id: 1, name: 'Thunderbolts', date: '2025-04-30' }, { id: 2, name: 'Thunderbolts*', date: '2026-01-01' }])).toBe(1)
  })

  it('takes a lone same-year result whose name contains ours, and nothing when unsure', () => {
    expect(pickSearchResult(thunderbolts, [{ id: 3, name: "Marvel's Thunderbolts*", date: '2025-05-02' }])).toBe(3)
    expect(
      pickSearchResult(thunderbolts, [
        { id: 4, name: 'Thunderbolts* Assemble', date: '2025-05-02' },
        { id: 5, name: 'The Thunderbolts* Story', date: '2025-06-01' },
      ]),
    ).toBeNull()
    expect(pickSearchResult(thunderbolts, [{ id: 6, name: 'Thunderbolts*', date: '1999-01-01' }])).toBeNull()
  })
})

describe('assignIds', () => {
  it('sets ids only on titles without one', () => {
    const withId: Catalog = { ...CATALOG, titles: CATALOG.titles.map((t, i) => (i === 1 ? { ...t, tmdbId: 99, tmdbType: 'tv' } : t)) }
    const { catalog, changes } = assignIds(withId, [
      { titleId: 'thunderbolts-2025', tmdbType: 'movie', tmdbId: 7 },
      { titleId: 'visionquest-2026', tmdbType: 'tv', tmdbId: 8 },
    ])
    expect(changes).toHaveLength(1)
    expect(catalog.titles[0]).toMatchObject({ tmdbId: 7, tmdbType: 'movie' })
    expect(catalog.titles[1]).toMatchObject({ tmdbId: 99 })
  })
})

describe('summarize', () => {
  it('counts runtimes and synopses, lists matches for checking, and names titles TMDB lacks', () => {
    const { catalog, changes: ids } = assignIds(CATALOG, [{ titleId: 'thunderbolts-2025', tmdbType: 'movie', tmdbId: 7 }])
    const { changes } = planUpdates(catalog, [marvel({ id: 7, name: 'Thunderbolts*', date: '2025-05-02', runtime: 127, overview: 'x' })], NONE, TODAY)
    const md = summarize([...ids, ...changes], [CATALOG.titles[3]])
    expect(md).toContain('Added or refreshed 1 runtime, 1 synopsis')
    expect(md).toContain('- Thunderbolts* (2025) · [TMDB](https://www.themoviedb.org/movie/7)')
    expect(md).toContain('- Fantastic Four (2005, movie)')
  })

  it('lists each change with a TMDB link and the TMDB credit', () => {
    const { changes } = planUpdates(CATALOG, [marvel({ id: 10, name: 'Shang-Chi 2', date: '2026-07-01' })], NONE, TODAY)
    const md = summarize(changes)
    expect(md).toContain('**Shang-Chi 2** (movie, 2026-07-01)')
    expect(md).toContain('https://www.themoviedb.org/movie/10')
    expect(md).toContain('not endorsed, certified, or otherwise approved by TMDB')
  })
})
