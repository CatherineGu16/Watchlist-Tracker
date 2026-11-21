/**
 * The groups each tab is split into. MCU titles go by Marvel's sagas, with the Netflix shows as the
 * Defenders Saga as Disney+ lists them; everything else goes by who made it.
 * Each group's spine color is a CSS variable in index.css so both themes can tune it.
 */
const SAGA_VARS: Record<string, string> = {
  'Infinity Saga': 'var(--saga-infinity)',
  'Multiverse Saga': 'var(--saga-multiverse)',
  'Defenders Saga': 'var(--saga-defenders)',
  'Marvel Television': 'var(--saga-tv)',
  'Marvel Animation': 'var(--saga-animation)',
  'Fox X-Men': 'var(--saga-xmen)',
  'Sony Spider-Man': 'var(--saga-spider)',
  'Classic films': 'var(--saga-classic)',
}

export function sagaColor(saga: string): string {
  return SAGA_VARS[saga] ?? 'var(--saga-other)'
}

/** Display order for saga groups and filter chips. */
export const SAGA_ORDER = Object.keys(SAGA_VARS)

export function sagaRank(saga: string): number {
  const i = SAGA_ORDER.indexOf(saga)
  return i === -1 ? SAGA_ORDER.length : i
}
