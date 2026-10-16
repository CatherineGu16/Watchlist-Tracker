import { createContext, useContext } from 'react'
import type { SyncEngine } from '../sync/syncEngine.ts'
import type { WatchlistStore } from './watchlistStore.ts'

export const StoreContext = createContext<WatchlistStore | null>(null)
export const SyncContext = createContext<SyncEngine | null>(null)

export function useStore(): WatchlistStore {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore outside StoreContext')
  return store
}

export function useSync(): SyncEngine {
  const sync = useContext(SyncContext)
  if (!sync) throw new Error('useSync outside SyncContext')
  return sync
}
