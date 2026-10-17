import { describe, expect, it } from 'vitest'
import type { PrivateData } from '../lib/types.ts'
import { checkOff, deleteWatch, setGroupPlacement, updateWatch } from '../lib/watchActions.ts'
import { memoryBackend } from '../store/storage.ts'
import { createWatchlistStore } from '../store/watchlistStore.ts'
import { SyncError, type RemoteApi, type SyncTarget } from './github.ts'
import { createSyncEngine, type MetaStore, type SyncConfig, type SyncMeta } from './syncEngine.ts'

/** In-memory GitHub: one file with a version sha that changes on every write. */
function fakeGitHub(opts: { isPrivate?: boolean } = {}) {
  let file: { data: PrivateData; sha: string } | null = null
  let version = 0
  const calls: string[] = []
  /** Runs once, right before the next PUT lands, to simulate another device saving first. */
  let beforeNextPut: (() => void) | null = null
  const api: RemoteApi = {
    async checkRepo(t: SyncTarget) {
      calls.push('check')
      if (t.token !== 'good') throw new SyncError('auth', 'bad key')
      if (opts.isPrivate === false) throw new SyncError('public-repo', 'public')
    },
    async getFile() {
      calls.push('get')
      return file && { data: structuredClone(file.data), sha: file.sha }
    },
    async putFile(_t, data, sha) {
      calls.push('put')
      if (beforeNextPut) {
        const f = beforeNextPut
        beforeNextPut = null
        f()
      }
      if ((file?.sha ?? null) !== sha) throw new SyncError('conflict', 'stale sha')
      file = { data: structuredClone(data), sha: `v${++version}` }
      return file.sha
    },
  }
  return {
    api,
    calls,
    get file() {
      return file
    },
    setFile(data: PrivateData) {
      file = { data: structuredClone(data), sha: `v${++version}` }
    },
    racePut(f: () => void) {
      beforeNextPut = f
    },
  }
}

function memoryMeta(): MetaStore & { meta: SyncMeta | null } {
  return {
    meta: null,
    load() {
      return this.meta ?? { config: null, sha: null, dirty: false, lastSyncedAt: null }
    },
    save(m) {
      this.meta = structuredClone(m)
    },
  }
}

const CONFIG: SyncConfig = { owner: 'me', repo: 'watchlist-data', path: 'watchlist.json', token: 'good', deviceName: 'test' }

let ids = 0
const clockAt = (iso: string) => () => new Date(iso)
async function device(gh: ReturnType<typeof fakeGitHub>, name: string, nowIso = '2026-10-16T12:00:00Z') {
  const store = createWatchlistStore(memoryBackend(), clockAt(nowIso), () => `${name}-${++ids}`)
  await store.init()
  const engine = createSyncEngine(store, gh.api, memoryMeta(), { debounceMs: 0, isOnline: () => true })
  return { store, engine }
}
const tick = (titleId: string) => (d: PrivateData, c: Parameters<typeof checkOff>[1]) => checkOff(d, c, titleId, '2026-10-16')
const live = (d: PrivateData) => d.watches.filter((w) => !w.deleted).map((w) => w.titleId).sort()

describe('sync engine', () => {
  it('creates the file on first connect and reports synced', async () => {
    const gh = fakeGitHub()
    const phone = await device(gh, 'phone')
    phone.store.apply(tick('iron-man'), 'x')
    await phone.engine.connect(CONFIG)
    expect(live(gh.file!.data)).toEqual(['iron-man'])
    expect(phone.engine.getState()).toMatchObject({ status: 'synced', error: null })
  })

  it('carries edits between devices in both directions', async () => {
    const gh = fakeGitHub()
    const phone = await device(gh, 'phone')
    const pc = await device(gh, 'pc')
    phone.store.apply(tick('iron-man'), 'x')
    await phone.engine.connect(CONFIG)
    await pc.engine.connect(CONFIG)
    expect(live(pc.store.getState().data)).toEqual(['iron-man'])

    pc.store.apply(tick('thor'), 'x')
    await pc.engine.syncNow()
    await phone.engine.syncNow()
    expect(live(phone.store.getState().data)).toEqual(['iron-man', 'thor'])
  })

  it('merges offline edits from two devices instead of overwriting', async () => {
    const gh = fakeGitHub()
    const phone = await device(gh, 'phone')
    const pc = await device(gh, 'pc')
    await phone.engine.connect(CONFIG)
    await pc.engine.connect(CONFIG)
    phone.store.apply(tick('loki'), 'x')
    pc.store.apply(tick('hawkeye'), 'x')
    await phone.engine.syncNow()
    await pc.engine.syncNow()
    await phone.engine.syncNow()
    expect(live(gh.file!.data)).toEqual(['hawkeye', 'loki'])
    expect(live(phone.store.getState().data)).toEqual(['hawkeye', 'loki'])
  })

  it('retries when another device saves between read and write', async () => {
    const gh = fakeGitHub()
    const phone = await device(gh, 'phone')
    await phone.engine.connect(CONFIG)
    const other = structuredClone(gh.file!.data)
    phone.store.apply(tick('eternals'), 'x')
    gh.racePut(() => gh.setFile({ ...other, watches: [...other.watches, { ...phone.store.getState().data.watches[0], id: 'pc-1', titleId: 'echo' }] }))
    await phone.engine.syncNow()
    expect(live(gh.file!.data)).toEqual(['echo', 'eternals'])
    expect(phone.engine.getState().status).toBe('synced')
  })

  it('sends deletes and edits made after a sync', async () => {
    const gh = fakeGitHub()
    const phone = await device(gh, 'phone', '2026-10-16T12:00:00Z')
    phone.store.apply(tick('iron-man'), 'x')
    phone.store.apply(tick('thor'), 'x')
    await phone.engine.connect(CONFIG)
    const [a, b] = phone.store.getState().data.watches
    // Later edits need later timestamps to win the merge.
    phone.store.apply((d) => updateWatch(d, { now: '2026-10-16T13:00:00Z', newId: () => 'n' }, a.id, { endDate: '2020' }), 'x')
    phone.store.apply((d) => deleteWatch(d, { now: '2026-10-16T13:00:00Z', newId: () => 'n' }, b.id), 'x')
    await phone.engine.syncNow()
    const remote = gh.file!.data.watches
    expect(remote.find((w) => w.id === a.id)?.endDate).toBe('2020')
    expect(remote.find((w) => w.id === b.id)?.deleted).toBe(true)
  })

  it('syncs a group moved between tabs, even with no other changes', async () => {
    const gh = fakeGitHub()
    const phone = await device(gh, 'phone')
    const pc = await device(gh, 'pc')
    await phone.engine.connect(CONFIG)
    await pc.engine.connect(CONFIG)
    phone.store.apply((d, c) => setGroupPlacement(d, c, 'fox-xmen', 'mcu'), 'x')
    await phone.engine.syncNow()
    expect(gh.file!.data.groupPlacement?.values).toEqual({ 'fox-xmen': 'mcu' })
    await pc.engine.syncNow()
    expect(pc.store.getState().data.groupPlacement?.values).toEqual({ 'fox-xmen': 'mcu' })
  })

  it('does nothing when there is nothing new', async () => {
    const gh = fakeGitHub()
    const phone = await device(gh, 'phone')
    await phone.engine.connect(CONFIG)
    gh.calls.length = 0
    await phone.engine.syncNow()
    expect(gh.calls).toEqual(['get'])
  })

  it('refuses public repos and bad keys without saving the config', async () => {
    const pub = fakeGitHub({ isPrivate: false })
    const a = await device(pub, 'a')
    await expect(a.engine.connect(CONFIG)).rejects.toMatchObject({ kind: 'public-repo' })
    expect(a.engine.getState()).toMatchObject({ status: 'off', config: null, errorKind: 'public-repo' })

    const gh = fakeGitHub()
    const b = await device(gh, 'b')
    await expect(b.engine.connect({ ...CONFIG, token: 'nope' })).rejects.toMatchObject({ kind: 'auth' })
    expect(gh.calls).toEqual(['check'])
  })

  it('reports offline without calling GitHub, then catches up', async () => {
    const gh = fakeGitHub()
    let online = true
    const store = createWatchlistStore(memoryBackend())
    await store.init()
    const engine = createSyncEngine(store, gh.api, memoryMeta(), { debounceMs: 0, isOnline: () => online })
    await engine.connect(CONFIG)
    online = false
    store.apply(tick('moon-knight'), 'x')
    await engine.syncNow()
    expect(engine.getState().status).toBe('offline')
    online = true
    await engine.syncNow()
    expect(live(gh.file!.data)).toEqual(['moon-knight'])
    expect(engine.getState().status).toBe('synced')
  })

  it('keeps the access key out of the reported state', async () => {
    const gh = fakeGitHub()
    const phone = await device(gh, 'phone')
    await phone.engine.connect(CONFIG)
    expect(JSON.stringify(phone.engine.getState())).not.toContain('good')
  })
})
