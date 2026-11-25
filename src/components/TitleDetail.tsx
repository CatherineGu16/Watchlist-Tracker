import { useEffect, useRef, useState } from 'react'
import type { TitleView } from '../lib/catalogView.ts'
import { todayIso } from '../lib/partialDate.ts'
import type { SeasonInput } from '../lib/customTitles.ts'
import { compareWatches, isFinished, isOpen, isReleased, seasonStatus } from '../lib/status.ts'
import type { Season, Watch } from '../lib/types.ts'
import { formatCountdown, formatDate, formatRuntime, formatWatch, plural } from '../ui/format.ts'
import { sagaColor } from '../ui/sagas.ts'
import type { useActions } from '../ui/useActions.ts'
import { MoreMenu, type MenuItem } from './MoreMenu.tsx'
import { SeasonRow } from './SeasonCard.tsx'
import { Sheet } from './Sheet.tsx'
import { SeasonFields } from './TitleForm.tsx'
import { WatchHistory, WatchList } from './WatchHistory.tsx'

type Actions = ReturnType<typeof useActions>

/** What the panel shows besides its main view. */
type Subview =
  | { kind: 'history'; seasonId: string | null; editId?: string; adding?: boolean }
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
    return <WatchHistory view={view} season={seasonOf(sub.seasonId)} actions={actions} editId={sub.editId} adding={sub.adding} onBack={back} />
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
  return (
    <>
      {(view.title.posterPath || view.title.overview) && (
        <div className="mt-1 mb-3 flex items-start gap-3">
          {view.title.posterPath && (
            <img
              src={`${import.meta.env.BASE_URL}${view.title.posterPath}`}
              alt=""
              width={342}
              height={513}
              className="aspect-[2/3] w-28 shrink-0 rounded-lg bg-raised object-cover sm:w-36"
            />
          )}
          {view.title.overview && <Synopsis text={view.title.overview} />}
        </div>
      )}
      {view.title.type === 'series' ? (
        <SeriesBody
          view={view}
          actions={actions}
          extraItems={titleItems}
          onHistory={(seasonId) => setSub({ kind: 'history', seasonId })}
          onEditSeason={(seasonId) => setSub({ kind: 'season', seasonId })}
        />
      ) : (
        <MovieBody
          view={view}
          actions={actions}
          extraItems={titleItems}
          onHistory={() => setSub({ kind: 'history', seasonId: null })}
          onAddWatch={() => setSub({ kind: 'history', seasonId: null, adding: true })}
        />
      )}
    </>
  )
}

/**
 * TMDB's synopsis, cut to about the poster's height (5 lines on phones, 7 wider) until you ask for
 * the rest. "More" shows only when the text really is cut off at the panel's current width, which a
 * ResizeObserver re-checks as the panel or text changes.
 */
function Synopsis({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const [clipped, setClipped] = useState(false)
  const ref = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || open) return
    // Fires once on observe, then whenever the paragraph's size changes.
    const observer = new ResizeObserver(() => setClipped(el.scrollHeight > el.clientHeight + 1))
    observer.observe(el)
    return () => observer.disconnect()
  }, [text, open])

  return (
    <div className="min-w-0 text-base">
      <p ref={ref} id="synopsis" className={open ? '' : 'line-clamp-5 sm:line-clamp-7'}>
        {text}
      </p>
      {(clipped || open) && (
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="synopsis"
          className="-ml-1 mt-0.5 min-h-8 rounded px-1 font-bold text-muted hover:text-fg"
        >
          {open ? 'Less' : 'More'}
        </button>
      )}
    </div>
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

/** A movie's length, or a show's once every season's is known. */
function runtimeOf(view: TitleView): number | null {
  if (view.title.type !== 'series') return view.title.runtime ?? null
  const seasons = view.seasons
  return seasons.length && seasons.every((s) => s.runtime) ? seasons.reduce((sum, s) => sum + s.runtime!, 0) : null
}

function Facts({ view }: { view: TitleView }) {
  const { title } = view
  const today = todayIso()
  const upcoming = title.releaseDate && !isReleased(title.releaseDate, today)
  const runtime = runtimeOf(view)
  return (
    <>
      <p className="flex flex-wrap gap-x-3">
        <span>{title.saga}</span>
        {title.phase !== null && <span>Phase {title.phase}</span>}
        {title.studio !== title.saga && <span>{title.studio}</span>}
      </p>
      <p className="mt-0.5">
        {title.releaseDate
          ? upcoming
            ? formatCountdown(title.releaseDate, today)
            : `${title.type === 'series' ? 'Premiered' : 'Released'} ${formatDate(title.releaseDate)}`
          : 'Release date to be announced'}
        {title.note && <span> ({title.note})</span>}
        {runtime && <span> · {title.type === 'series' ? `${formatRuntime(runtime)} in all` : formatRuntime(runtime)}</span>}
      </p>
      {title.custom && <p className="mt-0.5">Added by you</p>}
    </>
  )
}

/**
 * Face up: when you last watched it and how many times, and logging another watch, today or on
 * another date. Every date lives in Watch history.
 */
function MovieBody({
  view,
  actions,
  onHistory,
  onAddWatch,
  extraItems,
}: {
  view: TitleView
  actions: Actions
  onHistory: () => void
  onAddWatch: () => void
  extraItems: MenuItem[]
}) {
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
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() =>
            actions.logWatch(view, { startDate: today, endDate: today }, finished.length ? `Logged a rewatch of ${view.title.title}` : `Checked off ${view.title.title}`)
          }
          className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary"
        >
          {finished.length ? 'Log a rewatch today' : 'Watched it today'}
        </button>
        <button onClick={onAddWatch} className="min-h-11 rounded-lg bg-raised px-4 font-bold hover:bg-line">
          Another date
        </button>
      </div>
      {/* Desktop has the room to show every watch face up; phones keep it behind Watch history. */}
      {view.watches.length > 0 && (
        <section aria-label="Watches" className="mt-5 hidden lg:block">
          <h3 className="font-display text-xl font-semibold">Watch history</h3>
          <WatchList view={view} season={null} actions={actions} className="mt-1 max-h-80 overflow-y-auto overscroll-contain pr-1" />
        </section>
      )}
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
  const { summary, title } = view
  const color = sagaColor(title.saga)
  const statusOf = (s: Season) => seasonStatus(s, view.watches, today)
  const remaining = view.seasons.filter((s) => isReleased(s.premiereDate, today) && statusOf(s) === 'unwatched')
  // With two seasons underway (one dropped halfway, say), the summary follows the one touched last,
  // as Home's spotlight does, and mentions the other.
  const seasonOfWatch = (w: Watch) => view.seasons.find((s) => s.id === w.seasonId) ?? null
  const openWatches = view.watches.filter(isOpen).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const openWatch = openWatches[0]
  const current = openWatch ? seasonOfWatch(openWatch) : null
  const alsoOpen = openWatches.slice(1).map(seasonOfWatch).filter((s): s is Season => s !== null)
  const nextSeason = current ? null : (remaining[0] ?? null)
  const nextOut = view.seasons.find((s) => statusOf(s) === 'upcoming')

  // The season you're watching starts open; one you start from here opens too.
  const currentId = current?.id ?? null
  const [expanded, setExpanded] = useState<string | null>(currentId)
  const [seenCurrent, setSeenCurrent] = useState(currentId)
  if (currentId !== seenCurrent) {
    setSeenCurrent(currentId)
    if (currentId) setExpanded(currentId)
  }

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

  const seasonsLine = `${summary.seasonsDone} of ${plural(summary.seasonsReleased, 'season')} watched`
  const count = current?.episodeCount ?? null
  const done = openWatch?.episodesWatched ?? 0
  const pct = current && count ? done / count : summary.seasonsReleased ? summary.seasonsDone / summary.seasonsReleased : 0

  return (
    <section className="mt-2">
      {/* Where you are with the show, and the one thing to do next. */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-semibold">
            {summary.seasonsReleased === 0
              ? 'No seasons out yet'
              : current
                ? `Watching ${current.label}`
                : summary.status === 'watched'
                  ? 'All caught up'
                  : seasonsLine}
          </h3>
          <p className="text-sm text-muted">
            {current
              ? `${count !== null ? `Episode ${done} of ${count}` : `${plural(done, 'episode')} watched`} · ${
                  alsoOpen.length ? `${alsoOpen.map((s) => s.label).join(', ')} also in progress` : seasonsLine
                }`
              : nextSeason
                ? `Up next: ${nextSeason.label}`
                : nextOut?.premiereDate
                  ? `${nextOut.label}: ${lowerFirst(formatCountdown(nextOut.premiereDate, today))}`
                  : summary.watchCount > 1
                    ? `Watched the whole show ${plural(summary.watchCount, 'time')}`
                    : null}
          </p>
        </div>
        <MoreMenu label={`More for ${title.title}`} items={menu} />
      </div>
      {summary.seasonsReleased > 0 && (
        <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
          <span className="block h-full rounded-full transition-[width]" style={{ width: `${pct * 100}%`, background: color }} />
        </span>
      )}
      {current && openWatch ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {(count === null || done < count) && (
            <button
              onClick={() => actions.setEpisodes(openWatch.id, done + 1, count)}
              aria-label={`One more episode of ${title.title} ${current.label}`}
              className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary hover:brightness-110"
            >
              +1 episode
            </button>
          )}
          <button
            onClick={() => actions.finishSeason(view, current, openWatch.id)}
            aria-label={`Finish ${title.title} ${current.label} today`}
            className={`min-h-11 rounded-lg px-4 font-bold ${count !== null && done >= count ? 'bg-primary text-on-primary' : 'bg-raised hover:bg-line'}`}
          >
            Finish season
          </button>
        </div>
      ) : (
        nextSeason && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => actions.startSeason(view, nextSeason)} className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary hover:brightness-110">
              Start {nextSeason.label}
            </button>
            <button
              onClick={() => actions.markSeasonWatched(view, nextSeason)}
              aria-label={`${nextSeason.label} watched today`}
              className="min-h-11 rounded-lg bg-raised px-4 font-bold hover:bg-line"
            >
              Watched it today
            </button>
          </div>
        )
      )}

      <h3 className="mt-6 text-xs font-bold tracking-[0.14em] text-muted uppercase">Seasons</h3>
      <ol className="mt-1">
        {view.seasons.map((s) => (
          <SeasonRow
            key={s.id}
            view={view}
            season={s}
            actions={actions}
            expanded={expanded === s.id}
            onExpand={(open) => setExpanded(open ? s.id : null)}
            onHistory={() => onHistory(s.id)}
            onEdit={() => onEditSeason(s.id)}
          />
        ))}
      </ol>
    </section>
  )
}

const lowerFirst = (s: string) => s[0].toLowerCase() + s.slice(1)
