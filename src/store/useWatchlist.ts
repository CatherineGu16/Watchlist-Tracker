import { useMemo, useSyncExternalStore } from 'react'
import catalogJson from '../data/catalog.json'
import { buildTitleViews } from '../lib/catalogView.ts'
import { todayIso } from '../lib/partialDate.ts'
import type { Catalog } from '../lib/types.ts'
import { githubApi } from '../sync/github.ts'
import { createSyncEngine, localStorageMeta, type SyncEngine } from '../sync/syncEngine.ts'
import { defaultBackend, requestPersistence } from './storage.ts'
import { createWatchlistStore, type WatchlistStore } from './watchlistStore.ts'

export const catalog = catalogJson as Catalog

export interface AppServices {
  store: WatchlistStore
  sync: SyncEngine
}

let servicesPromise: Promise<AppServices> | null = null

/** Opens device storage and starts GitHub sync (if set up) once per page load. */
export function loadServices(): Promise<AppServices> {
  return (servicesPromise ??= (async () => {
    const store = createWatchlistStore(await defaultBackend())
    await store.init()
    void requestPersistence()
    const sync = createSyncEngine(store, githubApi(), localStorageMeta())
    sync.start()
    return { store, sync }
  })())
}

export function useWatchlistState(store: WatchlistStore) {
  return useSyncExternalStore(store.subscribe, store.getState)
}

export function useSyncState(sync: SyncEngine) {
  return useSyncExternalStore(sync.subscribe, sync.getState)
}

export function useTitleViews(store: WatchlistStore) {
  const { data } = useWatchlistState(store)
  const today = todayIso()
  return useMemo(() => buildTitleViews(catalog, data, today), [data, today])
}
