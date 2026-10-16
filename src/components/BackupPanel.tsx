import { useRef, useState } from 'react'
import { downloadBackup, readBackup } from '../lib/backupFile.ts'
import type { PrivateData } from '../lib/types.ts'
import { useWatchlistState } from '../store/useWatchlist.ts'
import type { WatchlistStore } from '../store/watchlistStore.ts'

export function BackupPanel({ store }: { store: WatchlistStore }) {
  const { data } = useWatchlistState(store)
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ name: string; data: PrivateData } | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const live = (d: PrivateData) => d.watches.filter((w) => !w.deleted).length

  async function pick(file: File | undefined) {
    if (!file) return
    setMessage(null)
    try {
      setPending({ name: file.name, data: await readBackup(file) })
    } catch (e) {
      setMessage({ tone: 'error', text: (e as Error).message })
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  function confirm(mode: 'merge' | 'replace') {
    if (!pending) return
    store.importData(pending.data, mode)
    setMessage({ tone: 'ok', text: `Imported ${live(pending.data)} watches from ${pending.name}.` })
    setPending(null)
  }

  const button =
    'min-h-11 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500'

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="font-semibold">Backup</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Save a copy of your watch history, or load one onto this device. Files stay on your device.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className={`${button} bg-zinc-800 hover:bg-zinc-700`} onClick={() => downloadBackup(data)}>
          Export
        </button>
        <button className={`${button} bg-zinc-800 hover:bg-zinc-700`} onClick={() => input.current?.click()}>
          Import…
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
      </div>

      {pending && (
        <div className="mt-4 rounded-lg border border-zinc-700 p-3 text-sm" role="dialog" aria-label="Confirm import">
          <p>
            <span className="font-medium">{pending.name}</span> has {live(pending.data)} watches. This device has{' '}
            {live(data)}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={`${button} bg-red-600 text-white hover:bg-red-500`} onClick={() => confirm('merge')}>
              Merge (keep both)
            </button>
            <button className={`${button} bg-zinc-800 hover:bg-zinc-700`} onClick={() => confirm('replace')}>
              Replace this device's data
            </button>
            <button className={`${button} text-zinc-400 hover:text-zinc-200`} onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={`mt-3 text-sm ${message.tone === 'error' ? 'text-red-400' : 'text-emerald-400'}`} role="status">
          {message.text}
        </p>
      )}
    </section>
  )
}
