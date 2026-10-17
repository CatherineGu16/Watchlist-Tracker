import { useState } from 'react'
import type { TitleView } from '../lib/catalogView.ts'
import { todayIso } from '../lib/partialDate.ts'
import type { SeasonInput } from '../lib/customTitles.ts'
import { compareWatches, isFinished, isReleased, seasonStatus } from '../lib/status.ts'
import type { Season } from '../lib/types.ts'
import { formatCountdown, formatDate, formatWatch, plural } from '../ui/format.ts'
import { sagaColor } from '../ui/sagas.ts'
import type { useActions } from '../ui/useActions.ts'
import { MoreMenu, type MenuItem } from './MoreMenu.tsx'
import { SeasonCard } from './SeasonCard.tsx'
import { Sheet } from './Sheet.tsx'
import { SeasonFields } from './TitleForm.tsx'
import { WatchHistory } from './WatchHistory.tsx'

type Actions = ReturnType<typeof useActions>

/** What the panel shows besides its main view. */
type Subview =
  | { kind: 'history'; seasonId: string | null; editId?: string }
  | { kind: 'season'; seasonId: string | null }
  | { kind: 'delete' }

export function TitleDetail({
  view,
  actions,
  editLatest = false,
  onClose,
  onEditTitle,
}: {
  view: TitleView | null
  actions: Actions
  /** Open straight into editing the latest watch's date (from "Change date"). */
  editLatest?: boolean
  onClose: () => void
  /** Opens the Edit title form for a title you added. */
  onEditTitle: (v: TitleView) => void
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
      {view && <DetailBody key={view.title.id} view={view} actions={actions} editLatest={editLatest} onClose={onClose} onEditTitle={onEditTitle} />}
    </Sheet>
  )
}

function DetailBody({
  view,
  actions,
  editLatest,
  onClose,
  onEditTitle,
}: {
  view: TitleView
  actions: Actions
  editLatest: boolean
  onClose: () => void
  onEditTitle: (v: TitleView) => void
}) {
  const [sub, setSub] = useState<Subview | null>(() => {
    if (!editLatest || view.title.type === 'series') return null
    const latest = [...view.watches].sort(compareWatches).at(-1)
    return latest ? { kind: 'history', seasonId: null, editId: latest.id } : null
  })
  const back = () => setSub(null)
  const seasonOf = (id: string | null) => (id ? (view.seasons.find((s) => s.id === id) ?? null) : null)

  if (sub?.kind === 'history') {
    return <WatchHistory view={view} season={seasonOf(sub.seasonId)} actions={actions} editId={sub.editId} onBack={back} />
  }
  if (sub?.kind === 'season') {
    return <SeasonEditor view={view} season={seasonOf(sub.seasonId)} actions={actions} onDone={back} />
  }
  if (sub?.kind === 'delete') {
    const n = view.watches.length
    return (
      <section className="mt-2 rounded-xl border border-danger/50 p-4" aria-label="Delete title">
        <h3 className="font-display text-xl font-semibold">Delete {view.title.title}?</h3>
        <p className="mt-1 text-sm text-muted">
          {n ? `This also removes its ${plural(n, 'watch', 'watches')}` : 'It will be removed'} on every device you sync. You can undo right after.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => {
              actions.deleteTitle(view)
              onClose()
            }}
            className="min-h-11 rounded-lg bg-danger px-4 font-bold text-bg"
          >
            Delete title
          </button>
          <button onClick={back} className="min-h-11 rounded-lg px-4 font-bold text-muted hover:bg-raised hover:text-fg">
            Cancel
          </button>
        </div>
      </section>
    )
  }

  const titleItems: MenuItem[] = [
    ...(view.title.type === 'series' ? [{ label: 'Add a season', onSelect: () => setSub({ kind: 'season', seasonId: null }) }] : []),
    ...(view.title.custom
      ? [
          { label: 'Edit title', onSelect: () => onEditTitle(view) },
          { label: 'Delete title…', onSelect: () => setSub({ kind: 'delete' }), tone: 'danger' as const },
        ]
      : []),
  ]
  return view.title.type === 'series' ? (
    <SeriesBody
      view={view}
      actions={actions}
      extraItems={titleItems}
      onHistory={(seasonId) => setSub({ kind: 'history', seasonId })}
      onEditSeason={(seasonId) => setSub({ kind: 'season', seasonId })}
    />
  ) : (
    <MovieBody view={view} actions={actions} extraItems={titleItems} onHistory={() => setSub({ kind: 'history', seasonId: null })} />
  )
}

/** Add the next season to a show, or edit / delete one you added. */
function SeasonEditor({ view, season, actions, onDone }: { view: TitleView; season: Season | null; actions: Actions; onDone: () => void }) {
  const [value, setValue] = useState<SeasonInput>({ episodeCount: season?.episodeCount ?? null, premiereDate: season?.premiereDate ?? null })
  const next = Math.max(0, ...view.seasons.map((s) => s.number)) + 1
  return (
    <section className="mt-1" aria-label={season ? `Edit ${season.label}` : 'Add a season'}>
      <button onClick={onDone} className="-ml-2 inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-bold text-muted hover:text-fg">
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
          <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back
      </button>
      <h3 className="mt-1 font-display text-xl font-semibold">{season ? `Edit ${season.label}` : `Add Season ${next}`}</h3>
      <SeasonFields value={value} onChange={setValue} />
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => {
            if (season) actions.updateSeason(view, season, value)
            else actions.addSeason(view, value)
            onDone()
          }}
          className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary"
        >
          {season ? 'Save season' : 'Add season'}
        </button>
        <button onClick={onDone} className="min-h-11 rounded-lg px-4 font-bold text-muted hover:bg-raised hover:text-fg">
          Cancel
        </button>
        {season && (
          <button
            onClick={() => {
              actions.deleteSeason(view, season)
              onDone()
            }}
            className="ml-auto min-h-11 rounded-lg px-4 font-bold text-danger hover:bg-raised"
          >
            Delete season
          </button>
        )}
      </div>
    </section>
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
      {title.custom && <p className="mt-0.5">Added by you</p>}
    </>
  )
}

/** Face up: when you last watched it and how many times. Every date lives in Watch history. */
function MovieBody({ view, actions, onHistory, extraItems }: { view: TitleView; actions: Actions; onHistory: () => void; extraItems: MenuItem[] }) {
  const today = todayIso()
  const finished = view.watches.filter(isFinished).sort(compareWatches)
  const last = finished.at(-1)
  const menu: MenuItem[] = [
    view.watches.length ? { label: `Watch history (${view.watches.length})`, onSelect: onHistory } : { label: 'Add a past watch', onSelect: onHistory },
    ...(!finished.length
      ? [{ label: 'Watched, date unknown', onSelect: () => actions.logWatch(view, { startDate: null, endDate: null }, `Checked off ${view.title.title}`) }]
      : []),
    ...extraItems,
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

function SeriesBody({
  view,
  actions,
  onHistory,
  onEditSeason,
  extraItems,
}: {
  view: TitleView
  actions: Actions
  onHistory: (seasonId: string) => void
  onEditSeason: (seasonId: string) => void
  extraItems: MenuItem[]
}) {
  const today = todayIso()
  const { summary } = view
  const remaining = view.seasons.filter((s) => isReleased(s.premiereDate, today) && seasonStatus(s, view.watches, today) === 'unwatched')
  const menu: MenuItem[] = [
    ...(remaining.length > 1
      ? [
          {
            label: `Mark ${summary.seasonsDone === 0 && !view.watches.length ? `all ${remaining.length}` : `the other ${remaining.length}`} seasons watched, date unknown`,
            onSelect: () => actions.markSeasonsWatchedUndated(view, remaining),
          },
        ]
      : []),
    ...extraItems,
  ]

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
          <SeasonCard key={s.id} view={view} season={s} actions={actions} onHistory={() => onHistory(s.id)} onEdit={() => onEditSeason(s.id)} />
        ))}
      </ol>
    </section>
  )
}
