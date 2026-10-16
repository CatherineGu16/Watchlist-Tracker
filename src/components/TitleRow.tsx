import { memo } from 'react'
import type { TitleView } from '../lib/catalogView.ts'
import { todayIso } from '../lib/partialDate.ts'
import { formatCountdown, formatDate, plural } from '../ui/format.ts'
import { sagaColor } from '../ui/sagas.ts'
import { CheckButton } from './CheckButton.tsx'

const TYPE_LABEL = { movie: 'Movie', series: 'Series', special: 'Special' } as const

export const TitleRow = memo(function TitleRow({
  view,
  onToggle,
  onOpen,
  showYear,
}: {
  view: TitleView
  onToggle: (v: TitleView) => void
  onOpen: (id: string) => void
  showYear: boolean
}) {
  const { title, summary } = view
  const today = todayIso()

  return (
    <li
      className="relative flex items-center gap-1 border-b border-line pr-1 pl-2 sm:pl-3"
      style={{ boxShadow: `inset 4px 0 0 ${sagaColor(title.saga)}` }}
    >
      <CheckButton view={view} onToggle={() => onToggle(view)} onOpen={() => onOpen(title.id)} />
      <button
        onClick={() => onOpen(title.id)}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-lg py-2 pr-2 pl-1 text-left hover:bg-surface"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[1.2rem] leading-tight font-semibold">
            {title.title}
          </span>
          <span className="mt-0.5 flex flex-wrap gap-x-3 text-[0.8125rem] text-muted">
            <span>{TYPE_LABEL[title.type]}</span>
            {showYear && title.releaseDate && <span>{title.releaseDate.slice(0, 4)}</span>}
            {title.phase !== null && <span>Phase {title.phase}</span>}
            <StatusText view={view} today={today} />
          </span>
        </span>
        {summary.watchCount > 1 && (
          <span className="shrink-0 rounded-md bg-raised px-1.5 py-0.5 text-xs font-bold tabular-nums" title={`Watched ${summary.watchCount} times`}>
            ×{summary.watchCount}
          </span>
        )}
      </button>
    </li>
  )
})

function StatusText({ view, today }: { view: TitleView; today: string }) {
  const { title, summary } = view
  if (summary.status === 'upcoming') {
    const date = title.type === 'series' ? view.seasons.find((s) => s.premiereDate && s.premiereDate > today)?.premiereDate : title.releaseDate
    return <span className="text-fg">{date ? formatCountdown(date, today) : 'Date to be announced'}</span>
  }
  if (title.type === 'series') {
    if (summary.seasonsReleased === 0) return null
    if (summary.status === 'watched') return <span className="text-fg">{summary.seasonsReleased === 1 ? 'Watched' : `All ${summary.seasonsReleased} seasons`}</span>
    if (summary.status === 'unwatched') return <span>{plural(summary.seasonsReleased, 'season')}</span>
    if (summary.seasonsDone === 0) return <span className="text-fg">Watching</span>
    return (
      <span className="text-fg">
        {summary.seasonsDone} of {plural(summary.seasonsReleased, 'season')}
      </span>
    )
  }
  if (summary.status === 'watched') {
    return <span className="text-fg">{summary.lastWatched ? formatDate(summary.lastWatched) : 'Date unknown'}</span>
  }
  return null
}
