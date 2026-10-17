import { describe, expect, it } from 'vitest'
import { buildTitleViews } from './catalogView.ts'
import { mergeData, parsePrivateData } from './privateData.ts'
import type { Catalog, Title } from './types.ts'
import { emptyData, resetGroupPlacement, revertTo, setGroupPlacement, type EditContext } from './watchActions.ts'

const t = (id: string, over: Partial<Title>): Title => ({
  id, title: id, type: 'movie', releaseDate: '2000-07-14', universe: 'other', saga: 'X-Men',
  phase: null, chronoIndex: null, studio: '20th Century Fox', tmdbId: null, posterPath: null, ...over,
})
const catalog: Catalog = {
  schemaVersion: 1,
  generatedAt: '',
  titles: [
    t('x-men-2000', { collection: 'fox-xmen' }),
    t('daredevil-2015', { type: 'series', universe: 'mcu', collection: 'netflix', saga: 'Infinity Saga' }),
    t('iron-man-2008', { universe: 'mcu', collection: 'marvel-studios', saga: 'Infinity Saga' }),
  ],
  seasons: [],
}
let n = 0
const ctx = (): EditContext => ({ now: `2026-10-17T00:00:${String(++n).padStart(2, '0')}Z`, newId: () => `id${n}` })
const universeOf = (d: ReturnType<typeof emptyData>) => Object.fromEntries(buildTitleViews(catalog, d, '2026-10-17').map((v) => [v.title.id, v.title.universe]))

describe('group placement', () => {
  it('follows the catalog until you choose', () => {
    expect(universeOf(emptyData(''))).toEqual({ 'x-men-2000': 'other', 'daredevil-2015': 'mcu', 'iron-man-2008': 'mcu' })
  })

  it('moves a whole group, and back', () => {
    let d = setGroupPlacement(emptyData(''), ctx(), 'fox-xmen', 'mcu')
    d = setGroupPlacement(d, ctx(), 'netflix', 'other')
    expect(universeOf(d)).toEqual({ 'x-men-2000': 'mcu', 'daredevil-2015': 'other', 'iron-man-2008': 'mcu' })
    d = resetGroupPlacement(d, ctx())
    expect(universeOf(d)['x-men-2000']).toBe('other')
  })

  it('syncs the newest choice', () => {
    const phone = setGroupPlacement(emptyData(''), ctx(), 'fox-xmen', 'mcu')
    const pc = setGroupPlacement(emptyData(''), ctx(), 'fox-xmen', 'other')
    expect(mergeData(phone, pc).groupPlacement?.values).toEqual({ 'fox-xmen': 'other' })
    expect(mergeData(pc, phone).groupPlacement?.values).toEqual({ 'fox-xmen': 'other' })
    expect(mergeData(emptyData(''), phone).groupPlacement?.values).toEqual({ 'fox-xmen': 'mcu' })
  })

  it('undo restores the earlier choice as a newer edit', () => {
    const before = emptyData('')
    const moved = setGroupPlacement(before, ctx(), 'fox-xmen', 'mcu')
    const undone = revertTo(moved, before, ctx())
    expect(undone.groupPlacement?.values).toEqual({})
    // Another device that synced the move gets the undo.
    expect(mergeData(moved, undone).groupPlacement?.values).toEqual({})
  })

  it('survives export and import', () => {
    const d = setGroupPlacement(emptyData('2026-01-01T00:00:00Z'), ctx(), 'sony-spider-man', 'mcu')
    expect(parsePrivateData(JSON.parse(JSON.stringify(d))).groupPlacement?.values).toEqual({ 'sony-spider-man': 'mcu' })
  })
})
