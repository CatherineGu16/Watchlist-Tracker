import type { TitleView } from '../lib/catalogView.ts'
import { todayIso } from '../lib/partialDate.ts'
import { compareWatches, isOpen, seasonStatus } from '../lib/status.ts'
import type { Season } from '../lib/types.ts'
import { formatCountdown, formatDate, plural } from '../ui/format.ts'
import type { useActions } from '../ui/useActions.ts'
import { WatchItem } from './WatchItem.tsx'

type Actions = ReturnType<typeof useActions>

const STATUS_LABEL = { watched: 'Watched', 'in-progress': 'Watching', unwatched: 'Not watched', upcoming: 'Upcoming' } as const

export function SeasonCard({ view, season, actions }: { view: TitleView; season: Season; actions: Actions }) {
  const today = todayIso()
  const watches = view.watches.filter((w) => w.seasonId === season.id).sort(compareWatches)
  const status = seasonStatus(season, watches, today)
  const open = watches.find(isOpen)
  const done = open?.episodesWatched ?? 0
  const atEnd = open && season.episodeCount !== null && done >= season.episodeCount

  return (
    <li className="rounded-xl border border-line bg-bg/40 p-3" aria-label={season.label}>
      <div className="flex items-baseline gap-2">
        <h3 className="font-display text-xl font-semibold">{season.label}</h3>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-xs font-bold ${status === 'watched' ? 'border border-[var(--accent)] text-fg' : 'bg-raised text-muted'}`}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>
      <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted">
        {season.episodeCount !== null && <span>{plural(season.episodeCount, 'episode')}</span>}
        {season.premiereDate ? (
          <span>{status === 'upcoming' ? formatCountdown(season.premiereDate, today) : `Premiered ${formatDate(season.premiereDate)}`}</span>
        ) : (
          <span>Premiere date to be announced</span>
        )}
        {season.phase !== null && <span>Phase {season.phase}</span>}
      </p>

      {open && (
        <div className="mt-3 rounded-lg bg-surface p-3">
          <div className="flex items-center gap-2">
            <span className="mr-auto text-sm">Episodes watched</span>
            <button
              onClick={() => actions.setEpisodes(open.id, done - 1, season.episodeCount)}
              disabled={done <= 0}
              aria-label="One fewer episode"
              className="grid size-11 place-items-center rounded-lg bg-raised text-xl font-bold disabled:opacity-40"
            >
              −
            </button>
            <span className="min-w-16 text-center font-display text-2xl font-semibold tabular-nums" aria-live="polite">
              {done}
              {season.episodeCount !== null && <span className="text-base text-muted"> / {season.episodeCount}</span>}
            </span>
            <button
              onClick={() => actions.setEpisodes(open.id, done + 1, season.episodeCount)}
              disabled={Boolean(atEnd)}
              aria-label="One more episode"
              className="grid size-11 place-items-center rounded-lg bg-raised text-xl font-bold disabled:opacity-40"
            >
              +
            </button>
          </div>
          {atEnd && <p className="mt-2 text-sm">That was the last episode.</p>}
          <button
            onClick={() => actions.finishSeason(view, season, open.id)}
            className={`mt-3 min-h-11 w-full rounded-lg font-bold ${atEnd ? 'bg-primary text-on-primary' : 'bg-raised'}`}
          >
            Finish season today
          </button>
        </div>
      )}

      {!open && status !== 'upcoming' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => actions.startSeason(view, season)} className="min-h-11 rounded-lg bg-raised px-3 text-sm font-bold hover:bg-line">
            {status === 'watched' ? 'Start rewatch' : 'Start watching'}
          </button>
          <button onClick={() => actions.markSeasonWatched(view, season)} className="min-h-11 rounded-lg bg-raised px-3 text-sm font-bold hover:bg-line">
            {status === 'watched' ? 'Log a rewatch today' : 'Watched it today'}
          </button>
          {status !== 'watched' && (
            <button
              onClick={() => actions.markSeasonsWatchedUndated(view, [season])}
              className="min-h-11 rounded-lg px-3 text-sm font-bold text-muted hover:bg-raised hover:text-fg"
            >
              Watched, date unknown
            </button>
          )}
        </div>
      )}

      {watches.length > 0 && (
        <ul className="mt-2 divide-y divide-line">
          {watches.map((w, i) => (
            <WatchItem
              key={w.id}
              watch={w}
              index={i}
              kind="range"
              onSave={(patch) => actions.updateWatch(w.id, patch, `Updated ${view.title.title} ${season.label}`)}
              onDelete={() => actions.deleteWatch(w.id, `Removed a watch of ${season.label}`)}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
