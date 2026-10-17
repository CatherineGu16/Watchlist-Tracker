import { useState, type ReactNode } from 'react'
import type { ItemStatus } from '../lib/status.ts'
import { plural } from '../ui/format.ts'
import { NO_FILTERS, type FilterValues } from '../ui/listQuery.ts'
import { sagaColor } from '../ui/sagas.ts'
import { Sheet } from './Sheet.tsx'

const STATUSES: { id: ItemStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Any' },
  { id: 'unwatched', label: 'Not watched' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'watched', label: 'Watched' },
  { id: 'upcoming', label: 'Upcoming' },
]

const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.id, s.label])) as Record<ItemStatus | 'all', string>

interface Options {
  sagas: string[]
  phases: number[]
}

/** The saga, phase and status pickers. Shared by the phone drawer and the desktop sidebar. */
export function FilterFields({ value, onChange, sagas, phases }: Options & { value: FilterValues; onChange: (v: FilterValues) => void }) {
  return (
    <div className="space-y-5">
      <ChipGroup label="Saga">
        {sagas.map((s) => {
          const on = value.sagas.includes(s)
          return (
            <Chip key={s} on={on} onClick={() => onChange({ ...value, sagas: on ? value.sagas.filter((x) => x !== s) : [...value.sagas, s] })}>
              <span className="size-2 rounded-full" style={{ background: sagaColor(s) }} aria-hidden="true" />
              {s}
            </Chip>
          )
        })}
      </ChipGroup>
      {phases.length > 0 && (
        <ChipGroup label="Phase">
          <Chip on={value.phase === null} onClick={() => onChange({ ...value, phase: null })}>
            Any
          </Chip>
          {phases.map((p) => (
            <Chip key={p} on={value.phase === p} onClick={() => onChange({ ...value, phase: value.phase === p ? null : p })}>
              {p}
            </Chip>
          ))}
        </ChipGroup>
      )}
      <ChipGroup label="Status">
        {STATUSES.map((s) => (
          <Chip key={s.id} on={value.status === s.id} onClick={() => onChange({ ...value, status: s.id })}>
            {s.label}
          </Chip>
        ))}
      </ChipGroup>
    </div>
  )
}

/**
 * Phones and tablets: changes stay a draft until "Show N titles", which applies and closes.
 * Closing any other way discards them.
 */
export function FilterDrawer({
  open,
  onOpenChange,
  value,
  onApply,
  countFor,
  ...options
}: Options & {
  open: boolean
  onOpenChange: (o: boolean) => void
  value: FilterValues
  onApply: (v: FilterValues) => void
  countFor: (v: FilterValues) => number
}) {
  const [draft, setDraft] = useState(value)
  const [wasOpen, setWasOpen] = useState(open)
  // Each time the drawer opens, start from what's applied now.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setDraft(value)
  }
  const count = countFor(draft)

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Filters"
      footer={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDraft(NO_FILTERS)}
            disabled={isEmpty(draft)}
            className="min-h-11 rounded-lg px-4 font-bold text-muted hover:bg-raised hover:text-fg disabled:opacity-40"
          >
            Clear all
          </button>
          <button
            onClick={() => {
              onApply(draft)
              onOpenChange(false)
            }}
            className="ml-auto min-h-11 flex-1 rounded-lg bg-primary px-4 font-bold text-on-primary sm:flex-none"
          >
            {count === 0 ? 'No matches' : `Show ${plural(count, 'title')}`}
          </button>
        </div>
      }
    >
      <div className="mt-1">
        <FilterFields value={draft} onChange={setDraft} {...options} />
      </div>
    </Sheet>
  )
}

/** Desktop: always beside the list, and changes apply as you pick them. */
export function FilterSidebar({ value, onChange, ...options }: Options & { value: FilterValues; onChange: (v: FilterValues) => void }) {
  return (
    <aside aria-label="Filters" className="sticky top-0 hidden max-h-dvh self-start overflow-y-auto px-4 pt-6 pb-10 lg:block">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-semibold">Filters</h2>
        {!isEmpty(value) && (
          <button onClick={() => onChange(NO_FILTERS)} className="min-h-9 px-1 text-sm font-bold text-muted hover:text-fg">
            Clear all
          </button>
        )}
      </div>
      <FilterFields value={value} onChange={onChange} {...options} />
    </aside>
  )
}

/** What's applied, one removable chip each, so nothing filters the list out of sight. */
export function ActiveFilterChips({ value, onChange }: { value: FilterValues; onChange: (v: FilterValues) => void }) {
  if (isEmpty(value)) return null
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...value.sagas.map((s) => ({ key: `saga-${s}`, label: s, remove: () => onChange({ ...value, sagas: value.sagas.filter((x) => x !== s) }) })),
    ...(value.phase !== null ? [{ key: 'phase', label: `Phase ${value.phase}`, remove: () => onChange({ ...value, phase: null }) }] : []),
    ...(value.status !== 'all' ? [{ key: 'status', label: STATUS_LABEL[value.status], remove: () => onChange({ ...value, status: 'all' as const }) }] : []),
  ]
  return (
    <ul aria-label="Active filters" className="mt-2 flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <li key={c.key}>
          <button
            onClick={c.remove}
            aria-label={`Remove filter: ${c.label}`}
            className="inline-flex min-h-8 items-center gap-1 rounded-full bg-raised pr-2 pl-3 text-sm hover:bg-line"
          >
            {c.label}
            <svg viewBox="0 0 12 12" className="size-3 text-muted" aria-hidden="true">
              <path d="M3 3l6 6M9 3L3 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  )
}

const isEmpty = (v: FilterValues) => v.sagas.length === 0 && v.phase === null && v.status === 'all'

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm text-muted">{label}</legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${on ? 'border-fg bg-fg text-bg' : 'border-line text-fg hover:border-muted'}`}
    >
      {children}
    </button>
  )
}
