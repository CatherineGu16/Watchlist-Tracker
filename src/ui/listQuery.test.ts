import { describe, expect, it } from 'vitest'
import { buildTitleViews } from '../lib/catalogView.ts'
import type { Catalog, Title } from '../lib/types.ts'
import { checkOff, emptyData } from '../lib/watchActions.ts'
import { DEFAULT_QUERY, filterViews, groupViews, normalize, sortableTitle, sortViews, type ListQuery } from './listQuery.ts'

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
const q = (over: Partial<ListQuery>) => ({ ...DEFAULT_QUERY, ...over })
const ids = (vs: typeof views) => vs.map((v) => v.title.id)

describe('filterViews', () => {
  it('splits MCU from other Marvel', () => {
    expect(ids(filterViews(views, q({ universe: 'other' })))).toEqual(['shield'])
  })
  it('filters by type, saga, phase and status', () => {
    expect(ids(filterViews(views, q({ type: 'series' })))).toEqual(['wandavision'])
    expect(ids(filterViews(views, q({ sagas: ['Multiverse Saga'] })))).toEqual(['wandavision', 'doomsday'])
    expect(ids(filterViews(views, q({ phase: 4 })))).toEqual(['wandavision'])
    expect(ids(filterViews(views, q({ status: 'watched' })))).toEqual(['iron-man', 'the-avengers'])
    expect(ids(filterViews(views, q({ status: 'upcoming' })))).toEqual(['doomsday'])
  })
  it('searches ignoring case and punctuation', () => {
    expect(normalize('Agents of S.H.I.E.L.D.')).toContain('shield')
    expect(ids(filterViews(views, q({ universe: 'other', search: 'shield' })))).toEqual(['shield'])
    expect(ids(filterViews(views, q({ search: 'WANDA' })))).toEqual(['wandavision'])
  })
})

describe('sortViews and groupViews', () => {
  const mcu = filterViews(views, DEFAULT_QUERY)
  it('release order groups by year', () => {
    const groups = groupViews(sortViews(mcu, 'release'), 'release')
    expect(groups.map((g) => g.label)).toEqual(['2008', '2011', '2012', '2021', '2026'])
    expect(groups[0].watched).toBe(1)
  })
  it('story order follows the timeline and groups by phase', () => {
    const sorted = sortViews(mcu, 'story')
    expect(ids(sorted)).toEqual(['cap', 'iron-man', 'the-avengers', 'wandavision', 'doomsday'])
    expect(groupViews(sorted, 'story').map((g) => g.label)).toEqual(['Phase 1', 'Phase 4', 'Phase 6'])
  })
  it('title order ignores leading articles', () => {
    expect(sortableTitle('The Avengers')).toBe('Avengers')
    expect(ids(sortViews(mcu, 'title'))).toEqual(['the-avengers', 'doomsday', 'cap', 'iron-man', 'wandavision'])
  })
  it('last watched puts recent first and unwatched last', () => {
    const groups = groupViews(sortViews(mcu, 'last-watched'), 'last-watched')
    expect(groups.map((g) => g.label)).toEqual(['Watched in 2019', 'Watched in 2018', 'Not watched yet'])
  })
  it('saga order groups with progress', () => {
    const groups = groupViews(sortViews(mcu, 'saga'), 'saga')
    expect(groups.map((g) => [g.label, g.watched, g.items.length])).toEqual([
      ['Infinity Saga', 2, 3],
      ['Multiverse Saga', 0, 2],
    ])
  })
})
