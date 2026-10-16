import { describe, expect, it } from 'vitest'
import { buildTitleViews } from '../lib/catalogView.ts'
import type { Catalog, PrivateData } from '../lib/types.ts'
import { checkOff, emptyData, logWatch, setEpisodes, startSeason, type EditContext } from '../lib/watchActions.ts'
import { seriesNote } from './seriesProgress.ts'

const TODAY = '2026-10-16'
const catalog: Catalog = {
  schemaVersion: 1,
  generatedAt: '',
  titles: [
    {
      id: 'dd', title: 'Daredevil: Born Again', type: 'series', releaseDate: '2025-03-04', universe: 'mcu', saga: 'Multiverse Saga',
      phase: 5, chronoIndex: null, studio: 'Marvel Studios', tmdbId: null, posterPath: null,
    },
  ],
  seasons: [
    { id: 'dd-s1', titleId: 'dd', number: 1, label: 'Season 1', episodeCount: 9, premiereDate: '2025-03-04', phase: 5 },
    { id: 'dd-s2', titleId: 'dd', number: 2, label: 'Season 2', episodeCount: 8, premiereDate: '2026-03-24', phase: 6 },
    { id: 'dd-s3', titleId: 'dd', number: 3, label: 'Season 3', episodeCount: 8, premiereDate: '2027-03', phase: 6 },
  ],
}

const ctx = (): EditContext => {
  let i = 0
  return { now: '2026-10-16T00:00:00Z', newId: () => `w${++i}` }
}
const note = (data: PrivateData) => {
  const n = seriesNote(buildTitleViews(catalog, data, TODAY)[0], TODAY)
  return n && { kind: n.kind, season: n.season.number, ...('episodes' in n ? { episodes: n.episodes } : {}) }
}

describe('seriesNote', () => {
  it('says nothing for an unstarted show', () => {
    expect(note(emptyData(''))).toBeNull()
  })
  it('shows the season and episode in progress', () => {
    const c = ctx()
    let d = checkOff(emptyData(''), c, 'dd', TODAY, 'dd-s1')
    d = startSeason(d, c, 'dd', 'dd-s2', TODAY)
    d = setEpisodes(d, c, 'w2', 5, 8)
    expect(note(d)).toEqual({ kind: 'watching', season: 2, episodes: 5 })
  })
  it('flags a released season after the ones you watched', () => {
    const d = checkOff(emptyData(''), ctx(), 'dd', TODAY, 'dd-s1')
    expect(note(d)).toEqual({ kind: 'new-season', season: 2 })
  })
  it('points to the next announced season once caught up', () => {
    const c = ctx()
    let d = logWatch(emptyData(''), c, { titleId: 'dd', seasonId: 'dd-s1', startDate: null, endDate: null })
    d = checkOff(d, c, 'dd', TODAY, 'dd-s2')
    expect(note(d)).toEqual({ kind: 'next-season', season: 3 })
  })
})
