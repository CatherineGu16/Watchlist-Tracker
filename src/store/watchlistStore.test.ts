import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it, vi } from 'vitest'
import { checkOff } from '../lib/watchActions.ts'
import { indexedDbBackend, memoryBackend, type StorageBackend } from './storage.ts'
import { createWatchlistStore } from './watchlistStore.ts'

let n = 0
const newId = () => `id${++n}`
const clock = () => new Date('2026-10-16T12:00:00Z')
const tick = (titleId: string) => (d: Parameters<typeof checkOff>[0], c: Parameters<typeof checkOff>[1]) => checkOff(d, c, titleId, '2026-10-16')

describe('watchlist store', () => {
  it('survives a reload (new store, same IndexedDB)', async () => {
    const factory = new IDBFactory()
    const first = createWatchlistStore(indexedDbBackend(factory), clock, newId)
    await first.init()
    first.apply(tick('iron-man-2008'), 'Checked off Iron Man')
    first.apply(tick('thor-2011'), 'Checked off Thor')
    await first.flush()
    expect(first.getState().saveState).toBe('saved')

    const reloaded = createWatchlistStore(indexedDbBackend(factory), clock, newId)
    await reloaded.init()
    expect(reloaded.getState().data.watches.map((w) => w.titleId)).toEqual(['iron-man-2008', 'thor-2011'])
  })

  it('coalesces bursts of edits into few writes, ending with the latest data', async () => {
    const backend = memoryBackend()
    const save = vi.spyOn(backend, 'save')
    const store = createWatchlistStore(backend, clock, newId)
    await store.init()
    for (let i = 0; i < 10; i++) store.apply(tick(`t${i}`), 'x')
    await store.flush()
    expect(save.mock.calls.length).toBeLessThanOrEqual(2)
    expect((await backend.load())?.watches).toHaveLength(10)
  })

  it('undo reverts the last edit and saves it', async () => {
    const backend = memoryBackend()
    const store = createWatchlistStore(backend, clock, newId)
    await store.init()
    store.apply(tick('a'), 'Checked off A')
    store.apply(tick('b'), 'Checked off B')
    expect(store.getState().undoLabel).toBe('Checked off B')
    store.undo()
    await store.flush()
    const live = (await backend.load())!.watches.filter((w) => !w.deleted)
    expect(live.map((w) => w.titleId)).toEqual(['a'])
    expect(store.getState().undoLabel).toBe('Checked off A')
  })

  it('reports save failures without losing the change on screen', async () => {
    const failing: StorageBackend = { kind: 'indexeddb', load: async () => null, save: async () => Promise.reject(new Error('quota')) }
    const store = createWatchlistStore(failing, clock, newId)
    await store.init()
    store.apply(tick('a'), 'x')
    await store.flush()
    expect(store.getState()).toMatchObject({ saveState: 'error', error: expect.stringContaining('quota') })
    expect(store.getState().data.watches).toHaveLength(1)
  })

  it('keeps an edit that throws from changing anything', async () => {
    const store = createWatchlistStore(memoryBackend(), clock, newId)
    await store.init()
    store.apply(() => {
      throw new Error('No watch x')
    }, 'bad')
    expect(store.getState()).toMatchObject({ error: 'No watch x', undoLabel: null })
    expect(store.getState().data.watches).toHaveLength(0)
  })

  it('imports by merge or replace', async () => {
    const store = createWatchlistStore(memoryBackend(), clock, newId)
    await store.init()
    store.apply(tick('local'), 'x')
    const incoming = { ...store.getState().data, watches: [{ ...store.getState().data.watches[0], id: 'other', titleId: 'remote' }] }
    store.importData(incoming, 'merge')
    expect(store.getState().data.watches.map((w) => w.titleId).sort()).toEqual(['local', 'remote'])
    store.importData(incoming, 'replace')
    expect(store.getState().data.watches.map((w) => w.titleId)).toEqual(['remote'])
  })
})
