import type { TitleView } from '../lib/catalogView.ts'
import { todayIso } from '../lib/partialDate.ts'
import type { Universe } from '../lib/types.ts'
import { formatCountdown, plural } from '../ui/format.ts'
import { sagaColor, sagaRank } from '../ui/sagas.ts'
import { nextRelease, watchesInYear } from '../ui/stats.ts'

const UNIVERSES: { id: Universe; label: string }[] = [
  { id: 'mcu', label: 'MCU' },
  { id: 'other', label: 'Other Marvel' },
]

/**
 * Top of Browse: MCU / Other Marvel tabs and progress. The bar is the whole universe at a glance:
 * one segment per saga, sized by its share of titles, filled by how much of it you've watched.
 */
export function BrowseHeader({
  views,
  universe,
  onUniverse,
  onOpen,
}: {
  onOpen: (id: string) => void
  views: TitleView[]
  universe: Universe
  onUniverse: (u: Universe) => void
}) {
  const mine = views.filter((v) => v.title.universe === universe)
  const watched = mine.filter((v) => v.summary.status === 'watched').length
  const sagas = [...new Set(mine.map((v) => v.title.saga))].sort((a, b) => sagaRank(a) - sagaRank(b))
  const today = todayIso()
  const next = nextRelease(views, universe, today)
  const thisYear = watchesInYear(views, today.slice(0, 4))

  return (
    <div className="px-3 sm:px-4">
      <div role="tablist" aria-label="Universe" className="flex gap-6">
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
      <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
        {next && (
          <button onClick={() => onOpen(next.view.title.id)} className="min-h-9 text-left hover:underline">
            <span className="text-muted">Next up </span>
            <span className="font-bold">
              {next.view.title.title}
              {next.seasonLabel && ` ${next.seasonLabel}`}
            </span>
            <span className="text-muted">, {lowerFirst(formatCountdown(next.date, today))}</span>
          </button>
        )}
        <span className="text-muted">
          {thisYear > 0 ? `${plural(thisYear, 'watch', 'watches')} logged in ${today.slice(0, 4)}` : `Nothing logged yet in ${today.slice(0, 4)}`}
        </span>
      </div>
    </div>
  )
}

const lowerFirst = (s: string) => s[0].toLowerCase() + s.slice(1)
