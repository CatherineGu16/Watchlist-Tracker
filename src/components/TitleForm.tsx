import { useId, useState, type ReactNode } from 'react'
import type { TitleView } from '../lib/catalogView.ts'
import type { SeasonInput, TitleInput } from '../lib/customTitles.ts'
import type { TitleType, Universe } from '../lib/types.ts'
import { normalize } from '../ui/listQuery.ts'
import { SAGA_ORDER } from '../ui/sagas.ts'
import { DateField } from './DateField.tsx'
import { Sheet } from './Sheet.tsx'

const TYPES: { id: TitleType; label: string }[] = [
  { id: 'movie', label: 'Movie' },
  { id: 'series', label: 'Show' },
  { id: 'special', label: 'Special' },
]
const NEW_SAGA = '__new__'

const EMPTY_TITLE: TitleInput = {
  title: '',
  type: 'movie',
  releaseDate: null,
  universe: 'mcu',
  saga: 'Multiverse Saga',
  phase: null,
  studio: '',
  note: '',
}

/**
 * Add a movie, show or special the catalog doesn't have, or edit one you added. Shows start with
 * one season; more can be added here or later from the show's ⋯ menu.
 */
export function TitleForm({
  open,
  onOpenChange,
  views,
  editing,
  onSave,
  onOpenExisting,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  views: TitleView[]
  /** Set when editing a title you added; seasons are then edited from the show itself. */
  editing?: TitleView | null
  onSave: (input: TitleInput, seasons: SeasonInput[]) => void
  onOpenExisting: (id: string) => void
}) {
  const formId = useId()
  const [input, setInput] = useState<TitleInput>(EMPTY_TITLE)
  const [seasons, setSeasons] = useState<SeasonInput[]>([{ episodeCount: null, premiereDate: null }])
  const [newSaga, setNewSaga] = useState(false)
  const [tried, setTried] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  // Fresh form each time it opens: blank for Add, the title's values for Edit.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      const t = editing?.title
      setInput(t ? { title: t.title, type: t.type, releaseDate: t.releaseDate, universe: t.universe, saga: t.saga, phase: t.phase, studio: t.studio, note: t.note ?? '' } : EMPTY_TITLE)
      setSeasons([{ episodeCount: null, premiereDate: null }])
      setNewSaga(false)
      setTried(false)
    }
  }

  const sagas = [...new Set([...SAGA_ORDER, ...views.map((v) => v.title.saga)])]
  const year = input.releaseDate?.slice(0, 4)
  const duplicate = input.title.trim()
    ? views.find(
        (v) => v.title.id !== editing?.title.id && normalize(v.title.title) === normalize(input.title) && (!year || v.title.releaseDate?.startsWith(year)),
      )
    : undefined
  const missingName = !input.title.trim()
  const missingSaga = !input.saga.trim()
  const isShow = input.type === 'series' && !editing

  const set = (patch: Partial<TitleInput>) => setInput((i) => ({ ...i, ...patch }))

  function submit() {
    setTried(true)
    if (missingName || missingSaga) return
    onSave({ ...input, saga: input.saga.trim(), studio: input.studio.trim(), note: input.note.trim() }, isShow ? seasons : [])
    onOpenChange(false)
  }

  const field = 'mt-1.5 h-11 w-full rounded-lg border border-line bg-bg px-3 text-base'

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit title' : 'Add a title'}
      description={editing ? undefined : 'For anything the list is missing. It syncs to your other devices.'}
      footer={
        <div className="flex gap-2">
          <button onClick={() => onOpenChange(false)} className="min-h-11 rounded-lg px-4 font-bold text-muted hover:bg-raised hover:text-fg">
            Cancel
          </button>
          <button type="submit" form={formId} className="ml-auto min-h-11 flex-1 rounded-lg bg-primary px-4 font-bold text-on-primary sm:flex-none">
            {editing ? 'Save changes' : 'Add title'}
          </button>
        </div>
      }
    >
      <form
        id={formId}
        className="mt-1 space-y-5 text-sm"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        noValidate
      >
        <label className="block">
          <span className="font-bold">Title</span>
          <input
            value={input.title}
            onChange={(e) => set({ title: e.target.value })}
            aria-invalid={tried && missingName}
            aria-describedby={tried && missingName ? `${formId}-name` : undefined}
            className={field}
          />
          {tried && missingName && (
            <span id={`${formId}-name`} className="mt-1 block text-danger">
              Give it a name.
            </span>
          )}
        </label>
        {duplicate && (
          <p role="status" className="rounded-lg bg-raised p-3">
            <span className="font-bold">{duplicate.title.title}</span> ({duplicate.title.releaseDate?.slice(0, 4) ?? 'TBA'}) is already in your list.{' '}
            <button type="button" onClick={() => onOpenExisting(duplicate.title.id)} className="font-bold underline">
              Open it
            </button>
          </p>
        )}

        <Choice label="Type">
          {TYPES.map((t) => (
            <ChoiceButton key={t.id} on={input.type === t.id} disabled={Boolean(editing)} onClick={() => set({ type: t.id })}>
              {t.label}
            </ChoiceButton>
          ))}
        </Choice>

        <DateField
          label={input.type === 'series' ? 'Premiere date' : 'Release date'}
          value={input.releaseDate}
          unknownHint="Not announced yet. It will show as upcoming."
          onChange={(d) => set({ releaseDate: d })}
        />

        <Choice label="Where it goes">
          {(['mcu', 'other'] as Universe[]).map((u) => (
            <ChoiceButton key={u} on={input.universe === u} onClick={() => set({ universe: u })}>
              {u === 'mcu' ? 'MCU' : 'Other Marvel'}
            </ChoiceButton>
          ))}
        </Choice>

        <label className="block">
          <span className="font-bold">Saga</span>
          <select
            value={newSaga ? NEW_SAGA : input.saga}
            onChange={(e) => {
              if (e.target.value === NEW_SAGA) {
                setNewSaga(true)
                set({ saga: '' })
              } else {
                setNewSaga(false)
                set({ saga: e.target.value })
              }
            }}
            className={field}
          >
            {sagas.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value={NEW_SAGA}>New saga…</option>
          </select>
        </label>
        {newSaga && (
          <label className="block">
            <span className="font-bold">New saga name</span>
            <input value={input.saga} onChange={(e) => set({ saga: e.target.value })} aria-invalid={tried && missingSaga} className={field} autoFocus />
            {tried && missingSaga && <span className="mt-1 block text-danger">Name the saga, or pick one above.</span>}
          </label>
        )}

        {input.universe === 'mcu' && (
          <label className="block">
            <span className="font-bold">Phase</span>
            <select
              value={input.phase ?? ''}
              onChange={(e) => set({ phase: e.target.value ? Number(e.target.value) : null })}
              className={field}
            >
              <option value="">Not sure</option>
              {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                <option key={p} value={p}>
                  Phase {p}
                </option>
              ))}
            </select>
          </label>
        )}

        {isShow && (
          <fieldset>
            <legend className="font-bold">Seasons</legend>
            <ol className="mt-2 space-y-3">
              {seasons.map((s, i) => (
                <li key={i} className="rounded-xl border border-line p-3" aria-label={`Season ${i + 1}`}>
                  <p className="font-display text-lg font-semibold">Season {i + 1}</p>
                  <SeasonFields
                    value={s}
                    onChange={(v) => setSeasons(seasons.map((x, j) => (j === i ? v : x)))}
                    unknownHint={i === 0 ? 'Same as the show’s premiere date.' : 'Not aired yet. It will show as upcoming.'}
                  />
                </li>
              ))}
            </ol>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setSeasons([...seasons, { episodeCount: null, premiereDate: null }])}
                className="min-h-11 rounded-lg bg-raised px-3 font-bold hover:bg-line"
              >
                Add another season
              </button>
              {seasons.length > 1 && (
                <button type="button" onClick={() => setSeasons(seasons.slice(0, -1))} className="min-h-11 rounded-lg px-3 font-bold text-muted hover:text-fg">
                  Remove season {seasons.length}
                </button>
              )}
            </div>
          </fieldset>
        )}

        <label className="block">
          <span className="font-bold">Studio</span> <span className="text-muted">(optional)</span>
          <input value={input.studio} onChange={(e) => set({ studio: e.target.value })} placeholder="e.g. Marvel Studios" className={`${field} placeholder:text-muted`} />
        </label>
        <label className="block">
          <span className="font-bold">Note</span> <span className="text-muted">(optional)</span>
          <input value={input.note} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. Disney+ special" className={`${field} placeholder:text-muted`} />
        </label>
      </form>
    </Sheet>
  )
}

/** Episode count and premiere date for one season. Shared with "Add a season". */
export function SeasonFields({
  value,
  onChange,
  unknownHint = 'Not aired yet. It will show as upcoming.',
}: {
  value: SeasonInput
  onChange: (v: SeasonInput) => void
  unknownHint?: string
}) {
  return (
    <div className="mt-2 grid gap-3 sm:grid-cols-2">
      <label className="block text-sm">
        <span className="font-bold">Episodes</span> <span className="text-muted">(if known)</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={500}
          value={value.episodeCount ?? ''}
          onChange={(e) => onChange({ ...value, episodeCount: e.target.value ? Math.max(1, Math.round(Number(e.target.value))) : null })}
          className="mt-1.5 h-11 w-28 rounded-lg border border-line bg-bg px-3 text-base tabular-nums"
        />
      </label>
      <DateField label="Premiere" value={value.premiereDate} unknownHint={unknownHint} onChange={(d) => onChange({ ...value, premiereDate: d })} />
    </div>
  )
}

function Choice({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-1.5 font-bold">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex w-fit rounded-lg bg-bg p-0.5">
        {children}
      </div>
    </fieldset>
  )
}

function ChoiceButton({ on, disabled, onClick, children }: { on: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled && !on}
      onClick={onClick}
      className={`min-h-10 rounded-md px-3 ${on ? 'bg-raised font-bold text-fg' : 'text-muted hover:text-fg disabled:opacity-40'}`}
    >
      {children}
    </button>
  )
}
