import { mergeData } from '../lib/privateData.ts'
import type { PrivateData } from '../lib/types.ts'
import type { WatchlistStore } from '../store/watchlistStore.ts'
import { SyncError, type RemoteApi, type SyncErrorKind, type SyncTarget } from './github.ts'

export interface SyncConfig extends SyncTarget {
  deviceName: string
}

/** Remembered per device: where to sync, and the last file version this device saw. */
export interface SyncMeta {
  config: SyncConfig | null
  sha: string | null
  /**
   * Edits made here that GitHub doesn't have yet. A flag rather than a timestamp comparison, so a
   * device whose clock runs fast can't hide another device's edits.
   */
  dirty: boolean
  lastSyncedAt: string | null
}

export interface MetaStore {
  load(): SyncMeta
  save(meta: SyncMeta): void
}

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'pending' | 'offline' | 'error'

export interface SyncState {
  status: SyncStatus
  lastSyncedAt: string | null
  error: string | null
  errorKind: SyncErrorKind | null
  config: Omit<SyncConfig, 'token'> | null
}

const EMPTY_META: SyncMeta = { config: null, sha: null, dirty: false, lastSyncedAt: null }
const MAX_CONFLICT_RETRIES = 3

export function localStorageMeta(key = 'watchlist.sync.v1'): MetaStore {
  return {
    load() {
      try {
        return { ...EMPTY_META, ...JSON.parse(localStorage.getItem(key) ?? '{}') }
      } catch {
        return EMPTY_META
      }
    },
    save(meta) {
      try {
        localStorage.setItem(key, JSON.stringify(meta))
      } catch {
        // Sync still works for this visit; setup is asked again next time.
      }
    },
  }
}

/** Content equality, ignoring order and the top-level timestamp. */
export function sameContent(a: PrivateData, b: PrivateData): boolean {
  const canon = (d: PrivateData) =>
    JSON.stringify({
      w: [...d.watches].sort((x, y) => x.id.localeCompare(y.id)),
      t: [...d.customTitles].sort((x, y) => x.id.localeCompare(y.id)),
      s: [...d.customSeasons].sort((x, y) => x.id.localeCompare(y.id)),
      o: Object.fromEntries(Object.entries(d.titleOverrides).sort(([x], [y]) => x.localeCompare(y))),
    })
  return canon(a) === canon(b)
}

export interface SyncEngine {
  getState(): SyncState
  subscribe(listener: () => void): () => void
  /** Checks the repo is private and reachable, then syncs for the first time. */
  connect(config: SyncConfig): Promise<void>
  /** Forgets the access key on this device. Local data stays. */
  disconnect(): void
  syncNow(): Promise<void>
  /** Starts listening for edits, focus and reconnects. Returns a stop function. */
  start(): () => void
}

export function createSyncEngine(
  store: WatchlistStore,
  api: RemoteApi,
  metaStore: MetaStore,
  opts: { debounceMs?: number; clock?: () => Date; isOnline?: () => boolean } = {},
): SyncEngine {
  const debounceMs = opts.debounceMs ?? 3000
  const clock = opts.clock ?? (() => new Date())
  const isOnline = opts.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine))

  let meta = metaStore.load()
  const publicConfig = (c: SyncConfig | null) => (c ? { owner: c.owner, repo: c.repo, path: c.path, deviceName: c.deviceName } : null)
  let state: SyncState = {
    status: meta.config ? (hasLocalChanges() ? 'pending' : 'synced') : 'off',
    lastSyncedAt: meta.lastSyncedAt,
    error: null,
    errorKind: null,
    config: publicConfig(meta.config),
  }
  const listeners = new Set<() => void>()
  const set = (patch: Partial<SyncState>) => {
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
  }
  const saveMeta = (patch: Partial<SyncMeta>) => {
    meta = { ...meta, ...patch }
    metaStore.save(meta)
  }

  function hasLocalChanges() {
    return meta.dirty || meta.sha === null
  }

  let running: Promise<void> | null = null
  let again = false
  /** Bumped on every local edit, so a sync knows whether edits landed while it was running. */
  let editSeq = 0
  let applyingSync = false
  let lastData = store.getState().data
  store.subscribe(() => {
    const data = store.getState().data
    if (data === lastData) return
    lastData = data
    if (applyingSync) return
    editSeq++
    if (meta.config && !meta.dirty) saveMeta({ dirty: true })
    onLocalEdit?.()
  })
  let onLocalEdit: (() => void) | undefined

  async function syncOnce(config: SyncConfig): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      const remote = await api.getFile(config)
      const local = store.getState().data
      const merged = remote ? mergeData(local, remote.data) : local

      if (!sameContent(merged, local)) {
        applyingSync = true
        try {
          store.applySynced(merged)
        } finally {
          applyingSync = false
        }
      }
      if (remote && sameContent(merged, remote.data)) {
        saveMeta({ sha: remote.sha })
        return
      }
      try {
        const sha = await api.putFile(config, merged, remote?.sha ?? null, `Update watchlist from ${config.deviceName}`)
        saveMeta({ sha })
        return
      } catch (e) {
        // Someone else saved between our read and write: read again and re-merge.
        if (e instanceof SyncError && e.kind === 'conflict' && attempt < MAX_CONFLICT_RETRIES) continue
        throw e
      }
    }
  }

  async function syncNow(): Promise<void> {
    const config = meta.config
    if (!config) return
    if (running) {
      again = true
      return running
    }
    if (!isOnline()) {
      set({ status: 'offline' })
      return
    }
    set({ status: 'syncing', error: null, errorKind: null })
    const seqAtStart = editSeq
    running = (async () => {
      try {
        await syncOnce(config)
        if (editSeq === seqAtStart) saveMeta({ dirty: false })
        const now = clock().toISOString()
        saveMeta({ lastSyncedAt: now })
        set({ status: hasLocalChanges() ? 'pending' : 'synced', lastSyncedAt: now })
      } catch (e) {
        const err = e instanceof SyncError ? e : new SyncError('other', (e as Error).message)
        set({ status: err.kind === 'network' ? 'offline' : 'error', error: err.message, errorKind: err.kind })
      } finally {
        running = null
      }
      if (again) {
        again = false
        await syncNow()
      }
    })()
    return running
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async connect(config) {
      set({ status: 'syncing', error: null, errorKind: null })
      try {
        await api.checkRepo(config)
      } catch (e) {
        const err = e instanceof SyncError ? e : new SyncError('other', (e as Error).message)
        set({ status: meta.config ? state.status : 'off', error: err.message, errorKind: err.kind })
        throw err
      }
      // A new repo or file means this device hasn't seen any of it yet.
      saveMeta({ config, sha: null, dirty: true })
      set({ config: publicConfig(config) })
      await syncNow()
    },
    disconnect() {
      saveMeta({ ...EMPTY_META })
      set({ status: 'off', config: null, error: null, errorKind: null, lastSyncedAt: null })
    },
    syncNow,
    start() {
      let timer: ReturnType<typeof setTimeout> | undefined
      onLocalEdit = () => {
        if (!meta.config) return
        if (state.status !== 'syncing') set({ status: 'pending' })
        clearTimeout(timer)
        timer = setTimeout(() => void syncNow(), debounceMs)
      }
      const onVisible = () => document.visibilityState === 'visible' && void syncNow()
      const onOnline = () => void syncNow()
      if (typeof window !== 'undefined') {
        document.addEventListener('visibilitychange', onVisible)
        window.addEventListener('online', onOnline)
      }
      void syncNow()
      return () => {
        clearTimeout(timer)
        onLocalEdit = undefined
        if (typeof window !== 'undefined') {
          document.removeEventListener('visibilitychange', onVisible)
          window.removeEventListener('online', onOnline)
        }
      }
    },
  }
}
