import { useEffect, useState } from 'react'
import { BackupPanel } from './components/BackupPanel.tsx'
import { loadStore, useTitleViews, useWatchlistState } from './store/useWatchlist.ts'
import type { WatchlistStore } from './store/watchlistStore.ts'

export default function App() {
  const [store, setStore] = useState<WatchlistStore | null>(null)
  useEffect(() => {
    void loadStore().then(setStore)
  }, [])

  return (
    <main className="min-h-dvh bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <h1 className="text-2xl font-semibold">Marvel Watchlist</h1>
        {store ? <Home store={store} /> : <p className="text-zinc-400">Loading…</p>}
      </div>
    </main>
  )
}

// Placeholder home until the list UI lands in M3.
function Home({ store }: { store: WatchlistStore }) {
  const state = useWatchlistState(store)
  const views = useTitleViews(store)
  const count = (pred: (v: (typeof views)[number]) => boolean) => views.filter(pred).length

  return (
    <>
      {!state.durable && (
        <p className="rounded-lg bg-amber-950 p-3 text-sm text-amber-200">
          This browser is blocking storage, so changes last only until you close the tab.
        </p>
      )}
      {state.error && <p className="rounded-lg bg-red-950 p-3 text-sm text-red-200">{state.error}</p>}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Titles" value={views.length} />
        <Stat label="Watched" value={count((v) => v.summary.status === 'watched')} />
        <Stat label="In progress" value={count((v) => v.summary.status === 'in-progress')} />
        <Stat label="Watches" value={state.data.watches.filter((w) => !w.deleted).length} />
      </dl>
      <BackupPanel store={store} />
    </>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
      <dt className="text-xs text-zinc-400">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
