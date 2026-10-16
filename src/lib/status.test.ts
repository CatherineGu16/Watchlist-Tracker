import { describe, expect, it } from 'vitest'
import { seasonStatus, summarizeTitle } from './status.ts'
import type { Season, Title, Watch } from './types.ts'

const TODAY = '2026-10-16'

const title = (over: Partial<Title> = {}): Title => ({
  id: 't',
  title: 'T',
  type: 'movie',
  releaseDate: '2020-01-01',
  universe: 'mcu',
  saga: 'Infinity Saga',
  phase: 1,
  chronoIndex: null,
  studio: 'Marvel Studios',
  tmdbId: null,
  posterPath: null,
  ...over,
})

const season = (n: number, premiereDate: string | null = '2020-01-01'): Season => ({
  id: `t-s${n}`,
  titleId: 't',
  number: n,
  label: `Season ${n}`,
  episodeCount: 10,
  premiereDate,
  phase: 1,
})

let seq = 0
const watch = (over: Partial<Watch> = {}): Watch => ({
  id: `w${++seq}`,
  titleId: 't',
  seasonId: null,
  startDate: '2021-05-01',
  endDate: '2021-05-01',
  approximate: false,
  episodesWatched: null,
  note: '',
  createdAt: '',
  updatedAt: '',
  ...over,
})

describe('movies', () => {
  it('is unwatched with no watches, upcoming before release', () => {
    expect(summarizeTitle(title(), [], [], TODAY).status).toBe('unwatched')
    expect(summarizeTitle(title({ releaseDate: '2026-12-18' }), [], [], TODAY).status).toBe('upcoming')
    expect(summarizeTitle(title({ releaseDate: null }), [], [], TODAY).status).toBe('upcoming')
  })
  it('counts rewatches and reports first/last dates', () => {
    const s = summarizeTitle(title(), [], [watch({ startDate: '2026-08-29', endDate: '2026-08-29' }), watch({ startDate: '2021', endDate: '2021' })], TODAY)
    expect(s).toMatchObject({ status: 'watched', watchCount: 2, firstWatched: '2021', lastWatched: '2026-08-29' })
  })
  it('counts "date unknown" watches as watched', () => {
    expect(summarizeTitle(title(), [], [watch({ startDate: null, endDate: null })], TODAY).status).toBe('watched')
  })
  it('allows watching before the release date (early screenings)', () => {
    expect(summarizeTitle(title({ releaseDate: '2026-12-18' }), [], [watch()], TODAY).status).toBe('watched')
  })
  it('ignores deleted watches', () => {
    expect(summarizeTitle(title(), [], [watch({ deleted: true })], TODAY).status).toBe('unwatched')
  })
})

describe('seasons', () => {
  it('is in progress while a watch is open', () => {
    const w = watch({ seasonId: 't-s1', startDate: '2022', endDate: null })
    expect(seasonStatus(season(1), [w], TODAY)).toBe('in-progress')
  })
  it('a finished watch beats an open rewatch', () => {
    const done = watch({ seasonId: 't-s1' })
    const open = watch({ seasonId: 't-s1', startDate: '2026-10-01', endDate: null })
    expect(seasonStatus(season(1), [done, open], TODAY)).toBe('watched')
  })
  it('is upcoming before its premiere', () => {
    expect(seasonStatus(season(2, '2027-01-13'), [], TODAY)).toBe('upcoming')
  })
})

describe('series', () => {
  const show = title({ type: 'series' })

  it('is watched when every released season is finished, ignoring unreleased seasons', () => {
    const seasons = [season(1), season(2), season(3, '2027-03')]
    const watches = [watch({ seasonId: 't-s1' }), watch({ seasonId: 't-s2' })]
    expect(summarizeTitle(show, seasons, watches, TODAY)).toMatchObject({ status: 'watched', seasonsDone: 2, seasonsReleased: 2 })
  })
  it('is in progress with some seasons done', () => {
    const seasons = [season(1), season(2), season(3)]
    expect(summarizeTitle(show, seasons, [watch({ seasonId: 't-s1' })], TODAY)).toMatchObject({
      status: 'in-progress',
      seasonsDone: 1,
      seasonsReleased: 3,
    })
  })
  it('is in progress when only a season is started', () => {
    const w = watch({ seasonId: 't-s1', startDate: '2022', endDate: null })
    expect(summarizeTitle(show, [season(1)], [w], TODAY).status).toBe('in-progress')
  })
  it('counts complete runs as the fewest watches of any season', () => {
    const seasons = [season(1), season(2)]
    const watches = [watch({ seasonId: 't-s1' }), watch({ seasonId: 't-s1' }), watch({ seasonId: 't-s2' })]
    expect(summarizeTitle(show, seasons, watches, TODAY).watchCount).toBe(1)
  })
  it('is upcoming when no season has premiered', () => {
    expect(summarizeTitle(show, [season(1, null)], [], TODAY).status).toBe('upcoming')
  })
})
