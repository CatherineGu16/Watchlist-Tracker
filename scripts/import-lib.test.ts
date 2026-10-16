import { describe, expect, it } from 'vitest'
import { buildFromSheet, slugify, titleId } from './import-lib.ts'

// Small fixture in the sheet's export shape. The watch history is invented: titles and dates are
// chosen not to match anyone's real list, since this repo is public.
const MAIN = `Last updated: 01/01/2024,,Note,,,,,
,,,,,,,
Watched,Title,Type,Release Date,Phase,Seasons/Episodes,First Watch,Additional Watches
TRUE,Dark Phoenix,Movie,6/7/2019,X-Men,—,2010,03/14/2024
FALSE,Iron Man,Movie,5/2/2008,Infinity Saga,—,,
FALSE,Spider-Man,Movie,5/3/2002,Spider Man,—,,
TRUE,Agents of S.H.I.E.L.D.,TV Series,9/24/2013,Infinity Saga,"3 seasons, 66 eps",02/20/2024,
FALSE,Daredevil,TV Series,4/10/2015,Infinity Saga,"1 season, 13 eps",,
FALSE,Runaways,TV Series,11/21/2017,Infinity Saga,"1 season, 10 eps",,
FALSE,Ms. Marvel,TV Series,6/8/2022,Multiverse Saga,"1 season, 6 eps",,
FALSE,Your Friendly Neighborhood Spider-Man,TV Series,1/29/2025,Multiverse Saga,S1: 10 eps; S2: Fall 2026 (TBA),,
FALSE,Werewolf by Night,Special,10/7/2022,Multiverse Saga,"Special, 1 ep",,
`
const SERIES = `Watched,Show,Season,Episodes,Premiere / Notes,Completion Date,Additional watches
TRUE,Agents of S.H.I.E.L.D.,Season 1,22,9/24/2013,2017,01/03 - 01/12/2024
TRUE,Agents of S.H.I.E.L.D.,Season 2,22,9/23/2014,2017,01/13 - 02/01/2024
TRUE,Agents of S.H.I.E.L.D.,Season 3,22,9/29/2015,,02/02 - 02/20/2024
FALSE,Daredevil,Season 1,13,4/10/2015,,
FALSE,Runaways,Season 1,10,11/21/2017,2018?,
FALSE,Ms. Marvel,Season 1,6,6/8/2022,2019 - ,
FALSE,Your Friendly Neighborhood Spider-Man,Season 1,10,1/29/2025,,
FALSE,Your Friendly Neighborhood Spider-Man,Season 2,TBA,Fall 2026 (TBA),,
`

describe('slugify / titleId', () => {
  it('makes stable, readable ids', () => {
    expect(slugify('Cloak & Dagger')).toBe('cloak-and-dagger')
    expect(slugify("A Funny Thing Happened on the Way to Thor's Hammer")).toBe('a-funny-thing-happened-on-the-way-to-thors-hammer')
    expect(slugify('Thunderbolts*')).toBe('thunderbolts')
    expect(titleId('The Punisher', '1989')).toBe('the-punisher-1989')
    expect(titleId('The Punisher', '2004-04-16')).toBe('the-punisher-2004')
  })
})

describe('buildFromSheet', () => {
  const overrides = {
    Runaways: { 1: 'checked' as const },
    'Ms. Marvel': { 1: [{ start: '2022', end: null, approximate: false }] },
  }
  const run = () => buildFromSheet(MAIN, SERIES, new Date('2026-10-16T12:00:00Z'), { strict: false, overrides })
  const watchesFor = (id: string) =>
    run().privateData.watches.filter((w) => (w.seasonId ?? w.titleId) === id).map((w) => [w.startDate, w.endDate, w.approximate])

  it('imports movies with rewatches, one sitting each', () => {
    expect(watchesFor('dark-phoenix-2019')).toEqual([
      ['2010', '2010', false],
      ['2024-03-14', '2024-03-14', false],
    ])
  })
  it('skips unchecked movies', () => {
    expect(watchesFor('spider-man-2002')).toEqual([])
  })
  it('splits MCU canon from other Marvel', () => {
    const u = Object.fromEntries(run().catalog.titles.map((t) => [t.id, t.universe]))
    expect(u['iron-man-2008']).toBe('mcu')
    expect(u['daredevil-2015']).toBe('mcu')
    expect(u['runaways-2017']).toBe('other')
    expect(u['agents-of-s-h-i-e-l-d-2013']).toBe('other')
    expect(u['spider-man-2002']).toBe('other')
  })
  it('normalizes saga names and assigns phases', () => {
    const t = run().catalog.titles
    expect(t.find((x) => x.id === 'spider-man-2002')?.saga).toBe('Spider-Man')
    expect(t.find((x) => x.id === 'iron-man-2008')?.phase).toBe(1)
    expect(t.find((x) => x.id === 'werewolf-by-night-2022')?.type).toBe('special')
  })
  it('takes series watches from the Series Tracker, including rewatch ranges', () => {
    expect(watchesFor('agents-of-s-h-i-e-l-d-2013-s1')).toEqual([
      [null, '2017', false],
      ['2024-01-03', '2024-01-12', false],
    ])
    expect(watchesFor('agents-of-s-h-i-e-l-d-2013-s3')).toEqual([['2024-02-02', '2024-02-20', false]])
  })
  it('warns about unchecked rows with dates instead of importing them', () => {
    const { warnings } = buildFromSheet(MAIN, SERIES, new Date(), { strict: false })
    expect(warnings).toContain('Runaways Season 1: unchecked but has watch dates; dates skipped')
  })
  it('applies watch overrides', () => {
    expect(watchesFor('runaways-2017-s1')).toEqual([[null, '2018', true]])
    expect(watchesFor('ms-marvel-2022-s1')).toEqual([['2022', null, false]])
  })
  it('handles TBA seasons and the updated premiere date', () => {
    const s2 = run().catalog.seasons.find((s) => s.id === 'your-friendly-neighborhood-spider-man-2025-s2')
    expect(s2).toMatchObject({ episodeCount: null, premiereDate: '2027-01-13', phase: 6 })
  })
  it('appends extra titles and seasons', () => {
    const { catalog } = run()
    expect(catalog.titles.some((t) => t.id === 'i-am-groot-2022' && t.universe === 'mcu')).toBe(true)
    expect(catalog.titles.some((t) => t.id === 'venom-2018' && t.universe === 'other')).toBe(true)
  })
  it('keeps personal data out of the public catalog', () => {
    const text = JSON.stringify(run().catalog)
    expect(text).not.toMatch(/startDate|endDate|watches|"watched"/i)
  })
})
