import { createContext, useContext } from 'react'
import type { WatchlistStore } from './watchlistStore.ts'

export const StoreContext = createContext<WatchlistStore | null>(null)

export function useStore(): WatchlistStore {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore outside StoreContext')
  return store
}
