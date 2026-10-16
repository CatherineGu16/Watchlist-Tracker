import type { TitleView } from '../lib/catalogView.ts'
import { isReleased, isOpen, seasonStatus } from '../lib/status.ts'
import type { PartialDate, Season } from '../lib/types.ts'

export type SeriesNote =
  | { kind: 'watching'; season: Season; episodes: number | null }
  | { kind: 'new-season'; season: Season }
  | { kind: 'next-season'; season: Season }
  | null

/**
 * The one thing worth saying about a show in the list, in priority order: the season you're in
 * the middle of, a season that came out after you caught up, or the next announced season.
 */
export function seriesNote(view: TitleView, today: PartialDate): SeriesNote {
  if (view.title.type !== 'series') return null
  const open = view.watches.find(isOpen)
  if (open) {
    const season = view.seasons.find((s) => s.id === open.seasonId)
    if (season) return { kind: 'watching', season, episodes: open.episodesWatched }
  }
  const released = view.seasons.filter((s) => isReleased(s.premiereDate, today))
  const watchedAny = released.some((s) => seasonStatus(s, view.watches, today) === 'watched')
  if (watchedAny) {
    // Behind on a season released after ones you've seen.
    const lastWatched = Math.max(...released.filter((s) => seasonStatus(s, view.watches, today) === 'watched').map((s) => s.number))
    const newer = released.find((s) => s.number > lastWatched && seasonStatus(s, view.watches, today) === 'unwatched')
    if (newer) return { kind: 'new-season', season: newer }
  }
  if (view.summary.status === 'watched' || released.length === 0) {
    const next = view.seasons.find((s) => !isReleased(s.premiereDate, today))
    if (next) return { kind: 'next-season', season: next }
  }
  return null
}

export const shortSeason = (s: Season) => `S${s.number}`
