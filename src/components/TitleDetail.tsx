import { useState } from 'react'
import type { TitleView } from '../lib/catalogView.ts'
import { todayIso } from '../lib/partialDate.ts'
import { compareWatches, isFinished, isReleased, seasonStatus } from '../lib/status.ts'
import { formatCountdown, formatDate, formatWatch, plural } from '../ui/format.ts'
import { sagaColor } from '../ui/sagas.ts'
import type { useActions } from '../ui/useActions.ts'
import { MoreMenu, type MenuItem } from './MoreMenu.tsx'
import { SeasonCard } from './SeasonCard.tsx'
import { Sheet } from './Sheet.tsx'
import { WatchHistory } from './WatchHistory.tsx'

type Actions = ReturnType<typeof useActions>

/** Which history the panel shows: the movie's (seasonId null) or one season's. */
interface HistoryTarget {
  seasonId: string | null
  editId?: string
}

export function TitleDetail({
  view,
  actions,
  editLatest = false,
  onClose,
}: {
  view: TitleView | null
  actions: Actions
  /** Open straight into editing the latest watch's date (from "Change date"). */
  editLatest?: boolean
  onClose: () => void
}) {
  return (
    <Sheet
      open={view !== null}
      onOpenChange={(o) => !o && onClose()}
      title={view?.title.title}
      accent={view ? sagaColor(view.title.saga) : undefined}
      description={view && <Facts view={view} />}
    >
      {/* Keyed by title so switching titles starts on the main view. */}
      {view && <DetailBody key={view.title.id} view={view} actions={actions} editLatest={editLatest} />}
    </Sheet>
  )
}

function DetailBody({ view, actions, editLatest }: { view: TitleView; actions: Actions; editLatest: boolean }) {
  const [history, setHistory] = useState<HistoryTarget | null>(() => {
    if (!editLatest || view.title.type === 'series') return null
    const latest = [...view.watches].sort(compareWatches).at(-1)
    return latest ? { seasonId: null, editId: latest.id } : null
  })

  if (history) {
    const season = history.seasonId ? (view.seasons.find((s) => s.id === history.seasonId) ?? null) : null
    return <WatchHistory view={view} season={season} actions={actions} editId={history.editId} onBack={() => setHistory(null)} />
  }
  return view.title.type === 'series' ? (
    <SeriesBody view={view} actions={actions} onHistory={(seasonId) => setHistory({ seasonId })} />
  ) : (
    <MovieBody view={view} actions={actions} onHistory={() => setHistory({ seasonId: null })} />
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

/** Face up: when you last watched it and how many times. Every date lives in Watch history. */
function MovieBody({ view, actions, onHistory }: { view: TitleView; actions: Actions; onHistory: () => void }) {
  const today = todayIso()
  const finished = view.watches.filter(isFinished).sort(compareWatches)
  const last = finished.at(-1)
  const menu: MenuItem[] = [
    view.watches.length ? { label: `Watch history (${view.watches.length})`, onSelect: onHistory } : { label: 'Add a past watch', onSelect: onHistory },
    ...(!finished.length
      ? [{ label: 'Watched, date unknown', onSelect: () => actions.logWatch(view, { startDate: null, endDate: null }, `Checked off ${view.title.title}`) }]
      : []),
  ]

  return (
    <section className="mt-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-semibold">
            {last ? (last.startDate === null && last.endDate === null ? 'Watched, date unknown' : `Last watched ${formatWatch(last)}`) : 'Not watched yet'}
          </h3>
          {finished.length > 1 && <p className="text-sm text-muted">Watched {plural(finished.length, 'time')}</p>}
        </div>
        <MoreMenu label={`More for ${view.title.title}`} items={menu} />
      </div>
      <button
        onClick={() =>
          actions.logWatch(view, { startDate: today, endDate: today }, finished.length ? `Logged a rewatch of ${view.title.title}` : `Checked off ${view.title.title}`)
        }
        className="mt-3 min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary"
      >
        {finished.length ? 'Log a rewatch today' : 'Watched it today'}
      </button>
    </section>
  )
}

function SeriesBody({ view, actions, onHistory }: { view: TitleView; actions: Actions; onHistory: (seasonId: string) => void }) {
  const today = todayIso()
  const { summary } = view
  const remaining = view.seasons.filter((s) => isReleased(s.premiereDate, today) && seasonStatus(s, view.watches, today) === 'unwatched')
  const menu: MenuItem[] =
    remaining.length > 1
      ? [
          {
            label: `Mark ${summary.seasonsDone === 0 && !view.watches.length ? `all ${remaining.length}` : `the other ${remaining.length}`} seasons watched, date unknown`,
            onSelect: () => actions.markSeasonsWatchedUndated(view, remaining),
          },
        ]
      : []

  return (
    <section className="mt-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-semibold">
            {summary.seasonsReleased === 0
              ? 'No seasons out yet'
              : summary.status === 'watched'
                ? 'All caught up'
                : `${summary.seasonsDone} of ${plural(summary.seasonsReleased, 'season')} watched`}
          </h3>
          {summary.watchCount > 1 && <p className="text-sm text-muted">Watched the whole show {plural(summary.watchCount, 'time')}</p>}
        </div>
        <MoreMenu label={`More for ${view.title.title}`} items={menu} />
      </div>
      <ol className="mt-3 space-y-3">
        {view.seasons.map((s) => (
          <SeasonCard key={s.id} view={view} season={s} actions={actions} onHistory={() => onHistory(s.id)} />
        ))}
      </ol>
    </section>
  )
}
