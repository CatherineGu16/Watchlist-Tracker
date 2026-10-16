import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Header } from './components/Header.tsx'
import { Settings } from './components/Settings.tsx'
import { TitleDetail } from './components/TitleDetail.tsx'
import { TitleList } from './components/TitleList.tsx'
import { ToastProvider } from './components/Toast.tsx'
import { Toolbar } from './components/Toolbar.tsx'
import { StoreContext } from './store/StoreContext.tsx'
import { loadStore, useTitleViews, useWatchlistState } from './store/useWatchlist.ts'
import type { WatchlistStore } from './store/watchlistStore.ts'
import { DEFAULT_QUERY, activeFilterCount, filterViews, groupViews, phasesIn, sagasIn, sortViews, type ListQuery } from './ui/listQuery.ts'
import { useActions } from './ui/useActions.ts'
import { usePersistentState } from './ui/usePersistentState.ts'

export default function App() {
  const [store, setStore] = useState<WatchlistStore | null>(null)
  useEffect(() => {
    void loadStore().then(setStore)
  }, [])

  if (!store) return <p className="p-6 text-muted">Loading…</p>
  return (
    <StoreContext.Provider value={store}>
      <ToastProvider>
        <Shell store={store} />
      </ToastProvider>
    </StoreContext.Provider>
  )
}

/** Remembered per device, except the search text. */
const reviveQuery = (s: unknown): ListQuery => ({ ...DEFAULT_QUERY, ...(s as Partial<ListQuery>), search: '' })

function Shell({ store }: { store: WatchlistStore }) {
  const state = useWatchlistState(store)
  const views = useTitleViews(store)
  const [query, setQuery] = usePersistentState<ListQuery>('watchlist.query.v1', DEFAULT_QUERY, reviveQuery)
  const [openId, setOpenId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const actions = useActions(useCallback((id: string) => setOpenId(id), []))

  const deferred = useDeferredValue(query)
  const filtered = useMemo(() => filterViews(views, deferred), [views, deferred])
  const groups = useMemo(() => groupViews(sortViews(filtered, deferred.sort), deferred.sort), [filtered, deferred.sort])
  const sagas = useMemo(() => sagasIn(views, query.universe), [views, query.universe])
  const phases = useMemo(() => phasesIn(views, query.universe), [views, query.universe])

  const update = (patch: Partial<ListQuery>) =>
    setQuery((q) => {
      const next = { ...q, ...patch }
      // Switching universe drops filters that don't exist on the other side.
      if (patch.universe && patch.universe !== q.universe) {
        next.sagas = []
        next.phase = null
        if (patch.universe === 'other' && next.sort === 'story') next.sort = 'release'
      }
      return next
    })

  const openView = openId ? (views.find((v) => v.title.id === openId) ?? null) : null

  return (
    <div className="mx-auto min-h-dvh max-w-3xl pb-24">
      <Header views={views} universe={query.universe} onUniverse={(u) => update({ universe: u })} onSettings={() => setSettingsOpen(true)} onOpen={setOpenId} />
      {state.error && (
        <p role="alert" className="mx-3 mt-3 rounded-lg bg-danger/15 p-3 text-sm text-danger sm:mx-4">
          {state.error}
        </p>
      )}
      {!state.durable && (
        <p className="mx-3 mt-3 rounded-lg bg-raised p-3 text-sm sm:mx-4">
          This browser is blocking storage, so changes last only until you close the tab.
        </p>
      )}
      {state.data.watches.length === 0 && (
        <div className="mx-3 mt-4 rounded-xl border border-line bg-surface p-4 sm:mx-4">
          <p className="font-bold">Start checking things off, or bring in your history.</p>
          <p className="mt-1 text-sm text-muted">Have a backup file? Import it from Settings.</p>
          <button onClick={() => setSettingsOpen(true)} className="mt-3 min-h-11 rounded-lg bg-raised px-4 text-sm font-bold hover:bg-line">
            Open Settings
          </button>
        </div>
      )}
      <div className="mt-4">
        <Toolbar query={query} onChange={update} sagas={sagas} phases={phases} resultCount={filtered.length} />
        <TitleList
          groups={groups}
          showYear={deferred.sort !== 'release'}
          onToggle={actions.toggleMovie}
          onOpen={setOpenId}
          filtered={activeFilterCount(query) > 0 || query.search !== ''}
          onClearFilters={() => update({ type: 'all', sagas: [], phase: null, status: 'all', search: '' })}
        />
      </div>
      <TitleDetail view={openView} actions={actions} onClose={() => setOpenId(null)} />
      <Settings open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
