import { useState } from 'react'
import type { TitleView } from '../lib/catalogView.ts'
import { todayIso } from '../lib/partialDate.ts'
import { compareWatches } from '../lib/status.ts'
import type { Season } from '../lib/types.ts'
import { plural } from '../ui/format.ts'
import type { useActions } from '../ui/useActions.ts'
import { WatchEditor, WatchItem } from './WatchItem.tsx'

type Actions = ReturnType<typeof useActions>

/** Every viewing of a movie or one season, newest first, each editable; plus adding one from before. */
export function WatchHistory({
  view,
  season,
  actions,
  editId,
  onBack,
}: {
  view: TitleView
  season: Season | null
  actions: Actions
  /** Opens this watch's editor straight away (from "Change date"). */
  editId?: string
  onBack: () => void
}) {
  const [adding, setAdding] = useState(false)
  const name = season ? `${view.title.title} ${season.label}` : view.title.title
  const kind = season ? 'range' : 'single'
  const watches = view.watches.filter((w) => w.seasonId === (season?.id ?? null)).sort(compareWatches)
  const today = todayIso()

  return (
    <section className="mt-1" aria-label="Watch history">
      <button onClick={onBack} className="-ml-2 inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-bold text-muted hover:text-fg">
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
          <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back
      </button>
      <h3 className="mt-1 font-display text-xl font-semibold">
        {season ? `${season.label}: watch history` : 'Watch history'}
      </h3>
      <p className="text-sm text-muted">{watches.length ? plural(watches.length, 'watch', 'watches') : 'No watches yet.'}</p>

      {adding ? (
        <div className="mt-3">
          <WatchEditor
            initial={{ startDate: today, endDate: today, approximate: false, note: '' }}
            kind={kind}
            saveLabel="Add watch"
            onSave={(patch) => {
              actions.logWatch(
                view,
                {
                  seasonId: season?.id ?? null,
                  startDate: patch.startDate !== undefined ? patch.startDate : today,
                  endDate: patch.endDate !== undefined ? patch.endDate : today,
                  approximate: patch.approximate ?? false,
                  note: patch.note ?? '',
                },
                `Added a watch of ${name}`,
              )
              setAdding(false)
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-3 min-h-11 rounded-lg bg-raised px-4 text-sm font-bold hover:bg-line">
          Add a past watch
        </button>
      )}

      {watches.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {/* Newest first; the label still counts from the first viewing. */}
          {watches
            .map((w, i) => ({ w, i }))
            .reverse()
            .map(({ w, i }) => (
              <WatchItem
                key={w.id}
                watch={w}
                index={i}
                kind={kind}
                initiallyEditing={w.id === editId}
                onSave={(patch) => actions.updateWatch(w.id, patch, `Updated ${name}`)}
                onDelete={() => actions.deleteWatch(w.id, `Removed a watch of ${name}`)}
              />
            ))}
        </ul>
      )}
    </section>
  )
}
