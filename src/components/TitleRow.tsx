import { memo } from 'react'
import type { TitleView } from '../lib/catalogView.ts'
import { todayIso } from '../lib/partialDate.ts'
import { isOpen } from '../lib/status.ts'
import { formatCountdown, formatDate, plural } from '../ui/format.ts'
import type { ListEntry } from '../ui/listQuery.ts'
import { sagaColor } from '../ui/sagas.ts'
import { seriesNote, shortSeason } from '../ui/seriesProgress.ts'
import { CheckButton, Stamp } from './CheckButton.tsx'

const TYPE_LABEL = { movie: 'Movie', series: 'Series', special: 'Special' } as const

export const TitleRow = memo(function TitleRow({
  entry,
  onToggle,
  onOpen,
  showYear,
}: {
  entry: ListEntry
  onToggle: (e: ListEntry) => void
  onOpen: (id: string) => void
  showYear: boolean
}) {
  const { view } = entry
  const { title, summary } = view
  const today = todayIso()
  if (entry.season) return <SeasonRow entry={entry} onToggle={onToggle} onOpen={onOpen} showYear={showYear} today={today} />

  return (
    <li
      className="relative flex items-center gap-1 border-b border-line pr-1 pl-2 sm:pl-3"
      style={{ boxShadow: `inset 4px 0 0 ${sagaColor(title.saga)}` }}
    >
      <CheckButton view={view} onToggle={() => onToggle(entry)} onOpen={() => onOpen(title.id)} />
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

/** One season as its own row, for "Release by season". */
function SeasonRow({
  entry,
  onToggle,
  onOpen,
  showYear,
  today,
}: {
  entry: ListEntry
  onToggle: (e: ListEntry) => void
  onOpen: (id: string) => void
  showYear: boolean
  today: string
}) {
  const { view, status } = entry
  const season = entry.season!
  const { title } = view
  const open = view.watches.find((w) => w.seasonId === season.id && isOpen(w))
  const phase = season.phase ?? title.phase

  return (
    <li className="relative flex items-center gap-1 border-b border-line pr-1 pl-2 sm:pl-3" style={{ boxShadow: `inset 4px 0 0 ${sagaColor(title.saga)}` }}>
      <Stamp label={`${title.title} ${season.label} watched`} status={status} color={sagaColor(title.saga)} onToggle={() => onToggle(entry)} />
      <button
        onClick={() => onOpen(title.id)}
        aria-label={`${title.title} ${season.label}`}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-lg py-2 pr-2 pl-1 text-left hover:bg-surface"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[1.2rem] leading-tight font-semibold">
            {title.title} <span className="text-muted">{season.label}</span>
          </span>
          <span className="mt-0.5 flex flex-wrap gap-x-3 text-[0.8125rem] text-muted">
            {season.episodeCount !== null && <span>{plural(season.episodeCount, 'episode')}</span>}
            {showYear && entry.releaseDate && <span>{entry.releaseDate.slice(0, 4)}</span>}
            {phase !== null && <span>Phase {phase}</span>}
            {status === 'upcoming' && (
              <span className="text-fg">{entry.releaseDate ? formatCountdown(entry.releaseDate, today) : 'Date to be announced'}</span>
            )}
            {status === 'in-progress' && open && (
              <span className="text-fg">
                Watching{open.episodesWatched !== null && season.episodeCount !== null && `, ${open.episodesWatched}/${season.episodeCount}`}
              </span>
            )}
            {status === 'watched' && <span className="text-fg">{entry.lastWatched ? formatDate(entry.lastWatched) : 'Date unknown'}</span>}
          </span>
        </span>
        {entry.watchCount > 1 && (
          <span className="shrink-0 rounded-md bg-raised px-1.5 py-0.5 text-xs font-bold tabular-nums" title={`Watched ${entry.watchCount} times`}>
            ×{entry.watchCount}
          </span>
        )}
      </button>
    </li>
  )
}

function StatusText({ view, today }: { view: TitleView; today: string }) {
  const { title, summary } = view
  if (summary.status === 'upcoming') {
    const date = title.type === 'series' ? view.seasons.find((s) => s.premiereDate && s.premiereDate > today)?.premiereDate : title.releaseDate
    return <span className="text-fg">{date ? formatCountdown(date, today) : 'Date to be announced'}</span>
  }
  if (title.type === 'series') {
    const note = seriesNote(view, today)
    if (note?.kind === 'watching') {
      const count = note.season.episodeCount
      return (
        <span className="text-fg">
          Watching {shortSeason(note.season)}
          {note.episodes !== null && count !== null && `, ${note.episodes}/${count}`}
        </span>
      )
    }
    if (note?.kind === 'new-season') return <span className="font-bold text-fg">New: {shortSeason(note.season)}</span>
    if (note?.kind === 'next-season' && summary.status === 'watched' && note.season.premiereDate) {
      const when = formatCountdown(note.season.premiereDate, today)
      return (
        <span className="text-fg">
          Caught up. {shortSeason(note.season)} {when[0].toLowerCase() + when.slice(1)}
        </span>
      )
    }
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
