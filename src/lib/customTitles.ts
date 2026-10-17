import type { PartialDate, PrivateData, Season, Title, TitleType, Universe } from './types.ts'
import type { EditContext } from './watchActions.ts'

/** What the Add / Edit title form collects. */
export interface TitleInput {
  title: string
  type: TitleType
  releaseDate: PartialDate | null
  universe: Universe
  saga: string
  phase: number | null
  studio: string
  note: string
}

export interface SeasonInput {
  episodeCount: number | null
  premiereDate: PartialDate | null
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** "custom-" keeps your ids from ever colliding with catalog ids; the random tail lets two devices add the same name. */
export function newCustomTitleId(title: string, newId: () => string): string {
  return `custom-${slugify(title) || 'title'}-${newId().replace(/-/g, '').slice(0, 8)}`
}

const liveSeasons = (data: PrivateData, titleId: string, catalogSeasons: Season[]) =>
  [...catalogSeasons.filter((s) => s.titleId === titleId), ...data.customSeasons.filter((s) => s.titleId === titleId && !s.deleted)]

function makeSeason(titleId: string, number: number, s: SeasonInput, ctx: EditContext, phase: number | null): Season {
  return {
    id: `${titleId}-s${number}-${ctx.newId().replace(/-/g, '').slice(0, 6)}`,
    titleId,
    number,
    label: `Season ${number}`,
    episodeCount: s.episodeCount,
    premiereDate: s.premiereDate,
    phase,
    custom: true,
    updatedAt: ctx.now,
  }
}

export function addCustomTitle(data: PrivateData, ctx: EditContext, id: string, input: TitleInput, seasons: SeasonInput[] = []): PrivateData {
  if (!input.title.trim()) throw new Error('A title needs a name.')
  const title: Title = {
    id,
    ...input,
    title: input.title.trim(),
    phase: input.universe === 'mcu' ? input.phase : null,
    chronoIndex: null,
    tmdbId: null,
    posterPath: null,
    custom: true,
    updatedAt: ctx.now,
  }
  // Season 1 with no date of its own premiered with the show.
  const dated = seasons.map((s, i) => (i === 0 && s.premiereDate === null ? { ...s, premiereDate: title.releaseDate } : s))
  const newSeasons = input.type === 'series' ? dated.map((s, i) => makeSeason(id, i + 1, s, ctx, title.phase)) : []
  return {
    ...data,
    updatedAt: ctx.now,
    customTitles: [...data.customTitles, title],
    customSeasons: [...data.customSeasons, ...newSeasons],
  }
}

export function updateCustomTitle(data: PrivateData, ctx: EditContext, id: string, input: TitleInput): PrivateData {
  if (!input.title.trim()) throw new Error('A title needs a name.')
  if (!data.customTitles.some((t) => t.id === id && !t.deleted)) throw new Error('Only titles you added can be edited.')
  return {
    ...data,
    updatedAt: ctx.now,
    customTitles: data.customTitles.map((t) =>
      t.id === id ? { ...t, ...input, title: input.title.trim(), phase: input.universe === 'mcu' ? input.phase : null, updatedAt: ctx.now } : t,
    ),
  }
}

/** Removes the title, its seasons, and its watches on every device (tombstones, so sync carries the delete). */
export function deleteCustomTitle(data: PrivateData, ctx: EditContext, id: string): PrivateData {
  const stamp = <T extends { updatedAt?: string; deleted?: boolean }>(x: T): T => ({ ...x, deleted: true, updatedAt: ctx.now })
  return {
    ...data,
    updatedAt: ctx.now,
    customTitles: data.customTitles.map((t) => (t.id === id ? stamp(t) : t)),
    customSeasons: data.customSeasons.map((s) => (s.titleId === id && !s.deleted ? stamp(s) : s)),
    watches: data.watches.map((w) => (w.titleId === id && !w.deleted ? stamp(w) : w)),
  }
}

/** Adds the next season to any show, including catalog shows (e.g. a newly announced season). */
export function addSeason(data: PrivateData, ctx: EditContext, title: Title, catalogSeasons: Season[], input: SeasonInput): PrivateData {
  if (title.type !== 'series') throw new Error('Only shows have seasons.')
  const next = Math.max(0, ...liveSeasons(data, title.id, catalogSeasons).map((s) => s.number)) + 1
  return {
    ...data,
    updatedAt: ctx.now,
    customSeasons: [...data.customSeasons, makeSeason(title.id, next, input, ctx, title.phase)],
  }
}

export function updateCustomSeason(data: PrivateData, ctx: EditContext, seasonId: string, input: SeasonInput): PrivateData {
  if (!data.customSeasons.some((s) => s.id === seasonId && !s.deleted)) throw new Error('Only seasons you added can be edited.')
  return {
    ...data,
    updatedAt: ctx.now,
    customSeasons: data.customSeasons.map((s) => (s.id === seasonId ? { ...s, ...input, updatedAt: ctx.now } : s)),
  }
}

/** Removes a season you added, and its watches. */
export function deleteCustomSeason(data: PrivateData, ctx: EditContext, seasonId: string): PrivateData {
  return {
    ...data,
    updatedAt: ctx.now,
    customSeasons: data.customSeasons.map((s) => (s.id === seasonId ? { ...s, deleted: true, updatedAt: ctx.now } : s)),
    watches: data.watches.map((w) => (w.seasonId === seasonId && !w.deleted ? { ...w, deleted: true, updatedAt: ctx.now } : w)),
  }
}
