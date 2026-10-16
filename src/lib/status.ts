import { comparePartialDates, isOnOrBefore } from './partialDate.ts'
import type { PartialDate, Season, Title, Watch } from './types.ts'

export type ItemStatus = 'watched' | 'in-progress' | 'unwatched' | 'upcoming'

/** Finished: has an end date, or has no dates at all ("watched, date unknown"). */
export function isFinished(w: Watch): boolean {
  return !w.deleted && (w.endDate !== null || w.startDate === null)
}

/** Open: started, not finished yet. */
export function isOpen(w: Watch): boolean {
  return !w.deleted && w.startDate !== null && w.endDate === null
}

export function isReleased(date: PartialDate | null, today: PartialDate): boolean {
  return date !== null && isOnOrBefore(date, today)
}

export function seasonStatus(season: Season, watches: Watch[], today: PartialDate): ItemStatus {
  const mine = watches.filter((w) => w.seasonId === season.id)
  if (mine.some(isFinished)) return 'watched'
  if (mine.some(isOpen)) return 'in-progress'
  return isReleased(season.premiereDate, today) ? 'unwatched' : 'upcoming'
}

export interface TitleSummary {
  status: ItemStatus
  /** Series only: released seasons finished / released seasons. */
  seasonsDone: number
  seasonsReleased: number
  /** Movies: finished watches. Series: complete runs (the fewest watches of any released season). */
  watchCount: number
  firstWatched: PartialDate | null
  lastWatched: PartialDate | null
}

export function summarizeTitle(
  title: Title,
  seasons: Season[],
  watches: Watch[],
  today: PartialDate,
): TitleSummary {
  const mine = watches.filter((w) => w.titleId === title.id && !w.deleted)
  const dates = mine
    .map((w) => w.endDate ?? w.startDate)
    .filter((d): d is PartialDate => d !== null)
    .sort(comparePartialDates)
  const firstWatched = dates[0] ?? null
  const lastWatched = dates.at(-1) ?? null

  if (title.type !== 'series') {
    const finished = mine.filter(isFinished).length
    const status: ItemStatus =
      finished > 0
        ? 'watched'
        : mine.some(isOpen)
          ? 'in-progress'
          : isReleased(title.releaseDate, today)
            ? 'unwatched'
            : 'upcoming'
    return { status, seasonsDone: 0, seasonsReleased: 0, watchCount: finished, firstWatched, lastWatched }
  }

  const mySeasons = seasons.filter((s) => s.titleId === title.id)
  const released = mySeasons.filter((s) => isReleased(s.premiereDate, today))
  const statuses = released.map((s) => seasonStatus(s, mine, today))
  const seasonsDone = statuses.filter((s) => s === 'watched').length
  const watchCount =
    released.length === 0
      ? 0
      : Math.min(...released.map((s) => mine.filter((w) => w.seasonId === s.id && isFinished(w)).length))

  let status: ItemStatus
  if (released.length === 0) status = 'upcoming'
  else if (seasonsDone === released.length) status = 'watched'
  else if (seasonsDone > 0 || statuses.includes('in-progress')) status = 'in-progress'
  else status = 'unwatched'

  return { status, seasonsDone, seasonsReleased: released.length, watchCount, firstWatched, lastWatched }
}
