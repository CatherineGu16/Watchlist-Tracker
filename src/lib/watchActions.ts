import type { PartialDate, PrivateData, Watch } from './types.ts'

/** Pure edits to PrivateData. Every changed record gets a fresh updatedAt so sync merges pick it. */

export interface EditContext {
  now: string
  newId: () => string
}

export function emptyData(now: string): PrivateData {
  return { schemaVersion: 1, updatedAt: now, watches: [], customTitles: [], customSeasons: [], titleOverrides: {} }
}

export interface NewWatch {
  titleId: string
  seasonId?: string | null
  startDate: PartialDate | null
  endDate: PartialDate | null
  approximate?: boolean
  episodesWatched?: number | null
  note?: string
}

export function logWatch(data: PrivateData, ctx: EditContext, w: NewWatch): PrivateData {
  const watch: Watch = {
    id: ctx.newId(),
    titleId: w.titleId,
    seasonId: w.seasonId ?? null,
    startDate: w.startDate,
    endDate: w.endDate,
    approximate: w.approximate ?? false,
    episodesWatched: w.episodesWatched ?? null,
    note: w.note ?? '',
    createdAt: ctx.now,
    updatedAt: ctx.now,
  }
  return { ...data, updatedAt: ctx.now, watches: [...data.watches, watch] }
}

export type WatchPatch = Partial<Pick<Watch, 'startDate' | 'endDate' | 'approximate' | 'episodesWatched' | 'note'>>

export function updateWatch(data: PrivateData, ctx: EditContext, id: string, patch: WatchPatch): PrivateData {
  if (!data.watches.some((w) => w.id === id && !w.deleted)) throw new Error(`No watch ${id}`)
  return {
    ...data,
    updatedAt: ctx.now,
    watches: data.watches.map((w) => (w.id === id ? { ...w, ...patch, updatedAt: ctx.now } : w)),
  }
}

/** Soft delete: the tombstone tells other devices the watch is gone. */
export function deleteWatch(data: PrivateData, ctx: EditContext, id: string): PrivateData {
  return {
    ...data,
    updatedAt: ctx.now,
    watches: data.watches.map((w) => (w.id === id ? { ...w, deleted: true, updatedAt: ctx.now } : w)),
  }
}

/** Movie, special, or a whole season watched in one go: starts and ends today. */
export function checkOff(data: PrivateData, ctx: EditContext, titleId: string, today: PartialDate, seasonId: string | null = null) {
  return logWatch(data, ctx, { titleId, seasonId, startDate: today, endDate: today })
}

export function startSeason(data: PrivateData, ctx: EditContext, titleId: string, seasonId: string, today: PartialDate) {
  return logWatch(data, ctx, { titleId, seasonId, startDate: today, endDate: null, episodesWatched: 0 })
}

/** Finished watches are assumed complete, so the episode counter is cleared. */
export function finishWatch(data: PrivateData, ctx: EditContext, id: string, today: PartialDate) {
  return updateWatch(data, ctx, id, { endDate: today, episodesWatched: null })
}

export function setEpisodes(data: PrivateData, ctx: EditContext, id: string, episodes: number, episodeCount: number | null) {
  const max = episodeCount ?? Number.POSITIVE_INFINITY
  return updateWatch(data, ctx, id, { episodesWatched: Math.max(0, Math.min(episodes, max)) })
}

/**
 * Restores an earlier snapshot as new edits, so undo also wins over the change on other devices:
 * records that differ get the snapshot's version with a fresh updatedAt; records added since are deleted.
 */
export function revertTo(current: PrivateData, snapshot: PrivateData, ctx: EditContext): PrivateData {
  const before = new Map(snapshot.watches.map((w) => [w.id, w]))
  const watches = current.watches.map((w) => {
    const old = before.get(w.id)
    if (!old) return w.deleted ? w : { ...w, deleted: true, updatedAt: ctx.now }
    return JSON.stringify(old) === JSON.stringify(w) ? w : { ...old, updatedAt: ctx.now }
  })
  return { ...snapshot, updatedAt: ctx.now, watches }
}
