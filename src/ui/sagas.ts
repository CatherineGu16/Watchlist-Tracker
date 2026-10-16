/** Each saga's spine color, defined as CSS variables in index.css so both themes can tune them. */
const SAGA_VARS: Record<string, string> = {
  'Infinity Saga': 'var(--saga-infinity)',
  'Multiverse Saga': 'var(--saga-multiverse)',
  'X-Men': 'var(--saga-xmen)',
  'Spider-Man': 'var(--saga-spider)',
  'Classic Marvel': 'var(--saga-classic)',
}

export function sagaColor(saga: string): string {
  return SAGA_VARS[saga] ?? 'var(--saga-other)'
}

/** Display order for saga groups and filter chips. */
export const SAGA_ORDER = ['Infinity Saga', 'Multiverse Saga', 'X-Men', 'Spider-Man', 'Classic Marvel']

export function sagaRank(saga: string): number {
  const i = SAGA_ORDER.indexOf(saga)
  return i === -1 ? SAGA_ORDER.length : i
}
