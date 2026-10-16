import { describe, expect, it } from 'vitest'
import {
  checkOff,
  deleteWatch,
  emptyData,
  finishWatch,
  logWatch,
  revertTo,
  setEpisodes,
  startSeason,
  updateWatch,
  type EditContext,
} from './watchActions.ts'

const ctxAt = (now: string, ids = ['a', 'b', 'c', 'd']): EditContext => {
  let i = 0
  return { now, newId: () => ids[i++] }
}
const T0 = '2026-10-16T10:00:00.000Z'
const T1 = '2026-10-16T11:00:00.000Z'

describe('watch actions', () => {
  it('checks off a movie for today', () => {
    const d = checkOff(emptyData(T0), ctxAt(T0), 'iron-man-2008', '2026-10-16')
    expect(d.watches).toEqual([
      expect.objectContaining({ id: 'a', titleId: 'iron-man-2008', seasonId: null, startDate: '2026-10-16', endDate: '2026-10-16', createdAt: T0, updatedAt: T0 }),
    ])
    expect(d.updatedAt).toBe(T0)
  })

  it('starts, counts episodes, and finishes a season', () => {
    let d = startSeason(emptyData(T0), ctxAt(T0), 'loki-2021', 'loki-2021-s1', '2026-10-01')
    expect(d.watches[0]).toMatchObject({ startDate: '2026-10-01', endDate: null, episodesWatched: 0 })
    d = setEpisodes(d, ctxAt(T1), 'a', 9, 6)
    expect(d.watches[0].episodesWatched).toBe(6) // clamped to the season's episode count
    d = setEpisodes(d, ctxAt(T1), 'a', -1, 6)
    expect(d.watches[0].episodesWatched).toBe(0)
    d = finishWatch(d, ctxAt(T1), 'a', '2026-10-16')
    expect(d.watches[0]).toMatchObject({ endDate: '2026-10-16', episodesWatched: null, updatedAt: T1 })
  })

  it('edits dates and refuses unknown or deleted watches', () => {
    let d = checkOff(emptyData(T0), ctxAt(T0), 't', '2026-10-16')
    d = updateWatch(d, ctxAt(T1), 'a', { startDate: '2021', endDate: '2021', approximate: true })
    expect(d.watches[0]).toMatchObject({ startDate: '2021', endDate: '2021', approximate: true, updatedAt: T1 })
    expect(() => updateWatch(d, ctxAt(T1), 'nope', {})).toThrow()
    d = deleteWatch(d, ctxAt(T1), 'a')
    expect(() => updateWatch(d, ctxAt(T1), 'a', {})).toThrow()
  })

  it('deletes with a tombstone', () => {
    let d = checkOff(emptyData(T0), ctxAt(T0), 't', '2026-10-16')
    d = deleteWatch(d, ctxAt(T1), 'a')
    expect(d.watches[0]).toMatchObject({ id: 'a', deleted: true, updatedAt: T1 })
  })

  it('undo restores the snapshot as fresh edits', () => {
    const base = logWatch(emptyData(T0), ctxAt(T0, ['keep']), { titleId: 't', startDate: '2020', endDate: '2020' })
    let d = updateWatch(base, ctxAt(T1), 'keep', { endDate: '2021' })
    d = checkOff(d, ctxAt(T1, ['added']), 'u', '2026-10-16')

    const T2 = '2026-10-16T12:00:00.000Z'
    const undone = revertTo(d, base, ctxAt(T2))
    const byId = Object.fromEntries(undone.watches.map((w) => [w.id, w]))
    expect(byId.keep).toMatchObject({ endDate: '2020', updatedAt: T2 })
    expect(byId.added).toMatchObject({ deleted: true, updatedAt: T2 })
  })
})
