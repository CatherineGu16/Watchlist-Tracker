import type { TitleView } from '../lib/catalogView.ts'
import { sagaColor } from '../ui/sagas.ts'

/**
 * Movies: a stamp you press to check off. Series: a progress ring of finished seasons that opens
 * the season list, since a show is only "watched" once every season is.
 */
export function CheckButton({ view, onToggle, onOpen }: { view: TitleView; onToggle: () => void; onOpen: () => void }) {
  const { title, summary } = view
  const color = sagaColor(title.saga)
  const watched = summary.status === 'watched'

  if (title.type === 'series') {
    const total = Math.max(summary.seasonsReleased, 1)
    const pct = (summary.seasonsDone / total) * 100
    return (
      <button
        onClick={onOpen}
        aria-label={`${title.title}: ${summary.seasonsDone} of ${summary.seasonsReleased} seasons watched. Open seasons`}
        className="grid size-11 shrink-0 place-items-center rounded-full"
      >
        <span
          className="grid size-8 place-items-center rounded-full"
          style={{ background: `conic-gradient(${color} ${pct}%, var(--line) ${pct}% 100%)` }}
        >
          <span
            className="grid size-6 place-items-center rounded-full bg-surface text-[11px] font-bold tabular-nums"
            style={watched ? { background: color, color: 'var(--bg)' } : undefined}
          >
            {watched ? <Tick /> : summary.seasonsDone}
          </span>
        </span>
      </button>
    )
  }

  const upcoming = summary.status === 'upcoming'
  return (
    <button
      onClick={onToggle}
      role="checkbox"
      aria-checked={watched}
      aria-label={`${title.title} watched`}
      className="grid size-11 shrink-0 place-items-center rounded-full"
    >
      <span
        key={String(watched)}
        className={`grid size-8 place-items-center rounded-full border-2 transition-colors ${upcoming && !watched ? 'border-dashed' : ''} ${watched ? '[animation:stamp_220ms_ease-out]' : ''}`}
        style={{ borderColor: color, background: watched ? color : 'transparent', color: 'var(--bg)' }}
      >
        {watched && <Tick />}
      </span>
    </button>
  )
}

function Tick() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
