import { describe, expect, it } from 'vitest'
import { buildTitleViews } from '../lib/catalogView.ts'
import type { Catalog, Title } from '../lib/types.ts'
import { checkOff, emptyData } from '../lib/watchActions.ts'
import { DEFAULT_QUERY, filterEntries, groupEntries, normalize, sortableTitle, sortEntries, toEntries, type ListEntry, type ListQuery } from './listQuery.ts'

const t = (id: string, over: Partial<Title>): Title => ({
  id,
  title: id,
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

const catalog: Catalog = {
  schemaVersion: 1,
  generatedAt: '',
  titles: [
    t('iron-man', { title: 'Iron Man', releaseDate: '2008-05-02', chronoIndex: 3 }),
    t('cap', { title: 'Captain America: The First Avenger', releaseDate: '2011-07-22', chronoIndex: 1 }),
    t('the-avengers', { title: 'The Avengers', releaseDate: '2012-05-04', chronoIndex: 4 }),
    t('shield', { title: 'Agents of S.H.I.E.L.D.', type: 'series', universe: 'other', releaseDate: '2013-09-24', phase: null }),
    t('wandavision', { title: 'WandaVision', type: 'series', saga: 'Multiverse Saga', phase: 4, releaseDate: '2021-01-15', chronoIndex: 5 }),
    t('doomsday', { title: 'Avengers: Doomsday', saga: 'Multiverse Saga', phase: 6, releaseDate: '2026-12-18', chronoIndex: 6 }),
  ],
  seasons: [
    { id: 'shield-s1', titleId: 'shield', number: 1, label: 'Season 1', episodeCount: 22, premiereDate: '2013-09-24', phase: null },
    { id: 'wandavision-s1', titleId: 'wandavision', number: 1, label: 'Season 1', episodeCount: 9, premiereDate: '2021-01-15', phase: 4 },
  ],
}

const ctx = { now: '2026-10-16T00:00:00Z', newId: (() => { let i = 0; return () => `w${++i}` })() }
let data = checkOff(emptyData(ctx.now), ctx, 'iron-man', '2018-06-19')
data = checkOff(data, ctx, 'the-avengers', '2019-06-19')
const views = buildTitleViews(catalog, data, '2026-10-16')
const entries = toEntries(views, false, '2026-10-16')
const q = (over: Partial<ListQuery>) => ({ ...DEFAULT_QUERY, ...over })
const ids = (es: ListEntry[]) => es.map((e) => e.key)

describe('filterEntries', () => {
  it('splits MCU from other Marvel', () => {
    expect(ids(filterEntries(entries, q({ universe: 'other' })))).toEqual(['shield'])
  })
  it('filters by type, saga, phase and status', () => {
    expect(ids(filterEntries(entries, q({ type: 'series' })))).toEqual(['wandavision'])
    expect(ids(filterEntries(entries, q({ sagas: ['Multiverse Saga'] })))).toEqual(['wandavision', 'doomsday'])
    expect(ids(filterEntries(entries, q({ phase: 4 })))).toEqual(['wandavision'])
    expect(ids(filterEntries(entries, q({ status: 'watched' })))).toEqual(['iron-man', 'the-avengers'])
    expect(ids(filterEntries(entries, q({ status: 'upcoming' })))).toEqual(['doomsday'])
  })
  it('searches ignoring case and punctuation', () => {
    expect(normalize('Agents of S.H.I.E.L.D.')).toContain('shield')
    expect(ids(filterEntries(entries, q({ universe: 'other', search: 'shield' })))).toEqual(['shield'])
    expect(ids(filterEntries(entries, q({ search: 'WANDA' })))).toEqual(['wandavision'])
  })
})

describe('sortEntries and groupEntries', () => {
  const mcu = filterEntries(entries, DEFAULT_QUERY)
  it('release order groups by year', () => {
    const groups = groupEntries(sortEntries(mcu, 'release'), 'release')
    expect(groups.map((g) => g.label)).toEqual(['2008', '2011', '2012', '2021', '2026'])
    expect(groups[0].watched).toBe(1)
  })
  it('story order follows the timeline as one run', () => {
    const sorted = sortEntries(mcu, 'story')
    expect(ids(sorted)).toEqual(['cap', 'iron-man', 'the-avengers', 'wandavision', 'doomsday'])
    expect(groupEntries(sorted, 'story').map((g) => g.label)).toEqual(['In story order'])
  })
  it('title order ignores leading articles', () => {
    expect(sortableTitle('The Avengers')).toBe('Avengers')
    expect(ids(sortEntries(mcu, 'title'))).toEqual(['the-avengers', 'doomsday', 'cap', 'iron-man', 'wandavision'])
  })
  it('last watched puts recent first and unwatched last', () => {
    const groups = groupEntries(sortEntries(mcu, 'last-watched'), 'last-watched')
    expect(groups.map((g) => g.label)).toEqual(['Watched in 2019', 'Watched in 2018', 'Not watched yet'])
  })
  it('saga order groups with progress', () => {
    const groups = groupEntries(sortEntries(mcu, 'saga'), 'saga')
    expect(groups.map((g) => [g.label, g.watched, g.items.length])).toEqual([
      ['Infinity Saga', 2, 3],
      ['Multiverse Saga', 0, 2],
    ])
  })
})

describe('release order, by season', () => {
  // Two shows whose seasons alternate, like Daredevil and Jessica Jones.
  const shows: Catalog = {
    schemaVersion: 1,
    generatedAt: '',
    titles: [
      t('dd', { title: 'Daredevil', type: 'series', releaseDate: '2015-04-10', phase: null }),
      t('jj', { title: 'Jessica Jones', type: 'series', releaseDate: '2015-11-20', phase: null }),
      t('aou', { title: 'Avengers: Age of Ultron', releaseDate: '2015-05-01', phase: 2 }),
    ],
    seasons: [
      { id: 'dd-s1', titleId: 'dd', number: 1, label: 'Season 1', episodeCount: 13, premiereDate: '2015-04-10', phase: null },
      { id: 'dd-s2', titleId: 'dd', number: 2, label: 'Season 2', episodeCount: 13, premiereDate: '2016-03-18', phase: null },
      { id: 'jj-s1', titleId: 'jj', number: 1, label: 'Season 1', episodeCount: 13, premiereDate: '2015-11-20', phase: null },
      { id: 'jj-s2', titleId: 'jj', number: 2, label: 'Season 2', episodeCount: 13, premiereDate: '2018-03-08', phase: null },
      { id: 'dd-s3', titleId: 'dd', number: 3, label: 'Season 3', episodeCount: 13, premiereDate: '2018-10-19', phase: null },
    ],
  }
  const c = { now: '2026-10-16T00:00:00Z', newId: (() => { let i = 0; return () => `s${++i}` })() }
  const watched = checkOff(emptyData(c.now), c, 'dd', '2020-01-01', 'dd-s1')
  const v = buildTitleViews(shows, watched, '2026-10-16')

  it('interleaves seasons with each other and with movies by premiere date', () => {
    const sorted = sortEntries(toEntries(v, true, '2026-10-16'), 'release-seasons')
    expect(sorted.map((e) => e.key)).toEqual(['dd-s1', 'aou', 'jj-s1', 'dd-s2', 'jj-s2', 'dd-s3'])
    expect(groupEntries(sorted, 'release-seasons').map((g) => [g.label, g.items.length, g.watched])).toEqual([
      ['2015', 3, 1],
      ['2016', 1, 0],
      ['2018', 2, 0],
    ])
  })

  it('gives each season its own status, so filters work per season', () => {
    const e = toEntries(v, true, '2026-10-16')
    expect(ids(filterEntries(e, q({ status: 'watched' })))).toEqual(['dd-s1'])
    expect(ids(filterEntries(e, q({ type: 'series', status: 'unwatched' }))).sort()).toEqual(['dd-s2', 'dd-s3', 'jj-s1', 'jj-s2'])
  })

  it('other sorts keep one row per show', () => {
    expect(toEntries(v, false, '2026-10-16').map((e) => e.key).sort()).toEqual(['aou', 'dd', 'jj'])
  })
})
