import { describe, expect, it } from 'vitest'
import { buildTitleViews } from '../lib/catalogView.ts'
import type { Catalog, Title } from '../lib/types.ts'
import { checkOff, emptyData } from '../lib/watchActions.ts'
import { nextRelease, watchesInYear } from './stats.ts'

const t = (id: string, over: Partial<Title>): Title => ({
  id, title: id, type: 'movie', releaseDate: '2020-01-01', universe: 'mcu', saga: 'Multiverse Saga',
  phase: 6, chronoIndex: null, studio: 'Marvel Studios', tmdbId: null, posterPath: null, ...over,
})
const catalog: Catalog = {
  schemaVersion: 1,
  generatedAt: '',
  titles: [
    t('doomsday', { releaseDate: '2026-12-18' }),
    t('show', { type: 'series', releaseDate: '2025-01-29' }),
    t('venom', { universe: 'other', releaseDate: '2026-11-01' }),
    t('old', { releaseDate: '2008-05-02' }),
  ],
  seasons: [
    { id: 'show-s1', titleId: 'show', number: 1, label: 'Season 1', episodeCount: 10, premiereDate: '2025-01-29', phase: 5 },
    { id: 'show-s2', titleId: 'show', number: 2, label: 'Season 2', episodeCount: null, premiereDate: '2026-11-20', phase: 6 },
  ],
}

describe('stats', () => {
  const ctx = { now: '', newId: (() => { let i = 0; return () => `w${++i}` })() }
  let data = checkOff(emptyData(''), ctx, 'old', '2026-02-01')
  data = checkOff(data, ctx, 'old', '2025-02-01')
  const views = buildTitleViews(catalog, data, '2026-10-16')

  it('finds the soonest upcoming movie or season in the universe', () => {
    const next = nextRelease(views, 'mcu', '2026-10-16')
    expect(next).toMatchObject({ date: '2026-11-20', seasonLabel: 'Season 2' })
    expect(next?.view.title.id).toBe('show')
    expect(nextRelease(views, 'other', '2026-10-16')?.view.title.id).toBe('venom')
    expect(nextRelease(views, 'mcu', '2027-01-01')).toBeNull()
  })
  it('counts watches finished in a year', () => {
    expect(watchesInYear(views, '2026')).toBe(1)
    expect(watchesInYear(views, '2024')).toBe(0)
  })
})
