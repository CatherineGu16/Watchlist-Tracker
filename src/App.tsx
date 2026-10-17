import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { ActiveFilterChips, FilterDrawer, FilterSidebar } from './components/Filters.tsx'
import { Header } from './components/Header.tsx'
import { Settings } from './components/Settings.tsx'
import { TitleDetail } from './components/TitleDetail.tsx'
import { TitleList } from './components/TitleList.tsx'
import { ToastProvider } from './components/Toast.tsx'
import { Toolbar } from './components/Toolbar.tsx'
import { SyncChip } from './components/SyncChip.tsx'
import { StoreContext, SyncContext } from './store/StoreContext.tsx'
import { loadServices, useTitleViews, useWatchlistState, type AppServices } from './store/useWatchlist.ts'
import type { WatchlistStore } from './store/watchlistStore.ts'
import {
  DEFAULT_QUERY,
  activeFilterCount,
  filterViews,
  groupViews,
  phasesIn,
  sagasIn,
  sortViews,
  type FilterValues,
  type ListQuery,
} from './ui/listQuery.ts'
import { useActions, type OpenDetailOptions } from './ui/useActions.ts'
import { usePersistentState } from './ui/usePersistentState.ts'

export default function App() {
  const [services, setServices] = useState<AppServices | null>(null)
  useEffect(() => {
    void loadServices().then(setServices)
  }, [])

  if (!services) return <p className="p-6 text-muted">Loading…</p>
  return (
    <StoreContext.Provider value={services.store}>
      <SyncContext.Provider value={services.sync}>
        <ToastProvider>
          <Shell store={services.store} />
        </ToastProvider>
      </SyncContext.Provider>
    </StoreContext.Provider>
  )
}

/** Remembered per device, except the search text. */
const reviveQuery = (s: unknown): ListQuery => ({ ...DEFAULT_QUERY, ...(s as Partial<ListQuery>), search: '' })

function Shell({ store }: { store: WatchlistStore }) {
  const state = useWatchlistState(store)
  const views = useTitleViews(store)
  const [query, setQuery] = usePersistentState<ListQuery>('watchlist.query.v1', DEFAULT_QUERY, reviveQuery)
  const [detail, setDetail] = useState<{ id: string; editLatest: boolean } | null>(null)
  const openId = detail?.id ?? null
  const setOpenId = useCallback((id: string | null) => setDetail(id ? { id, editLatest: false } : null), [])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const actions = useActions(useCallback((id: string, opts?: OpenDetailOptions) => setDetail({ id, editLatest: Boolean(opts?.editLatest) }), []))

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

  const filterValues: FilterValues = { sagas: query.sagas, phase: query.phase, status: query.status }
  const countFor = (f: FilterValues) => filterViews(views, { ...query, ...f }).length

  const openView = openId ? (views.find((v) => v.title.id === openId) ?? null) : null

  return (
    <div className="mx-auto min-h-dvh max-w-3xl pb-24 lg:max-w-6xl">
      <Header
        views={views}
        universe={query.universe}
        onUniverse={(u) => update({ universe: u })}
        onSettings={() => setSettingsOpen(true)}
        onOpen={setOpenId}
        syncChip={<SyncChip onSettings={() => setSettingsOpen(true)} />}
      />
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
          <p className="mt-1 text-sm text-muted">Already set up on another device? Connect sync or import a backup in Settings.</p>
          <button onClick={() => setSettingsOpen(true)} className="mt-3 min-h-11 rounded-lg bg-raised px-4 text-sm font-bold hover:bg-line">
            Open Settings
          </button>
        </div>
      )}
      <div className="mt-4 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
        <FilterSidebar value={filterValues} onChange={update} sagas={sagas} phases={phases} />
        <div className="min-w-0">
          <Toolbar query={query} onChange={update} onOpenFilters={() => setFiltersOpen(true)}>
            <ActiveFilterChips value={filterValues} onChange={update} />
          </Toolbar>
          <TitleList
            groups={groups}
            showYear={deferred.sort !== 'release'}
            onToggle={actions.toggleMovie}
            onOpen={setOpenId}
            filtered={activeFilterCount(query) > 0 || query.search !== ''}
            onClearFilters={() => update({ type: 'all', sagas: [], phase: null, status: 'all', search: '' })}
          />
        </div>
      </div>
      <FilterDrawer
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        value={filterValues}
        onApply={update}
        countFor={countFor}
        sagas={sagas}
        phases={phases}
      />
      <TitleDetail view={openView} actions={actions} editLatest={detail?.editLatest} onClose={() => setOpenId(null)} />
      <Settings open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
