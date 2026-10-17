import type { ReactNode } from 'react'
import type { TitleView } from '../lib/catalogView.ts'
import { todayIso } from '../lib/partialDate.ts'
import { formatDate, formatWatch } from '../ui/format.ts'
import { continueWatching, recentlyWatched, type HomeItem } from '../ui/home.ts'
import { sagaColor } from '../ui/sagas.ts'
import type { useActions } from '../ui/useActions.ts'

type Actions = ReturnType<typeof useActions>

const nameOf = (i: HomeItem) => (i.season ? `${i.view.title.title} ${i.season.label}` : i.view.title.title)

/** Shortcuts before the full list: what you're in the middle of, and what you just watched. */
export function Home({ views, actions, onOpen, onBrowse }: { views: TitleView[]; actions: Actions; onOpen: (id: string) => void; onBrowse: () => void }) {
  const watching = continueWatching(views)
  const recent = recentlyWatched(views)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 px-3 pb-8 sm:px-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
      <section aria-labelledby="home-watching" className="min-w-0">
        <SectionHeading id="home-watching" count={watching.length}>
          Continue watching
        </SectionHeading>
        {watching.length === 0 ? (
          <Empty>
            Nothing in progress. Open a show and tap <span className="font-bold">Start watching</span> to keep your place here.
          </Empty>
        ) : (
          <ul className="space-y-3">
            {watching.map((i) => (
              <WatchingCard key={i.watch.id} item={i} actions={actions} onOpen={onOpen} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="home-recent" className="min-w-0">
        <SectionHeading id="home-recent">Recently watched</SectionHeading>
        {recent.length === 0 ? (
          <Empty>Check off a movie or finish a season and it shows up here.</Empty>
        ) : (
          // A swipeable row on phones, a list beside "Continue watching" on desktop.
          <ul className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 sm:-mx-4 sm:px-4 lg:mx-0 lg:grid lg:overflow-visible lg:px-0">
            {recent.map((i) => (
              <li key={i.watch.id} className="w-40 shrink-0 snap-start lg:w-auto">
                <button
                  onClick={() => onOpen(i.view.title.id)}
                  className="flex h-full w-full flex-col rounded-xl border border-line bg-surface p-3 text-left hover:border-muted lg:flex-row lg:items-baseline lg:gap-3"
                  style={{ boxShadow: `inset 0 3px 0 ${sagaColor(i.view.title.saga)}` }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-display text-lg leading-tight font-semibold">{i.view.title.title}</span>
                    {i.season && <span className="block text-sm text-muted">{i.season.label}</span>}
                  </span>
                  <span className="mt-auto pt-2 text-sm text-muted lg:pt-0">{formatDate(i.watch.endDate!)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="lg:col-span-2">
        <button onClick={onBrowse} className="min-h-11 w-full rounded-lg bg-raised px-4 font-bold hover:bg-line sm:w-auto">
          Browse all titles
        </button>
      </div>
    </div>
  )
}

function WatchingCard({ item, actions, onOpen }: { item: HomeItem; actions: Actions; onOpen: (id: string) => void }) {
  const { view, season, watch } = item
  const count = season?.episodeCount ?? null
  const done = watch.episodesWatched ?? 0
  const atEnd = count !== null && done >= count
  const name = nameOf(item)

  return (
    <li className="rounded-xl border border-line bg-surface p-3" style={{ boxShadow: `inset 4px 0 0 ${sagaColor(view.title.saga)}` }}>
      <button onClick={() => onOpen(view.title.id)} className="block w-full rounded-lg pl-1 text-left">
        <span className="block font-display text-xl leading-tight font-semibold">{view.title.title}</span>
        <span className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted">
          {season && <span className="text-fg">{season.label}</span>}
          <span>{formatWatch(watch)}</span>
        </span>
      </button>
      {season && (
        <div className="mt-3 flex items-center gap-3 pl-1">
          {count !== null ? (
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-label={`${name} episodes`} aria-valuemin={0} aria-valuemax={count} aria-valuenow={done}>
              <span className="block h-full rounded-full transition-[width]" style={{ width: `${(done / count) * 100}%`, background: sagaColor(view.title.saga) }} />
            </span>
          ) : (
            <span className="flex-1" />
          )}
          <span className="text-sm text-muted tabular-nums">
            {count !== null ? `${done} / ${count}` : `${done} watched`}
          </span>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        {season && !atEnd && (
          <button
            onClick={() => actions.setEpisodes(watch.id, done + 1, count)}
            aria-label={`One more episode of ${name}`}
            className="min-h-11 rounded-lg bg-raised px-4 text-sm font-bold hover:bg-line"
          >
            +1 episode
          </button>
        )}
        <button
          onClick={() =>
            season
              ? actions.finishSeason(view, season, watch.id)
              : actions.updateWatch(watch.id, { endDate: todayIso(), episodesWatched: null }, `Finished ${view.title.title}`)
          }
          aria-label={`Finish ${name} today`}
          className={`min-h-11 rounded-lg px-4 text-sm font-bold ${atEnd ? 'bg-primary text-on-primary' : 'text-muted hover:bg-raised hover:text-fg'}`}
        >
          Finish
        </button>
      </div>
    </li>
  )
}

function SectionHeading({ id, count, children }: { id: string; count?: number; children: string }) {
  return (
    <h2 id={id} className="mb-3 flex items-baseline gap-2 font-display text-[1.75rem] leading-none font-semibold tracking-tight">
      {children}
      {count !== undefined && count > 0 && <span className="font-sans text-sm font-normal text-muted tabular-nums">{count}</span>}
    </h2>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">{children}</p>
}
