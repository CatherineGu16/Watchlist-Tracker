import { describe, expect, it } from 'vitest'
import { buildTitleViews } from '../lib/catalogView.ts'
import type { Catalog, Title } from '../lib/types.ts'
import { checkOff, emptyData, logWatch, startSeason, type EditContext } from '../lib/watchActions.ts'
import { continueWatching, recentlyWatched, upNext } from './home.ts'
import { parseHash, toHash } from './route.ts'

const t = (id: string, over: Partial<Title> = {}): Title => ({
  id, title: id, type: 'movie', releaseDate: '2020-01-01', universe: 'mcu', saga: 'Infinity Saga',
  phase: 1, chronoIndex: null, studio: 'Marvel Studios', tmdbId: null, posterPath: null, ...over,
})
const catalog: Catalog = {
  schemaVersion: 1,
  generatedAt: '',
  titles: [t('a'), t('b'), t('show', { type: 'series' })],
  seasons: [
    { id: 'show-s1', titleId: 'show', number: 1, label: 'Season 1', episodeCount: 6, premiereDate: '2020-01-01', phase: 1 },
    { id: 'show-s2', titleId: 'show', number: 2, label: 'Season 2', episodeCount: 6, premiereDate: '2021-01-01', phase: 1 },
  ],
}
let clock = 0
const ctx = (): EditContext => ({ now: `2026-10-16T00:00:${String(clock++).padStart(2, '0')}Z`, newId: () => `w${clock}` })

describe('continueWatching', () => {
  it('lists open watches, most recently touched first', () => {
    let d = startSeason(emptyData(''), ctx(), 'show', 'show-s2', '2026-10-01')
    d = logWatch(d, ctx(), { titleId: 'a', startDate: '2026-10-10', endDate: null })
    d = checkOff(d, ctx(), 'b', '2026-10-12')
    const items = continueWatching(buildTitleViews(catalog, d, '2026-10-16'))
    expect(items.map((i) => [i.view.title.id, i.season?.label ?? null])).toEqual([
      ['a', null],
      ['show', 'Season 2'],
    ])
  })
})

describe('recentlyWatched', () => {
  it('newest finished first, one per movie or season, undated left out', () => {
    let d = checkOff(emptyData(''), ctx(), 'a', '2025-01-01')
    d = checkOff(d, ctx(), 'a', '2026-05-01')
    d = checkOff(d, ctx(), 'show', '2026-03-01', 'show-s1')
    d = logWatch(d, ctx(), { titleId: 'b', startDate: null, endDate: null })
    d = logWatch(d, ctx(), { titleId: 'show', seasonId: 'show-s2', startDate: '2026-10-01', endDate: null })
    const items = recentlyWatched(buildTitleViews(catalog, d, '2026-10-16'))
    expect(items.map((i) => [i.view.title.id, i.watch.endDate])).toEqual([
      ['a', '2026-05-01'],
      ['show', '2026-03-01'],
    ])
  })
  it('caps the list', () => {
    let d = emptyData('')
    for (const id of ['a', 'b']) d = checkOff(d, ctx(), id, '2026-01-01')
    expect(recentlyWatched(buildTitleViews(catalog, d, '2026-10-16'), 1)).toHaveLength(1)
  })
  it('shows the latest 5 by default', () => {
    const many: Catalog = { ...catalog, titles: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'].map((id) => t(id)) }
    let d = emptyData('')
    many.titles.forEach((title, i) => (d = checkOff(d, ctx(), title.id, `2026-0${i + 1}-01`)))
    expect(recentlyWatched(buildTitleViews(many, d, '2026-10-16')).map((i) => i.view.title.id)).toEqual(['m7', 'm6', 'm5', 'm4', 'm3'])
  })
})

describe('routes', () => {
  it('round-trips pages and open titles', () => {
    expect(parseHash('')).toEqual({ page: 'home', titleId: null })
    expect(parseHash('#/')).toEqual({ page: 'home', titleId: null })
    expect(parseHash('#/browse')).toEqual({ page: 'browse', titleId: null })
    expect(parseHash('#/browse?title=iron-man-2008')).toEqual({ page: 'browse', titleId: 'iron-man-2008' })
    expect(parseHash('#/nonsense')).toEqual({ page: 'home', titleId: null })
    expect(toHash({ page: 'browse', titleId: 'a b' })).toBe('#/browse?title=a%20b')
    expect(parseHash(toHash({ page: 'home', titleId: 'x' }))).toEqual({ page: 'home', titleId: 'x' })
  })
})

describe('upNext', () => {
  it('suggests unwatched MCU titles that are out, in release order, skipping what you are watching', () => {
    const titles: Catalog = {
      ...catalog,
      titles: [
        t('first', { releaseDate: '2008-05-02' }),
        t('seen', { releaseDate: '2009-01-01' }),
        t('second', { releaseDate: '2010-05-07' }),
        t('other', { releaseDate: '2009-06-01', universe: 'other' }),
        t('later', { releaseDate: '2027-01-01' }),
        t('show', { type: 'series', releaseDate: '2011-01-01' }),
      ],
    }
    let d = checkOff(emptyData(''), ctx(), 'seen', '2026-01-01')
    d = startSeason(d, ctx(), 'show', 'show-s1', '2026-10-01')
    expect(upNext(buildTitleViews(titles, d, '2026-10-16')).map((v) => v.title.id)).toEqual(['first', 'second'])
  })
})
