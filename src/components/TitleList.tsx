import type { ListEntry, ListGroup } from '../ui/listQuery.ts'
import { sagaColor } from '../ui/sagas.ts'
import { TitleRow } from './TitleRow.tsx'

export function TitleList({
  groups,
  onToggle,
  onOpen,
  onClearFilters,
  filtered,
  showYear,
}: {
  showYear: boolean
  groups: ListGroup[]
  onToggle: (e: ListEntry) => void
  onOpen: (id: string) => void
  onClearFilters: () => void
  filtered: boolean
}) {
  if (groups.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="font-display text-2xl font-semibold">Nothing matches</p>
        <p className="mt-1 text-muted">{filtered ? 'Try fewer filters or a different search.' : 'No titles here yet.'}</p>
        {filtered && (
          <button onClick={onClearFilters} className="mt-4 min-h-11 rounded-lg bg-raised px-4 font-bold hover:bg-line">
            Clear filters
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`group-${g.key}`}>
          <header className="flex items-end gap-3 px-3 pt-6 pb-2 sm:px-4">
            <h2 id={`group-${g.key}`} className="font-display text-[1.75rem] leading-none font-semibold tracking-tight">
              {g.label}
            </h2>
            <span className="pb-0.5 text-sm text-muted tabular-nums">
              {g.watched}/{g.items.length}
            </span>
            {g.saga && (
              <span className="mb-1.5 h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
                <span className="block h-full rounded-full" style={{ width: `${(g.watched / g.items.length) * 100}%`, background: sagaColor(g.saga) }} />
              </span>
            )}
          </header>
          <ul className="border-t border-line">
            {g.items.map((e) => (
              <TitleRow key={e.key} entry={e} onToggle={onToggle} onOpen={onOpen} showYear={showYear} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
