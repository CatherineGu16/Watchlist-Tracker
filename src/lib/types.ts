/** "YYYY" | "YYYY-MM" | "YYYY-MM-DD" — dates can be as precise as you remember them. */
export type PartialDate = string

export type TitleType = 'movie' | 'series' | 'special'
export type Universe = 'mcu' | 'other'

/**
 * Who made it, which decides whether it counts as MCU. Each group can be moved between the MCU and
 * Other Marvel tabs in Settings; titles you add yourself have none and stay where you put them.
 */
export type Collection = 'marvel-studios' | 'netflix' | 'marvel-tv' | 'fox-xmen' | 'sony-spider-man' | 'classic'

export interface Title {
  id: string
  title: string
  type: TitleType
  releaseDate: PartialDate | null
  universe: Universe
  collection?: Collection
  saga: string
  phase: number | null
  /** In-universe (story) order. MCU only. */
  chronoIndex: number | null
  studio: string
  tmdbId: number | null
  posterPath: string | null
  note?: string
  /** Set on titles you added yourself (stored in your private data, not the catalog). */
  custom?: boolean
  /** Your own titles and seasons sync like watches: newest edit wins, deletes are tombstones. */
  updatedAt?: string
  deleted?: boolean
}

export interface Season {
  id: string
  titleId: string
  number: number
  label: string
  episodeCount: number | null
  premiereDate: PartialDate | null
  phase: number | null
  note?: string
  custom?: boolean
  updatedAt?: string
  deleted?: boolean
}

/** Public, shipped with the app. Facts about titles, nothing about the viewer. */
export interface Catalog {
  schemaVersion: 1
  generatedAt: string
  titles: Title[]
  seasons: Season[]
}

/**
 * One viewing. Movies set start = end. A season watch is open (in progress) while
 * endDate is null. Both dates null means "watched, date unknown".
 */
export interface Watch {
  id: string
  titleId: string
  seasonId: string | null
  startDate: PartialDate | null
  endDate: PartialDate | null
  approximate: boolean
  /** Only tracked while a season watch is in progress. */
  episodesWatched: number | null
  note: string
  createdAt: string
  updatedAt: string
  /** Tombstone so deletes survive sync merges. */
  deleted?: boolean
}

/** Private, lives in the watchlist-data repo. */
export interface PrivateData {
  schemaVersion: 1
  updatedAt: string
  watches: Watch[]
  customTitles: Title[]
  customSeasons: Season[]
  titleOverrides: Record<string, Partial<Omit<Title, 'id'>>>
  /** Groups you moved between the MCU and Other Marvel tabs (Settings). Synced; newest choice wins. */
  groupPlacement?: { values: Partial<Record<Collection, Universe>>; updatedAt: string }
}
