import { useId, useState, type ReactNode } from 'react'
import type { ItemStatus } from '../lib/status.ts'
import { activeFilterCount, type ListQuery, type SortKey, type TypeFilter } from '../ui/listQuery.ts'
import { sagaColor } from '../ui/sagas.ts'

const TYPES: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'movie', label: 'Movies' },
  { id: 'series', label: 'TV' },
  { id: 'special', label: 'Specials' },
]

const SORTS: { id: SortKey; label: string; mcuOnly?: boolean }[] = [
  { id: 'release', label: 'Release order' },
  { id: 'story', label: 'Story order', mcuOnly: true },
  { id: 'saga', label: 'Saga' },
  { id: 'title', label: 'Title' },
  { id: 'last-watched', label: 'Last watched' },
]

const STATUSES: { id: ItemStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Any' },
  { id: 'unwatched', label: 'Not watched' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'watched', label: 'Watched' },
  { id: 'upcoming', label: 'Upcoming' },
]

export function Toolbar({
  query,
  onChange,
  sagas,
  phases,
  resultCount,
}: {
  query: ListQuery
  onChange: (q: Partial<ListQuery>) => void
  sagas: string[]
  phases: number[]
  resultCount: number
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const filters = activeFilterCount({ ...query, type: 'all' })
  const sorts = SORTS.filter((s) => !s.mcuOnly || query.universe === 'mcu')

  return (
    <div className="sticky top-0 z-20 border-b border-line bg-bg/95 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 backdrop-blur sm:px-4">
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search titles</span>
          <svg viewBox="0 0 20 20" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true">
            <path d="M8.5 3a5.5 5.5 0 1 0 3.4 9.8l3.6 3.7 1.1-1.1-3.7-3.6A5.5 5.5 0 0 0 8.5 3Zm0 1.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" fill="currentColor" />
          </svg>
          <input
            type="search"
            value={query.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Search"
            className="h-11 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-base placeholder:text-muted"
          />
        </label>
        <label className="relative">
          <span className="sr-only">Sort by</span>
          <select
            value={query.sort}
            onChange={(e) => onChange({ sort: e.target.value as SortKey })}
            className="h-11 max-w-[44vw] appearance-none rounded-lg border border-line bg-surface pr-8 pl-3 text-base"
          >
            {sorts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <svg viewBox="0 0 12 12" className="pointer-events-none absolute top-1/2 right-3 size-3 -translate-y-1/2 text-muted" aria-hidden="true">
            <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </label>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div role="radiogroup" aria-label="Type" className="flex rounded-lg bg-surface p-0.5">
          {TYPES.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={query.type === t.id}
              onClick={() => onChange({ type: t.id })}
              className={`min-h-10 rounded-md px-3 text-sm font-bold transition-colors ${query.type === t.id ? 'bg-raised text-fg' : 'text-muted hover:text-fg'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className={`ml-auto min-h-10 rounded-lg px-3 text-sm font-bold ${open || filters ? 'bg-raised text-fg' : 'text-muted hover:text-fg'}`}
        >
          Filters{filters > 0 && <span className="ml-1.5 rounded-full bg-primary px-1.5 text-on-primary tabular-nums">{filters}</span>}
        </button>
      </div>

      {open && (
        <div id={panelId} className="mt-3 space-y-3 pb-1">
          <ChipGroup label="Saga">
            {sagas.map((s) => {
              const on = query.sagas.includes(s)
              return (
                <Chip key={s} on={on} onClick={() => onChange({ sagas: on ? query.sagas.filter((x) => x !== s) : [...query.sagas, s] })}>
                  <span className="size-2 rounded-full" style={{ background: sagaColor(s) }} aria-hidden="true" />
                  {s}
                </Chip>
              )
            })}
          </ChipGroup>
          {phases.length > 0 && (
            <ChipGroup label="Phase">
              <Chip on={query.phase === null} onClick={() => onChange({ phase: null })}>
                Any
              </Chip>
              {phases.map((p) => (
                <Chip key={p} on={query.phase === p} onClick={() => onChange({ phase: query.phase === p ? null : p })}>
                  {p}
                </Chip>
              ))}
            </ChipGroup>
          )}
          <ChipGroup label="Status">
            {STATUSES.map((s) => (
              <Chip key={s.id} on={query.status === s.id} onClick={() => onChange({ status: s.id })}>
                {s.label}
              </Chip>
            ))}
          </ChipGroup>
          <div className="flex items-center justify-between text-sm text-muted">
            <span aria-live="polite">{resultCount} titles</span>
            {filters > 0 && (
              <button className="min-h-10 px-2 font-bold text-fg underline-offset-4 hover:underline" onClick={() => onChange({ sagas: [], phase: null, status: 'all' })}>
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm text-muted">{label}</legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${on ? 'border-fg bg-fg text-bg' : 'border-line text-fg hover:border-muted'}`}
    >
      {children}
    </button>
  )
}
