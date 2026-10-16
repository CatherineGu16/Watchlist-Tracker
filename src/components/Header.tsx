import type { ReactNode } from 'react'
import type { TitleView } from '../lib/catalogView.ts'
import type { Universe } from '../lib/types.ts'
import { sagaColor, sagaRank } from '../ui/sagas.ts'

const UNIVERSES: { id: Universe; label: string }[] = [
  { id: 'mcu', label: 'MCU' },
  { id: 'other', label: 'Other Marvel' },
]

/**
 * The bar is the whole universe at a glance: one segment per saga, sized by its share of titles,
 * filled by how much of it you've watched.
 */
export function Header({
  views,
  universe,
  onUniverse,
  onSettings,
  syncChip,
}: {
  views: TitleView[]
  universe: Universe
  onUniverse: (u: Universe) => void
  onSettings: () => void
  syncChip?: ReactNode
}) {
  const mine = views.filter((v) => v.title.universe === universe)
  const watched = mine.filter((v) => v.summary.status === 'watched').length
  const sagas = [...new Set(mine.map((v) => v.title.saga))].sort((a, b) => sagaRank(a) - sagaRank(b))

  return (
    <header className="px-3 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-4">
      <div className="flex items-center gap-2">
        <h1 className="mr-auto font-display text-[2rem] leading-none font-semibold tracking-tight">Watchlist</h1>
        {syncChip}
        <button
          onClick={onSettings}
          aria-label="Settings"
          className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
        >
          <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm7.4-2.5a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5Z"
            />
          </svg>
        </button>
      </div>

      <div role="tablist" aria-label="Universe" className="mt-4 flex gap-6">
        {UNIVERSES.map((u) => {
          const items = views.filter((v) => v.title.universe === u.id)
          const done = items.filter((v) => v.summary.status === 'watched').length
          const active = u.id === universe
          return (
            <button
              key={u.id}
              role="tab"
              aria-selected={active}
              onClick={() => onUniverse(u.id)}
              className={`-mb-px min-h-11 border-b-2 pb-1 text-left transition-colors ${active ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg'}`}
            >
              <span className="font-display text-xl font-semibold">{u.label}</span>{' '}
              <span className="text-sm tabular-nums">
                {done}/{items.length}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex h-2.5 gap-0.5" role="img" aria-label={`${watched} of ${mine.length} watched`}>
        {sagas.map((saga) => {
          const items = mine.filter((v) => v.title.saga === saga)
          const done = items.filter((v) => v.summary.status === 'watched').length
          return (
            <span
              key={saga}
              title={`${saga}: ${done} of ${items.length}`}
              className="overflow-hidden rounded-sm bg-line first:rounded-l-full last:rounded-r-full"
              style={{ flexGrow: items.length }}
            >
              <span className="block h-full transition-[width] duration-500" style={{ width: `${(done / items.length) * 100}%`, background: sagaColor(saga) }} />
            </span>
          )
        })}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] text-muted">
        {sagas.map((saga) => {
          const items = mine.filter((v) => v.title.saga === saga)
          const done = items.filter((v) => v.summary.status === 'watched').length
          return (
            <li key={saga} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: sagaColor(saga) }} aria-hidden="true" />
              {saga} <span className="tabular-nums">{done}/{items.length}</span>
            </li>
          )
        })}
      </ul>
    </header>
  )
}
