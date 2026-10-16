import { describe, expect, it } from 'vitest'
import { buildTitleViews } from './catalogView.ts'
import type { Catalog, Title } from './types.ts'
import { checkOff, emptyData, startSeason } from './watchActions.ts'

const t = (id: string, over: Partial<Title> = {}): Title => ({
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
  titles: [t('movie'), t('show', { type: 'series' })],
  seasons: [
    { id: 'show-s2', titleId: 'show', number: 2, label: 'Season 2', episodeCount: 6, premiereDate: '2021-01-01', phase: 1 },
    { id: 'show-s1', titleId: 'show', number: 1, label: 'Season 1', episodeCount: 6, premiereDate: '2020-01-01', phase: 1 },
  ],
}
const ctx = { now: '2026-10-16T00:00:00Z', newId: (() => { let i = 0; return () => `w${++i}` })() }

describe('buildTitleViews', () => {
  it('joins watches, sorts seasons, and summarizes', () => {
    let data = checkOff(emptyData(ctx.now), ctx, 'movie', '2026-10-16')
    data = startSeason(data, ctx, 'show', 'show-s1', '2026-10-10')
    const views = Object.fromEntries(buildTitleViews(catalog, data, '2026-10-16').map((v) => [v.title.id, v]))
    expect(views.movie.summary.status).toBe('watched')
    expect(views.show.seasons.map((s) => s.number)).toEqual([1, 2])
    expect(views.show.summary).toMatchObject({ status: 'in-progress', seasonsDone: 0, seasonsReleased: 2 })
  })
  it('applies overrides and includes custom titles', () => {
    const data = { ...emptyData(ctx.now), titleOverrides: { movie: { universe: 'other' as const } }, customTitles: [t('mine')] }
    const views = buildTitleViews(catalog, data, '2026-10-16')
    expect(views.find((v) => v.title.id === 'movie')?.title.universe).toBe('other')
    expect(views.some((v) => v.title.id === 'mine')).toBe(true)
  })
})
