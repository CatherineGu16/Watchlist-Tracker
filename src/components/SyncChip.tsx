import { useSync } from '../store/StoreContext.tsx'
import { useSyncState } from '../store/useWatchlist.ts'

const LABEL = {
  syncing: 'Syncing',
  pending: 'Saving',
  synced: 'Synced',
  offline: 'Offline',
  error: 'Sync problem',
} as const

/** Header status. Tap to sync now, or to open Settings when something needs fixing. */
export function SyncChip({ onSettings }: { onSettings: () => void }) {
  const sync = useSync()
  const { status } = useSyncState(sync)
  if (status === 'off') return null

  const problem = status === 'error'
  const dot = problem ? 'bg-danger' : status === 'synced' ? 'bg-ok' : status === 'offline' ? 'bg-muted' : 'bg-primary animate-pulse'
  return (
    <button
      onClick={() => (problem ? onSettings() : void sync.syncNow())}
      aria-label={problem ? 'Sync problem. Open Settings' : `${LABEL[status]}. Sync now`}
      className={`flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm ${problem ? 'bg-danger/15 font-bold text-danger' : 'text-muted hover:bg-surface hover:text-fg'}`}
    >
      <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
      {LABEL[status]}
    </button>
  )
}
