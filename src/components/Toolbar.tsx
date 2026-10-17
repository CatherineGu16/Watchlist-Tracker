import type { ReactNode } from 'react'
import { activeFilterCount, type ListQuery, type SortKey, type TypeFilter } from '../ui/listQuery.ts'

const TYPES: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'movie', label: 'Movies' },
  { id: 'series', label: 'TV' },
  { id: 'special', label: 'Specials' },
]

const SORTS: { id: SortKey; label: string; mcuOnly?: boolean }[] = [
  { id: 'release', label: 'Release order' },
  { id: 'release-seasons', label: 'Release by season' },
  { id: 'story', label: 'Story order', mcuOnly: true },
  { id: 'saga', label: 'Saga' },
  { id: 'title', label: 'Title' },
  { id: 'last-watched', label: 'Last watched' },
]

/** Search, sort and type stay one tap away; the rest of the filters open in a drawer (or sit in the desktop sidebar). */
export function Toolbar({
  query,
  onChange,
  onOpenFilters,
  children,
}: {
  query: ListQuery
  onChange: (q: Partial<ListQuery>) => void
  onOpenFilters: () => void
  /** Active filter chips, shown under the controls. */
  children?: ReactNode
}) {
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
            className="h-11 max-w-[48vw] appearance-none rounded-lg border border-line bg-surface pr-7 pl-3 text-base"
          >
            {sorts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <svg viewBox="0 0 12 12" className="pointer-events-none absolute top-1/2 right-2.5 size-3 -translate-y-1/2 text-muted" aria-hidden="true">
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
          onClick={onOpenFilters}
          aria-haspopup="dialog"
          className={`ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-bold lg:hidden ${filters ? 'bg-raised text-fg' : 'text-muted hover:text-fg'}`}
        >
          <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
            <path d="M3 5h14M6 10h8M8.5 15h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Filters
          {filters > 0 && <span className="rounded-full bg-primary px-1.5 text-on-primary tabular-nums">{filters}</span>}
        </button>
      </div>
      {children}
    </div>
  )
}
