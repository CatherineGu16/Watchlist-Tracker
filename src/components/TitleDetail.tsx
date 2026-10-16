import type { TitleView } from '../lib/catalogView.ts'
import { todayIso } from '../lib/partialDate.ts'
import { compareWatches, isReleased, seasonStatus } from '../lib/status.ts'
import { formatCountdown, formatDate, plural } from '../ui/format.ts'
import { sagaColor } from '../ui/sagas.ts'
import type { useActions } from '../ui/useActions.ts'
import { SeasonCard } from './SeasonCard.tsx'
import { Sheet } from './Sheet.tsx'
import { WatchItem } from './WatchItem.tsx'

type Actions = ReturnType<typeof useActions>

export function TitleDetail({ view, actions, onClose }: { view: TitleView | null; actions: Actions; onClose: () => void }) {
  return (
    <Sheet
      open={view !== null}
      onOpenChange={(o) => !o && onClose()}
      title={view?.title.title}
      accent={view ? sagaColor(view.title.saga) : undefined}
      description={view && <Facts view={view} />}
    >
      {view && (view.title.type === 'series' ? <SeriesBody view={view} actions={actions} /> : <MovieBody view={view} actions={actions} />)}
    </Sheet>
  )
}

function Facts({ view }: { view: TitleView }) {
  const { title } = view
  const today = todayIso()
  const upcoming = title.releaseDate && !isReleased(title.releaseDate, today)
  return (
    <>
      <p className="flex flex-wrap gap-x-3">
        <span>{title.saga}</span>
        {title.phase !== null && <span>Phase {title.phase}</span>}
        <span>{title.studio}</span>
      </p>
      <p className="mt-0.5">
        {title.releaseDate
          ? upcoming
            ? formatCountdown(title.releaseDate, today)
            : `${title.type === 'series' ? 'Premiered' : 'Released'} ${formatDate(title.releaseDate)}`
          : 'Release date to be announced'}
        {title.note && <span> ({title.note})</span>}
      </p>
    </>
  )
}

function MovieBody({ view, actions }: { view: TitleView; actions: Actions }) {
  const watches = [...view.watches].sort(compareWatches)
  const today = todayIso()
  return (
    <section className="mt-2">
      <h3 className="font-display text-xl font-semibold">{watches.length ? plural(watches.length, 'watch', 'watches') : 'Not watched yet'}</h3>
      {watches.length > 0 && (
        <ul className="mt-1 divide-y divide-line">
          {watches.map((w, i) => (
            <WatchItem
              key={w.id}
              watch={w}
              index={i}
              kind="single"
              onSave={(patch) => actions.updateWatch(w.id, patch, `Updated ${view.title.title}`)}
              onDelete={() => actions.deleteWatch(w.id, `Removed a watch of ${view.title.title}`)}
            />
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => actions.logWatch(view, { startDate: today, endDate: today }, watches.length ? `Logged a rewatch of ${view.title.title}` : `Checked off ${view.title.title}`)}
          className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary"
        >
          {watches.length ? 'Log a rewatch today' : 'Watched it today'}
        </button>
        <button
          onClick={() => actions.logWatch(view, { startDate: null, endDate: null }, `Checked off ${view.title.title}`)}
          className="min-h-11 rounded-lg px-4 font-bold text-muted hover:bg-raised hover:text-fg"
        >
          {watches.length ? 'Add one, date unknown' : 'Watched, date unknown'}
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">Use Edit on a watch to change its date.</p>
    </section>
  )
}

function SeriesBody({ view, actions }: { view: TitleView; actions: Actions }) {
  const today = todayIso()
  const { summary } = view
  const remaining = view.seasons.filter((s) => isReleased(s.premiereDate, today) && seasonStatus(s, view.watches, today) === 'unwatched')

  return (
    <section className="mt-2">
      <div className="flex items-baseline gap-2">
        <h3 className="font-display text-xl font-semibold">
          {summary.seasonsReleased === 0
            ? 'No seasons out yet'
            : summary.status === 'watched'
              ? 'All caught up'
              : `${summary.seasonsDone} of ${plural(summary.seasonsReleased, 'season')} watched`}
        </h3>
        {summary.watchCount > 1 && <span className="text-sm text-muted">Watched the whole show {summary.watchCount} times</span>}
      </div>
      {remaining.length > 1 && (
        <button
          onClick={() => actions.markSeasonsWatchedUndated(view, remaining)}
          className="mt-2 min-h-11 rounded-lg px-3 text-sm font-bold text-muted hover:bg-raised hover:text-fg"
        >
          Mark {summary.seasonsDone === 0 && !view.watches.length ? `all ${remaining.length}` : `the other ${remaining.length}`} seasons watched, date unknown
        </button>
      )}
      <ol className="mt-3 space-y-3">
        {view.seasons.map((s) => (
          <SeasonCard key={s.id} view={view} season={s} actions={actions} />
        ))}
      </ol>
    </section>
  )
}
