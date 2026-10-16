import type { TitleView } from '../lib/catalogView.ts'
import { comparePartialDates } from '../lib/partialDate.ts'
import { isReleased } from '../lib/status.ts'
import type { PartialDate, Universe } from '../lib/types.ts'

export interface NextRelease {
  view: TitleView
  date: PartialDate
  /** Set when the next release is a new season of a show. */
  seasonLabel: string | null
}

/** The soonest dated movie, special, or season still to come in a universe. */
export function nextRelease(views: TitleView[], universe: Universe, today: PartialDate): NextRelease | null {
  const upcoming: NextRelease[] = []
  for (const v of views) {
    if (v.title.universe !== universe) continue
    if (v.title.type === 'series') {
      const s = v.seasons.find((x) => x.premiereDate && !isReleased(x.premiereDate, today))
      if (s?.premiereDate) upcoming.push({ view: v, date: s.premiereDate, seasonLabel: s.number > 1 ? s.label : null })
    } else if (v.title.releaseDate && !isReleased(v.title.releaseDate, today)) {
      upcoming.push({ view: v, date: v.title.releaseDate, seasonLabel: null })
    }
  }
  return upcoming.sort((a, b) => comparePartialDates(a.date, b.date))[0] ?? null
}

/** Finished watches with an end date in the given year, across everything. */
export function watchesInYear(views: TitleView[], year: string): number {
  return views.reduce((n, v) => n + v.watches.filter((w) => w.endDate?.startsWith(year)).length, 0)
}
