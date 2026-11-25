import type { TitleView } from '../lib/catalogView.ts'
import { todayIso } from '../lib/partialDate.ts'
import { compareWatches, hasDatedWatch, isFinished, isOpen, seasonStatus } from '../lib/status.ts'
import type { Season } from '../lib/types.ts'
import { formatCountdown, formatDate, formatRuntime, formatWatch, plural } from '../ui/format.ts'
import { sagaColor } from '../ui/sagas.ts'
import type { useActions } from '../ui/useActions.ts'
import { Stamp } from './CheckButton.tsx'
import { MoreMenu, type MenuItem } from './MoreMenu.tsx'

type Actions = ReturnType<typeof useActions>

/**
 * One season as a compact checklist row: the same checkmark as Browse, its facts, and where you are
 * with it. Tapping the row opens it up for the episode counter (while watching) and everything else.
 */
export function SeasonRow({
  view,
  season,
  actions,
  expanded,
  onExpand,
  onHistory,
  onEdit,
}: {
  view: TitleView
  season: Season
  actions: Actions
  expanded: boolean
  onExpand: (open: boolean) => void
  onHistory: () => void
  /** Edit or delete a season you added. */
  onEdit: () => void
}) {
  const today = todayIso()
  const { title } = view
  const color = sagaColor(title.saga)
  const watches = view.watches.filter((w) => w.seasonId === season.id).sort(compareWatches)
  const status = seasonStatus(season, watches, today)
  const open = watches.find(isOpen)
  const finished = watches.filter(isFinished)
  const last = finished.at(-1)
  const done = open?.episodesWatched ?? 0
  const count = season.episodeCount
  const atEnd = open && count !== null && done >= count
  const locked = hasDatedWatch(watches)

  const menu: MenuItem[] = [
    ...(open ? [{ label: 'Finish season today', onSelect: () => actions.finishSeason(view, season, open.id) }] : []),
    watches.length ? { label: `Watch history (${watches.length})`, onSelect: onHistory } : { label: 'Add a past watch', onSelect: onHistory },
    ...(status === 'watched' && !open ? [{ label: 'Log a rewatch today', onSelect: () => actions.markSeasonWatched(view, season) }] : []),
    ...(status === 'unwatched' ? [{ label: 'Watched, date unknown', onSelect: () => actions.markSeasonsWatchedUndated(view, [season]) }] : []),
    ...(season.custom ? [{ label: 'Edit or delete season', onSelect: onEdit }] : []),
  ]

  const facts = [
    count !== null ? plural(count, 'episode') : null,
    season.premiereDate && status !== 'upcoming' ? season.premiereDate.slice(0, 4) : null,
    season.runtime ? formatRuntime(season.runtime) : null,
  ].filter(Boolean)

  return (
    <li aria-label={season.label} className="border-b border-line last:border-b-0">
      <div className="flex items-center gap-1">
        <Stamp
          label={`${title.title} ${season.label} watched`}
          status={status}
          color={color}
          locked={locked}
          // Once it has a date (or is underway) the check is only an indicator; the row opens instead.
          onToggle={() => (locked || open ? onExpand(true) : actions.toggleSeason(view, season))}
        />
        <button
          onClick={() => onExpand(!expanded)}
          aria-expanded={expanded}
          className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-lg py-2 pr-1 pl-1 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-display text-xl leading-tight font-semibold">{season.label}</span>
            <span className="block truncate text-xs text-muted">{facts.join(' · ') || ' '}</span>
          </span>
          <span className="shrink-0 text-right text-sm">
            {status === 'in-progress' && open ? (
              <span className="flex items-center gap-2">
                {count !== null && (
                  <span className="h-1.5 w-12 overflow-hidden rounded-full bg-line" aria-hidden="true">
                    <span className="block h-full rounded-full" style={{ width: `${(done / count) * 100}%`, background: color }} />
                  </span>
                )}
                <span className="tabular-nums">{count !== null ? `${done}/${count}` : `${done} watched`}</span>
              </span>
            ) : status === 'watched' && last ? (
              <span className="text-muted">
                {last.startDate === null && last.endDate === null ? 'Date unknown' : formatDate((last.endDate ?? last.startDate)!)}
                {finished.length > 1 && <span className="ml-1 font-bold text-fg">×{finished.length}</span>}
              </span>
            ) : status === 'upcoming' ? (
              <span className="text-muted">{season.premiereDate ? formatCountdown(season.premiereDate, today) : 'Date TBA'}</span>
            ) : null}
          </span>
          <svg viewBox="0 0 16 16" className={`size-4 shrink-0 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true">
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* One line: the counter while watching, otherwise the actions; the rest is in ⋯. */}
      {expanded && (
        <div className="flex flex-wrap items-center gap-2 pb-3 pl-12">
          {open ? (
            <>
              <span className="mr-auto text-sm text-muted">{formatWatch(open)}</span>
              <button
                onClick={() => actions.setEpisodes(open.id, done - 1, count)}
                disabled={done <= 0}
                aria-label="One fewer episode"
                className="grid size-9 place-items-center rounded-lg bg-raised text-xl font-bold hover:bg-line disabled:opacity-40"
              >
                −
              </button>
              <span className="min-w-14 text-center font-display text-xl font-semibold tabular-nums" aria-live="polite">
                {done}
                {count !== null && <span className="text-sm text-muted"> / {count}</span>}
              </span>
              <button
                onClick={() => actions.setEpisodes(open.id, done + 1, count)}
                disabled={Boolean(atEnd)}
                aria-label="One more episode"
                className="grid size-9 place-items-center rounded-lg bg-raised text-xl font-bold hover:bg-line disabled:opacity-40"
              >
                +
              </button>
            </>
          ) : status === 'upcoming' ? (
            <span className="mr-auto text-sm text-muted">
              {season.premiereDate ? `Premieres ${formatDate(season.premiereDate)}` : 'Premiere date to be announced'}
            </span>
          ) : (
            <>
              <button onClick={() => actions.startSeason(view, season)} className="min-h-9 rounded-lg bg-raised px-3 text-sm font-bold hover:bg-line">
                {status === 'watched' ? 'Start rewatch' : 'Start watching'}
              </button>
              {status !== 'watched' && (
                <button onClick={() => actions.markSeasonWatched(view, season)} className="min-h-9 rounded-lg bg-raised px-3 text-sm font-bold hover:bg-line">
                  Watched it today
                </button>
              )}
              <span className="mr-auto" />
            </>
          )}
          <MoreMenu label={`More for ${season.label}`} items={menu} />
        </div>
      )}
    </li>
  )
}
