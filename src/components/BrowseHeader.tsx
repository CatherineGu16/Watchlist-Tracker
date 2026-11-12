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
 * Top of Browse: MCU / Other Marvel tabs and progress, one ring per saga filled by how much of it
 * you've watched, with the count inside.
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

      {/* Rings share the row, and scroll sideways if there are more sagas than fit. */}
      <ul className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 sm:-mx-4 sm:px-4" aria-label={`${watched} of ${mine.length} watched`}>
        {sagas.map((saga) => {
          const items = mine.filter((v) => v.title.saga === saga)
          const done = items.filter((v) => v.summary.status === 'watched').length
          return (
            <li key={saga} className="flex max-w-[5.25rem] min-w-[3.75rem] flex-1 flex-col items-center gap-1" aria-label={`${saga}: ${done} of ${items.length} watched`}>
              <Ring done={done} total={items.length} color={sagaColor(saga)} />
              <span className="line-clamp-2 text-center text-xs leading-tight text-muted" aria-hidden="true">
                {saga}
              </span>
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

/** A progress ring with "done/total" in the middle. */
function Ring({ done, total, color }: { done: number; total: number; color: string }) {
  const r = 24
  const length = 2 * Math.PI * r
  return (
    <span className="relative grid size-14 place-items-center" aria-hidden="true">
      <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--line)" strokeWidth="4" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - (total ? done / total : 0))}
          className="transition-[stroke-dashoffset] duration-500"
          // A round cap would show a dot at zero.
          style={done === 0 ? { display: 'none' } : undefined}
        />
      </svg>
      <span className="text-[0.8125rem] font-bold tabular-nums">
        {done}
        <span className="font-normal text-muted">/{total}</span>
      </span>
    </span>
  )
}
