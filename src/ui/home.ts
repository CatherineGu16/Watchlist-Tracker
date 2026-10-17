import type { TitleView } from '../lib/catalogView.ts'
import { comparePartialDates } from '../lib/partialDate.ts'
import { isOpen } from '../lib/status.ts'
import type { Season, Watch } from '../lib/types.ts'

export interface HomeItem {
  view: TitleView
  season: Season | null
  watch: Watch
}

const seasonOf = (v: TitleView, w: Watch) => (w.seasonId ? (v.seasons.find((s) => s.id === w.seasonId) ?? null) : null)

/** Everything started and not finished, most recently touched first. */
export function continueWatching(views: TitleView[]): HomeItem[] {
  return views
    .flatMap((view) => view.watches.filter(isOpen).map((watch) => ({ view, season: seasonOf(view, watch), watch })))
    .sort((a, b) => b.watch.updatedAt.localeCompare(a.watch.updatedAt))
}

/**
 * The latest finished watches with a date, newest first, one entry per movie or season.
 * Watches with no date never show here: there's no "when" to sort them by.
 */
export function recentlyWatched(views: TitleView[], limit = 8): HomeItem[] {
  const items = views
    .flatMap((view) => view.watches.filter((w) => w.endDate !== null).map((watch) => ({ view, season: seasonOf(view, watch), watch })))
    .sort((a, b) => comparePartialDates(b.watch.endDate!, a.watch.endDate!) || b.watch.updatedAt.localeCompare(a.watch.updatedAt))
  const seen = new Set<string>()
  return items
    .filter((i) => {
      const key = `${i.view.title.id}/${i.season?.id ?? ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, limit)
}
