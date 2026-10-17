import { summarizeTitle, type TitleSummary } from './status.ts'
import type { Catalog, PartialDate, PrivateData, Season, Title, Watch } from './types.ts'

export interface TitleView {
  title: Title
  seasons: Season[]
  watches: Watch[]
  summary: TitleSummary
}

/** Public catalog + your custom titles and overrides + your watches → what the screen shows. */
export function buildTitleViews(catalog: Catalog, data: PrivateData, today: PartialDate): TitleView[] {
  const placement = data.groupPlacement?.values ?? {}
  const titles = [...catalog.titles, ...data.customTitles.filter((t) => !t.deleted)].map((t) => {
    const moved = t.collection && placement[t.collection] ? { ...t, universe: placement[t.collection]! } : t
    return data.titleOverrides[t.id] ? { ...moved, ...data.titleOverrides[t.id], id: t.id } : moved
  })
  const seasons = [...catalog.seasons, ...data.customSeasons.filter((s) => !s.deleted)]
  const seasonsBy = groupBy(seasons, (s) => s.titleId)
  const watchesBy = groupBy(
    data.watches.filter((w) => !w.deleted),
    (w) => w.titleId,
  )

  return titles.map((title) => {
    const mySeasons = (seasonsBy.get(title.id) ?? []).sort((a, b) => a.number - b.number)
    const myWatches = watchesBy.get(title.id) ?? []
    return { title, seasons: mySeasons, watches: myWatches, summary: summarizeTitle(title, mySeasons, myWatches, today) }
  })
}

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of xs) {
    const k = key(x)
    const list = m.get(k)
    if (list) list.push(x)
    else m.set(k, [x])
  }
  return m
}
