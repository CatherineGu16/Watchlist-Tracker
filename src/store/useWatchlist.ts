import { useMemo, useSyncExternalStore } from 'react'
import catalogJson from '../data/catalog.json'
import { buildTitleViews } from '../lib/catalogView.ts'
import { todayIso } from '../lib/partialDate.ts'
import type { Catalog } from '../lib/types.ts'
import { defaultBackend, requestPersistence } from './storage.ts'
import { createWatchlistStore, type WatchlistStore } from './watchlistStore.ts'

export const catalog = catalogJson as Catalog

let storePromise: Promise<WatchlistStore> | null = null

/** Opens device storage once per page load. */
export function loadStore(): Promise<WatchlistStore> {
  return (storePromise ??= (async () => {
    const store = createWatchlistStore(await defaultBackend())
    await store.init()
    void requestPersistence()
    return store
  })())
}

export function useWatchlistState(store: WatchlistStore) {
  return useSyncExternalStore(store.subscribe, store.getState)
}

export function useTitleViews(store: WatchlistStore) {
  const { data } = useWatchlistState(store)
  const today = todayIso()
  return useMemo(() => buildTitleViews(catalog, data, today), [data, today])
}
