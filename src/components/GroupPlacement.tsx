import type { Collection, Universe } from '../lib/types.ts'
import { useStore } from '../store/StoreContext.tsx'
import { catalog, useWatchlistState } from '../store/useWatchlist.ts'
import type { useActions } from '../ui/useActions.ts'

type Actions = ReturnType<typeof useActions>

/** The groups you can move. Marvel Studios' own titles are always MCU. */
const GROUPS: { id: Collection; label: string; why: string }[] = [
  {
    id: 'netflix',
    label: 'Netflix shows',
    why: 'Daredevil, Jessica Jones, Luke Cage, Iron Fist, The Defenders, The Punisher. Disney+ lists them in its official MCU timeline.',
  },
  {
    id: 'fox-xmen',
    label: 'Fox X-Men',
    why: 'The X-Men films (including Deadpool 1 and 2), Legion and The Gifted. The original cast returns in Avengers: Doomsday as multiverse characters.',
  },
  {
    id: 'sony-spider-man',
    label: 'Sony Spider-Man',
    why: 'The Tobey Maguire and Andrew Garfield films, Venom and the Spider-Verse. Their Spider-Men crossed into the MCU in No Way Home.',
  },
  {
    id: 'marvel-tv',
    label: 'Marvel Television',
    why: 'Agents of S.H.I.E.L.D., Agent Carter, Inhumans, Runaways, Cloak & Dagger, Helstrom. Not on Disney+’s MCU timeline.',
  },
  {
    id: 'classic',
    label: 'Other Marvel films and shows',
    why: 'Blade, the Fox Fantastic Four, Ghost Rider, the Punisher films, X-Men ’97 and more.',
  },
]

/** Where each group goes when you haven't chosen: what the catalog says. */
const DEFAULT_PLACEMENT = Object.fromEntries(
  GROUPS.map((g) => [g.id, catalog.titles.find((t) => t.collection === g.id)?.universe ?? 'other']),
) as Record<Collection, Universe>

export function GroupPlacement({ actions }: { actions: Actions }) {
  const { data } = useWatchlistState(useStore())
  const chosen = data.groupPlacement?.values ?? {}
  const anyChanged = GROUPS.some((g) => chosen[g.id] && chosen[g.id] !== DEFAULT_PLACEMENT[g.id])

  return (
    <section className="rounded-xl border border-line p-4" aria-labelledby="placement-heading">
      <h2 id="placement-heading" className="font-display text-xl font-semibold">
        What counts as MCU
      </h2>
      <p className="mt-1 text-sm text-muted">Choose which tab each group lives in. Your choice syncs to your other devices.</p>
      <ul className="mt-3 divide-y divide-line">
        {GROUPS.map((g) => {
          const where = chosen[g.id] ?? DEFAULT_PLACEMENT[g.id]
          return (
            <li key={g.id} className="py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="mr-auto font-bold">{g.label}</span>
                <div role="radiogroup" aria-label={g.label} className="flex rounded-lg bg-bg p-0.5">
                  {(['mcu', 'other'] as Universe[]).map((u) => (
                    <button
                      key={u}
                      role="radio"
                      aria-checked={where === u}
                      onClick={() => where !== u && actions.setGroupPlacement(g.id, g.label, u === DEFAULT_PLACEMENT[g.id] ? null : u, DEFAULT_PLACEMENT[g.id])}
                      className={`min-h-10 rounded-md px-3 text-sm ${where === u ? 'bg-raised font-bold text-fg' : 'text-muted hover:text-fg'}`}
                    >
                      {u === 'mcu' ? 'MCU' : 'Other Marvel'}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-1 text-sm text-muted">
                {g.why} <span className="text-fg">Recommended: {DEFAULT_PLACEMENT[g.id] === 'mcu' ? 'MCU' : 'Other Marvel'}.</span>
              </p>
            </li>
          )
        })}
      </ul>
      {anyChanged && (
        <button
          onClick={() => actions.resetGroupPlacement()}
          className="mt-2 min-h-10 rounded-lg px-2 text-sm font-bold text-muted hover:text-fg"
        >
          Use the recommended placement
        </button>
      )}
    </section>
  )
}
