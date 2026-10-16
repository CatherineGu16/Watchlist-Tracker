import { describe, expect, it } from 'vitest'
import { mergeData, parsePrivateData } from './privateData.ts'
import type { PrivateData, Watch } from './types.ts'
import { emptyData } from './watchActions.ts'

const w = (id: string, updatedAt: string, over: Partial<Watch> = {}): Watch => ({
  id,
  titleId: 't',
  seasonId: null,
  startDate: '2020',
  endDate: '2020',
  approximate: false,
  episodesWatched: null,
  note: '',
  createdAt: updatedAt,
  updatedAt,
  ...over,
})
const data = (watches: Watch[], over: Partial<PrivateData> = {}): PrivateData => ({ ...emptyData('2026-01-01T00:00:00Z'), watches, ...over })

describe('mergeData', () => {
  it('keeps watches from both sides and the newer edit of shared ones', () => {
    const a = data([w('1', '2026-01-01', { endDate: '2020' }), w('2', '2026-01-01')])
    const b = data([w('1', '2026-02-01', { endDate: '2021' }), w('3', '2026-01-01')])
    const m = mergeData(a, b)
    expect(m.watches.map((x) => x.id).sort()).toEqual(['1', '2', '3'])
    expect(m.watches.find((x) => x.id === '1')?.endDate).toBe('2021')
  })
  it('lets a newer delete win, and a newer edit beat an older delete', () => {
    expect(mergeData(data([w('1', '2026-01-01')]), data([w('1', '2026-02-01', { deleted: true })])).watches[0].deleted).toBe(true)
    expect(mergeData(data([w('1', '2026-01-01', { deleted: true })]), data([w('1', '2026-02-01')])).watches[0].deleted).toBeUndefined()
  })
  it('is order-independent', () => {
    const a = data([w('1', '2026-01-01'), w('2', '2026-03-01', { endDate: '2023' })])
    const b = data([w('1', '2026-02-01', { endDate: '2022' }), w('2', '2026-01-01')])
    const sort = (d: PrivateData) => [...d.watches].sort((x, y) => x.id.localeCompare(y.id))
    expect(sort(mergeData(a, b))).toEqual(sort(mergeData(b, a)))
  })
  it('merges overrides per title', () => {
    const a = data([], { titleOverrides: { x: { universe: 'other' } } })
    const b = data([], { titleOverrides: { x: { saga: 'X-Men' } } })
    expect(mergeData(a, b).titleOverrides.x).toEqual({ universe: 'other', saga: 'X-Men' })
  })
})

describe('parsePrivateData', () => {
  it('accepts an exported file and fills optional fields', () => {
    const raw = JSON.parse(JSON.stringify(data([w('1', '2026-01-01')])))
    delete raw.watches[0].note
    delete raw.customTitles
    const parsed = parsePrivateData(raw)
    expect(parsed.watches[0].note).toBe('')
    expect(parsed.customTitles).toEqual([])
  })
  it('rejects files that are not backups', () => {
    expect(() => parsePrivateData([])).toThrow(/backup/)
    expect(() => parsePrivateData({ schemaVersion: 2, watches: [] })).toThrow(/version/)
    expect(() => parsePrivateData({ schemaVersion: 1 })).toThrow(/watches/)
    expect(() => parsePrivateData({ schemaVersion: 1, watches: [{ ...w('1', 'x'), endDate: 'last week' }] })).toThrow(/bad date/)
    expect(() => parsePrivateData({ schemaVersion: 1, watches: [{ titleId: 't' }] })).toThrow(/no id/)
  })
})
