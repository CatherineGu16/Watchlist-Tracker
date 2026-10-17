import { useState } from 'react'
import { comparePartialDates } from '../lib/partialDate.ts'
import type { Watch } from '../lib/types.ts'
import type { WatchPatch } from '../lib/watchActions.ts'
import { formatWatch } from '../ui/format.ts'
import { DateField } from './DateField.tsx'

type WatchFields = Pick<Watch, 'startDate' | 'endDate' | 'approximate' | 'note'>

/**
 * One viewing in a watch history. Movies edit a single date (start = end); seasons edit start and
 * end separately, and an open season watch has no end yet.
 */
export function WatchItem({
  watch,
  index,
  kind,
  onSave,
  onDelete,
  initiallyEditing = false,
}: {
  watch: Watch
  /** Position in viewing order: 0 = first watch. */
  index: number
  kind: 'single' | 'range'
  onSave: (patch: WatchPatch) => void
  onDelete: () => void
  initiallyEditing?: boolean
}) {
  const [editing, setEditing] = useState(initiallyEditing)
  const ordinal = index === 0 ? 'First watch' : `Rewatch ${index}`

  if (!editing) {
    return (
      <li className="flex items-center gap-3 py-2">
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted">{ordinal}</span>
          <span className="block">{formatWatch(watch)}</span>
          {watch.note && <span className="block text-sm text-muted">{watch.note}</span>}
        </span>
        <button
          className="min-h-10 rounded-lg px-3 text-sm font-bold text-muted hover:bg-raised hover:text-fg"
          onClick={() => setEditing(true)}
          aria-label={`Edit ${ordinal.toLowerCase()}`}
        >
          Edit
        </button>
      </li>
    )
  }

  return (
    <li className="my-2">
      <WatchEditor
        initial={watch}
        kind={kind}
        stillWatching={watch.endDate === null && watch.startDate !== null}
        onSave={(patch) => {
          onSave(patch)
          setEditing(false)
        }}
        onCancel={() => setEditing(false)}
        onDelete={onDelete}
      />
    </li>
  )
}

/** The date form, for editing a watch or adding one you had before. */
export function WatchEditor({
  initial,
  kind,
  stillWatching = false,
  saveLabel = 'Save',
  onSave,
  onCancel,
  onDelete,
}: {
  initial: WatchFields
  kind: 'single' | 'range'
  /** An open season watch: its finish date is set with Finish, not here. */
  stillWatching?: boolean
  saveLabel?: string
  onSave: (patch: WatchPatch) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [draft, setDraft] = useState<WatchPatch>({})
  const merged = { ...initial, ...draft }

  // Compare at the coarser precision: "2024" is not before "2024-03-04".
  const len = Math.min(merged.startDate?.length ?? 0, merged.endDate?.length ?? 0)
  const invalid =
    kind === 'range' && len > 0 && comparePartialDates(merged.endDate!.slice(0, len), merged.startDate!.slice(0, len)) < 0

  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="grid gap-4 sm:grid-cols-2">
        {kind === 'single' ? (
          <DateField label="Watched on" value={merged.endDate} onChange={(d) => setDraft({ ...draft, startDate: d, endDate: d })} />
        ) : (
          <>
            <DateField
              label="Started"
              value={merged.startDate}
              unknownHint="Start date unknown."
              onChange={(d) => setDraft({ ...draft, startDate: d })}
            />
            {stillWatching && merged.endDate === null ? (
              <div>
                <p className="mb-1.5 text-sm font-bold">Finished</p>
                <p className="text-sm text-muted">Still watching. Use Finish when you're done.</p>
              </div>
            ) : (
              // With a start date, an unknown finish would read as still watching.
              <DateField
                label="Finished"
                value={merged.endDate}
                allowUnknown={merged.startDate === null}
                onChange={(d) => setDraft({ ...draft, endDate: d })}
              />
            )}
          </>
        )}
      </div>
      <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={merged.approximate}
          onChange={(e) => setDraft({ ...draft, approximate: e.target.checked })}
          className="size-5 accent-[var(--primary)]"
        />
        Approximate date
      </label>
      <label className="mt-1 block text-sm">
        <span className="font-bold">Note</span>
        <input
          type="text"
          value={merged.note}
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          placeholder="Optional, e.g. in theaters with friends"
          className="mt-1.5 h-11 w-full rounded-lg border border-line bg-bg px-3 text-base placeholder:text-muted"
        />
      </label>
      {invalid && <p className="mt-2 text-sm text-danger">The finish date is before the start date.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          disabled={Boolean(invalid)}
          onClick={() => onSave(draft)}
          className="min-h-11 rounded-lg bg-primary px-4 font-bold text-on-primary disabled:opacity-50"
        >
          {saveLabel}
        </button>
        <button onClick={onCancel} className="min-h-11 rounded-lg px-4 font-bold text-muted hover:bg-raised hover:text-fg">
          Cancel
        </button>
        {onDelete && (
          <button onClick={onDelete} className="ml-auto min-h-11 rounded-lg px-4 font-bold text-danger hover:bg-raised">
            Remove
          </button>
        )}
      </div>
    </div>
  )
}
