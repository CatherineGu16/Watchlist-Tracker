import type { ReactNode } from 'react'
import type { TitleView } from '../lib/catalogView.ts'
import { todayIso } from '../lib/partialDate.ts'
import { isFinished } from '../lib/status.ts'
import { formatDate, formatWatch } from '../ui/format.ts'
import { continueWatching, recentlyWatched, upNext, type HomeItem } from '../ui/home.ts'
import { sagaColor } from '../ui/sagas.ts'
import type { useActions } from '../ui/useActions.ts'
import { Poster } from './Poster.tsx'

type Actions = ReturnType<typeof useActions>

const nameOf = (i: HomeItem) => (i.season ? `${i.view.title.title} ${i.season.label}` : i.view.title.title)

/**
 * Laid out like a streaming service's home: what you watched last as a spotlight, then rows of
 * posters for everything else in progress, what to watch next, and what you just watched.
 */
export function Home({ views, actions, onOpen }: { views: TitleView[]; actions: Actions; onOpen: (id: string) => void }) {
  const watching = continueWatching(views)
  const [spotlight, ...more] = watching
  const recent = recentlyWatched(views)
  const next = upNext(views)

  return (
    <div className="space-y-10 px-3 pt-2 pb-10 sm:px-4 lg:pt-4">
      <section aria-labelledby="home-watching" className="min-w-0">
        <SectionHeading id="home-watching" count={watching.length}>
          Continue watching
        </SectionHeading>
        {spotlight ? (
          <ul>
            <Spotlight item={spotlight} actions={actions} onOpen={onOpen} />
          </ul>
        ) : (
          <p className="rounded-xl bg-surface p-5 text-muted">Nothing in progress</p>
        )}
        {more.length > 0 && (
          <PosterRow className="mt-5">
            {more.map((i) => (
              <WatchingCard key={i.watch.id} item={i} actions={actions} onOpen={onOpen} />
            ))}
          </PosterRow>
        )}
      </section>

      {next.length > 0 && (
        <section aria-labelledby="home-next" className="min-w-0">
          <SectionHeading id="home-next" note="Next in the MCU, in release order">
            Up next
          </SectionHeading>
          <PosterRow>
            {next.map((v) => (
              <li key={v.title.id} className={ITEM}>
                <button onClick={() => onOpen(v.title.id)} className="group block w-full text-left">
                  <Poster title={v.title} className="transition-transform group-hover:-translate-y-1" />
                  <CardText title={v.title.title} sub={v.title.releaseDate?.slice(0, 4) ?? ''} />
                </button>
              </li>
            ))}
          </PosterRow>
        </section>
      )}

      <section aria-labelledby="home-recent" className="min-w-0">
        <SectionHeading id="home-recent">Recently watched</SectionHeading>
        {recent.length === 0 ? (
          <p className="rounded-xl bg-surface p-5 text-muted">Check off a movie or finish a season and it shows up here.</p>
        ) : (
          <PosterRow>
            {recent.map((i) => (
              <RecentCard key={i.watch.id} item={i} onOpen={onOpen} />
            ))}
          </PosterRow>
        )}
      </section>
    </div>
  )
}

/**
 * Phones: a row that swipes sideways past the page margin, each card snapping to the margin.
 * Wider screens: six across, filling the page.
 */
function PosterRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <ul
      className={`-mx-3 flex snap-x snap-mandatory scroll-px-3 gap-3 overflow-x-auto px-3 pt-1 pb-2 sm:-mx-4 sm:scroll-px-4 sm:px-4 lg:mx-0 lg:grid lg:grid-cols-6 lg:gap-5 lg:overflow-visible lg:px-0 ${className}`}
    >
      {children}
    </ul>
  )
}

const ITEM = 'w-28 shrink-0 snap-start sm:w-32 lg:w-auto'

function CardText({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <>
      <span className="mt-2 block truncate font-display text-base leading-tight font-semibold">{title}</span>
      {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
    </>
  )
}

/** Episodes watched, as a bar along the poster's bottom edge. */
function PosterProgress({ name, done, count, color }: { name: string; done: number; count: number; color: string }) {
  return (
    <span
      className="absolute inset-x-0 bottom-0 h-1.5 bg-black/55"
      role="progressbar"
      aria-label={`${name} episodes`}
      aria-valuemin={0}
      aria-valuemax={count}
      aria-valuenow={done}
    >
      <span className="block h-full transition-[width]" style={{ width: `${(done / count) * 100}%`, background: color }} />
    </span>
  )
}

/** One more episode, or finish it today: the two things you do with something in progress. */
function WatchButtons({ item, actions, size }: { item: HomeItem; actions: Actions; size: 'large' | 'small' }) {
  const { view, season, watch } = item
  const count = season?.episodeCount ?? null
  const done = watch.episodesWatched ?? 0
  const atEnd = count !== null && done >= count
  const name = nameOf(item)
  const base = size === 'large' ? 'min-h-11 rounded-lg px-4 font-bold' : 'min-h-9 rounded-lg px-2.5 text-xs font-bold'
  return (
    <div className={`flex flex-wrap ${size === 'large' ? 'gap-2' : 'gap-1.5'}`}>
      {season && !atEnd && (
        <button
          onClick={() => actions.setEpisodes(watch.id, done + 1, count)}
          aria-label={`One more episode of ${name}`}
          className={`${base} ${size === 'large' ? 'bg-primary text-on-primary hover:brightness-110' : 'bg-raised hover:bg-line'}`}
        >
          {size === 'large' ? '+1 episode' : '+1'}
        </button>
      )}
      <button
        onClick={() =>
          season
            ? actions.finishSeason(view, season, watch.id)
            : actions.updateWatch(watch.id, { endDate: todayIso(), episodesWatched: null }, `Finished ${view.title.title}`)
        }
        aria-label={`Finish ${name} today`}
        className={`${base} ${atEnd ? 'bg-primary text-on-primary hover:brightness-110' : 'bg-raised text-muted hover:bg-line hover:text-fg'}`}
      >
        Finish
      </button>
    </div>
  )
}

/** The show you touched last, large, with its poster. */
function Spotlight({ item, actions, onOpen }: { item: HomeItem; actions: Actions; onOpen: (id: string) => void }) {
  const { view, season, watch } = item
  const { title } = view
  const count = season?.episodeCount ?? null
  const done = watch.episodesWatched ?? 0
  const color = sagaColor(title.saga)

  return (
    <li className="rounded-2xl bg-surface shadow-[0_10px_40px_rgb(0_0_0/0.35)]">
      <div className="flex gap-4 p-4 sm:gap-6 sm:p-6 lg:gap-8 lg:p-8">
        <button onClick={() => onOpen(title.id)} aria-label={`Open ${title.title}`} className="w-24 shrink-0 sm:w-36 lg:w-44">
          <Poster title={title} />
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-xs font-bold tracking-[0.18em] uppercase" style={{ color }}>
            Pick up where you left off
          </p>
          <button onClick={() => onOpen(title.id)} className="mt-1 text-left">
            <span className="block font-poster text-[2rem] leading-[1.05] tracking-wide uppercase">{title.title}</span>
          </button>
          <p className="mt-1.5 flex flex-wrap gap-x-3 text-sm text-muted">
            {season && <span className="text-fg">{season.label}</span>}
            <span>{formatWatch(watch)}</span>
          </p>
          {title.overview && <p className="mt-3 hidden text-base sm:line-clamp-2 lg:line-clamp-3 lg:max-w-2xl">{title.overview}</p>}
          {season && (
            <div className="mt-4 flex items-center gap-3 lg:max-w-md">
              {count !== null ? (
                <span
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"
                  role="progressbar"
                  aria-label={`${nameOf(item)} episodes`}
                  aria-valuemin={0}
                  aria-valuemax={count}
                  aria-valuenow={done}
                >
                  <span className="block h-full rounded-full transition-[width]" style={{ width: `${(done / count) * 100}%`, background: color }} />
                </span>
              ) : (
                <span className="flex-1" />
              )}
              <span className="text-sm text-muted tabular-nums">{count !== null ? `${done} / ${count}` : `${done} watched`}</span>
            </div>
          )}
          <div className="mt-4 sm:mt-auto sm:pt-4">
            <WatchButtons item={item} actions={actions} size="large" />
          </div>
        </div>
      </div>
    </li>
  )
}

function WatchingCard({ item, actions, onOpen }: { item: HomeItem; actions: Actions; onOpen: (id: string) => void }) {
  const { view, season, watch } = item
  const count = season?.episodeCount ?? null
  const done = watch.episodesWatched ?? 0
  return (
    <li className={ITEM}>
      <button onClick={() => onOpen(view.title.id)} className="group block w-full text-left">
        <Poster title={view.title} className="transition-transform group-hover:-translate-y-1">
          {count !== null && <PosterProgress name={nameOf(item)} done={done} count={count} color={sagaColor(view.title.saga)} />}
        </Poster>
        <CardText title={view.title.title} sub={season ? `${season.label} · ${count !== null ? `${done} / ${count}` : `${done} watched`}` : formatWatch(watch)} />
      </button>
      <div className="mt-2">
        <WatchButtons item={item} actions={actions} size="small" />
      </div>
    </li>
  )
}

function RecentCard({ item, onOpen }: { item: HomeItem; onOpen: (id: string) => void }) {
  const { view, season, watch } = item
  const times = view.watches.filter((w) => w.seasonId === (season?.id ?? null) && isFinished(w)).length
  return (
    <li className={ITEM}>
      <button onClick={() => onOpen(view.title.id)} className="group block w-full text-left">
        <Poster title={view.title} className="transition-transform group-hover:-translate-y-1">
          <span
            className="absolute top-1.5 right-1.5 flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-full px-1.5 text-xs font-bold text-bg shadow"
            style={{ background: sagaColor(view.title.saga) }}
            aria-hidden="true"
          >
            <svg viewBox="0 0 16 16" className="size-3.5">
              <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {times > 1 && <span className="tabular-nums">×{times}</span>}
          </span>
        </Poster>
        <CardText
          title={view.title.title}
          sub={
            <>
              {season && `${season.label} · `}
              {formatDate(watch.endDate!)}
            </>
          }
        />
      </button>
    </li>
  )
}

function SectionHeading({ id, count, note, children }: { id: string; count?: number; note?: string; children: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 id={id} className="flex items-baseline gap-2 font-display text-2xl leading-none font-medium tracking-wide uppercase">
        {children}
        {count !== undefined && count > 0 && <span className="font-sans text-sm font-normal tracking-normal text-muted tabular-nums">{count}</span>}
      </h2>
      {note && <p className="text-sm text-muted">{note}</p>}
    </div>
  )
}
