import { describe, expect, it } from 'vitest'
import { buildTitleViews } from './catalogView.ts'
import { addCustomTitle, addSeason, deleteCustomSeason, deleteCustomTitle, newCustomTitleId, updateCustomSeason, updateCustomTitle, type TitleInput } from './customTitles.ts'
import { mergeData, parsePrivateData } from './privateData.ts'
import type { Catalog, Title } from './types.ts'
import { checkOff, emptyData, revertTo, type EditContext } from './watchActions.ts'

let tick = 0
const ctx = (): EditContext => {
  tick++
  let n = 0
  return { now: `2026-10-16T10:00:${String(tick).padStart(2, '0')}Z`, newId: () => `abcdef${tick}${n++}-xyz` }
}

const catalogShow: Title = {
  id: 'loki-2021', title: 'Loki', type: 'series', releaseDate: '2021-06-09', universe: 'mcu', saga: 'Multiverse Saga',
  phase: 4, chronoIndex: null, studio: 'Marvel Studios', tmdbId: null, posterPath: null,
}
const catalog: Catalog = {
  schemaVersion: 1,
  generatedAt: '',
  titles: [catalogShow],
  seasons: [
    { id: 'loki-2021-s1', titleId: 'loki-2021', number: 1, label: 'Season 1', episodeCount: 6, premiereDate: '2021-06-09', phase: 4 },
    { id: 'loki-2021-s2', titleId: 'loki-2021', number: 2, label: 'Season 2', episodeCount: 6, premiereDate: '2023-10-05', phase: 5 },
  ],
}

const movie: TitleInput = {
  title: '  Blade  ', type: 'movie', releaseDate: '2027', universe: 'mcu', saga: 'Multiverse Saga', phase: 6, studio: 'Marvel Studios', note: '',
}
const views = (d: ReturnType<typeof emptyData>) => buildTitleViews(catalog, d, '2026-10-16')

describe('custom titles', () => {
  it('makes ids that never collide with the catalog', () => {
    expect(newCustomTitleId('Spider-Man: Beyond the Spider-Verse', () => '1234abcd-ef')).toBe('custom-spider-man-beyond-the-spider-verse-1234abcd')
  })

  it('adds a movie and shows it with the catalog', () => {
    const d = addCustomTitle(emptyData(''), ctx(), 'custom-blade-1', movie)
    const v = views(d).find((x) => x.title.id === 'custom-blade-1')!
    expect(v.title).toMatchObject({ title: 'Blade', custom: true, phase: 6, universe: 'mcu' })
    expect(v.summary.status).toBe('upcoming')
  })

  it('adds a show with numbered seasons', () => {
    const d = addCustomTitle(emptyData(''), ctx(), 'custom-x', { ...movie, title: 'X-Men 97', type: 'series', universe: 'other', saga: 'X-Men', phase: 4 }, [
      { episodeCount: 10, premiereDate: '2024-03-20' },
      { episodeCount: null, premiereDate: null },
    ])
    const v = views(d).find((x) => x.title.id === 'custom-x')!
    expect(v.title.phase).toBeNull() // phases are MCU-only
    expect(v.seasons.map((s) => [s.number, s.label, s.episodeCount, s.premiereDate])).toEqual([
      [1, 'Season 1', 10, '2024-03-20'],
      [2, 'Season 2', null, null],
    ])
  })

  it('season 1 with no date premieres with the show; later undated seasons stay upcoming', () => {
    const d = addCustomTitle(emptyData(''), ctx(), 'custom-y', { ...movie, type: 'series', releaseDate: '2024-01-10' }, [
      { episodeCount: 8, premiereDate: null },
      { episodeCount: 8, premiereDate: null },
    ])
    const v = views(d).find((x) => x.title.id === 'custom-y')!
    expect(v.seasons.map((s) => s.premiereDate)).toEqual(['2024-01-10', null])
    expect(v.summary).toMatchObject({ status: 'unwatched', seasonsReleased: 1 })
  })

  it('refuses a title with no name', () => {
    expect(() => addCustomTitle(emptyData(''), ctx(), 'x', { ...movie, title: '   ' })).toThrow(/name/)
  })

  it('edits only titles you added', () => {
    let d = addCustomTitle(emptyData(''), ctx(), 'custom-blade-1', movie)
    d = updateCustomTitle(d, ctx(), 'custom-blade-1', { ...movie, title: 'Blade (2027)', releaseDate: '2027-11-05' })
    expect(views(d).find((x) => x.title.id === 'custom-blade-1')?.title).toMatchObject({ title: 'Blade (2027)', releaseDate: '2027-11-05' })
    expect(() => updateCustomTitle(d, ctx(), 'loki-2021', movie)).toThrow(/added/)
  })

  it('deleting a title also removes its seasons and watches', () => {
    let d = addCustomTitle(emptyData(''), ctx(), 'custom-x', { ...movie, type: 'series' }, [{ episodeCount: 6, premiereDate: '2020' }])
    const seasonId = d.customSeasons[0].id
    d = checkOff(d, ctx(), 'custom-x', '2026-10-16', seasonId)
    d = deleteCustomTitle(d, ctx(), 'custom-x')
    expect(views(d).some((x) => x.title.id === 'custom-x')).toBe(false)
    expect(d.customSeasons[0].deleted).toBe(true)
    expect(d.watches[0].deleted).toBe(true)
  })
})

describe('adding seasons', () => {
  it('adds the next season to a catalog show', () => {
    const d = addSeason(emptyData(''), ctx(), catalogShow, catalog.seasons, { episodeCount: 6, premiereDate: '2027-06' })
    const v = views(d)[0]
    expect(v.seasons.map((s) => s.label)).toEqual(['Season 1', 'Season 2', 'Season 3'])
    expect(v.seasons[2]).toMatchObject({ custom: true, phase: 4 })
    // An announced season doesn't make the show "in progress" until it premieres.
    expect(v.summary.seasonsReleased).toBe(2)
  })

  it('numbers past seasons you deleted only from what is left', () => {
    let d = addSeason(emptyData(''), ctx(), catalogShow, catalog.seasons, { episodeCount: 6, premiereDate: null })
    d = deleteCustomSeason(d, ctx(), d.customSeasons[0].id)
    d = addSeason(d, ctx(), catalogShow, catalog.seasons, { episodeCount: 8, premiereDate: null })
    expect(views(d)[0].seasons.map((s) => s.number)).toEqual([1, 2, 3])
  })

  it('edits a season you added, and not catalog ones', () => {
    let d = addSeason(emptyData(''), ctx(), catalogShow, catalog.seasons, { episodeCount: null, premiereDate: null })
    d = updateCustomSeason(d, ctx(), d.customSeasons[0].id, { episodeCount: 8, premiereDate: '2027-06-01' })
    expect(views(d)[0].seasons[2]).toMatchObject({ episodeCount: 8, premiereDate: '2027-06-01' })
    expect(() => updateCustomSeason(d, ctx(), 'loki-2021-s1', { episodeCount: 1, premiereDate: null })).toThrow()
  })
})

describe('sync and undo for custom titles', () => {
  it('merges edits newest-first and keeps deletes', () => {
    const base = addCustomTitle(emptyData(''), ctx(), 'custom-blade-1', movie)
    const phone = updateCustomTitle(base, ctx(), 'custom-blade-1', { ...movie, title: 'Blade (phone)' })
    const pc = deleteCustomTitle(base, ctx(), 'custom-blade-1')
    expect(mergeData(phone, pc).customTitles[0].deleted).toBe(true)
    const later = updateCustomTitle(phone, ctx(), 'custom-blade-1', { ...movie, title: 'Blade (later)' })
    expect(mergeData(later, base).customTitles[0].title).toBe('Blade (later)')
  })

  it('undoing an add leaves a tombstone, so another device that synced it removes it too', () => {
    const before = emptyData('')
    const added = addCustomTitle(before, ctx(), 'custom-blade-1', movie)
    const undone = revertTo(added, before, ctx())
    expect(undone.customTitles[0]).toMatchObject({ id: 'custom-blade-1', deleted: true })
    expect(mergeData(added, undone).customTitles[0].deleted).toBe(true)
  })

  it('import keeps valid custom titles and drops malformed ones', () => {
    const d = addCustomTitle(emptyData('2026-01-01T00:00:00Z'), ctx(), 'custom-blade-1', movie)
    const raw = JSON.parse(JSON.stringify({ ...d, customTitles: [...d.customTitles, { id: 'bad' }] }))
    expect(parsePrivateData(raw).customTitles.map((t) => t.id)).toEqual(['custom-blade-1'])
  })
})
