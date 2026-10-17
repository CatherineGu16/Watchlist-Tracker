import { useMemo } from 'react'
import type { TitleView } from '../lib/catalogView.ts'
import { todayIso } from '../lib/partialDate.ts'
import { isFinished } from '../lib/status.ts'
import type { Collection, Season, Universe } from '../lib/types.ts'
import {
  checkOff,
  deleteWatch,
  finishWatch,
  logWatch,
  resetGroupPlacement,
  setEpisodes,
  setGroupPlacement,
  startSeason,
  updateWatch,
  type NewWatch,
  type WatchPatch,
} from '../lib/watchActions.ts'
import { useToast } from '../components/toastContext.ts'
import {
  addCustomTitle,
  addSeason,
  deleteCustomSeason,
  deleteCustomTitle,
  newCustomTitleId,
  updateCustomSeason,
  updateCustomTitle,
  type SeasonInput,
  type TitleInput,
} from '../lib/customTitles.ts'
import { useStore } from '../store/StoreContext.tsx'
import { catalog } from '../store/useWatchlist.ts'
import type { Edit } from '../store/watchlistStore.ts'

/** Every change goes through here: apply, save, and confirm with an Undo. */
export interface OpenDetailOptions {
  /** Jump straight to editing the latest watch's date. */
  editLatest?: boolean
}

export function useActions(openDetail?: (titleId: string, opts?: OpenDetailOptions) => void) {
  const store = useStore()
  const toast = useToast()

  return useMemo(() => {
    const undo = { label: 'Undo', onClick: () => store.undo() }
    const run = (label: string, edit: Edit) => {
      if (store.apply(edit, label)) toast(label, [undo])
    }

    return {
      /** Checkbox on a movie/special row. */
      toggleMovie(v: TitleView) {
        const finished = v.watches.filter(isFinished)
        if (finished.length === 0) {
          const today = todayIso()
          const label = `Checked off ${v.title.title}`
          if (!store.apply((d, c) => checkOff(d, c, v.title.id, today), label)) return
          toast(label, [...(openDetail ? [{ label: 'Change date', onClick: () => openDetail(v.title.id, { editLatest: true }) }] : []), undo])
        } else if (finished.length === 1 && v.watches.length === 1) {
          run(`Unchecked ${v.title.title}`, (d, c) => deleteWatch(d, c, finished[0].id))
        } else {
          // Several watches: pick which one to remove in the detail panel.
          openDetail?.(v.title.id)
        }
      },
      /** Checkbox on a season row: same rules as a movie, scoped to that season. */
      toggleSeason(v: TitleView, s: Season) {
        const mine = v.watches.filter((w) => w.seasonId === s.id)
        const finished = mine.filter(isFinished)
        const name = `${v.title.title} ${s.label}`
        if (mine.length === 0) {
          const today = todayIso()
          const label = `Checked off ${name}`
          if (!store.apply((d, c) => checkOff(d, c, v.title.id, today, s.id), label)) return
          toast(label, [...(openDetail ? [{ label: 'Open', onClick: () => openDetail(v.title.id) }] : []), undo])
        } else if (finished.length === 1 && mine.length === 1) {
          run(`Unchecked ${name}`, (d, c) => deleteWatch(d, c, finished[0].id))
        } else {
          // Rewatches or a season in progress: handle it in the show's panel.
          openDetail?.(v.title.id)
        }
      },
      logWatch(v: TitleView, w: Omit<NewWatch, 'titleId'>, label = `Logged a watch of ${v.title.title}`) {
        run(label, (d, c) => logWatch(d, c, { ...w, titleId: v.title.id }))
      },
      updateWatch(id: string, patch: WatchPatch, label = 'Updated watch') {
        run(label, (d, c) => updateWatch(d, c, id, patch))
      },
      deleteWatch(id: string, label = 'Removed watch') {
        run(label, (d, c) => deleteWatch(d, c, id))
      },
      startSeason(v: TitleView, s: Season) {
        const today = todayIso()
        run(`Started ${v.title.title} ${s.label}`, (d, c) => startSeason(d, c, v.title.id, s.id, today))
      },
      finishSeason(v: TitleView, s: Season, watchId: string) {
        const today = todayIso()
        run(`Finished ${v.title.title} ${s.label}`, (d, c) => finishWatch(d, c, watchId, today))
      },
      markSeasonWatched(v: TitleView, s: Season) {
        const today = todayIso()
        run(`Checked off ${v.title.title} ${s.label}`, (d, c) => checkOff(d, c, v.title.id, today, s.id))
      },
      /** For seasons watched long ago: counts toward the show without inventing a date. */
      markSeasonsWatchedUndated(v: TitleView, seasons: Season[]) {
        run(`Marked ${seasons.length === 1 ? seasons[0].label : `${seasons.length} seasons`} watched`, (d, c) =>
          seasons.reduce((acc, s) => logWatch(acc, c, { titleId: v.title.id, seasonId: s.id, startDate: null, endDate: null }), d),
        )
      },
      /** Returns the new title's id so the caller can open it. */
      addTitle(input: TitleInput, seasons: SeasonInput[]): string | null {
        const id = newCustomTitleId(input.title, () => crypto.randomUUID())
        const label = `Added ${input.title.trim()}`
        if (!store.apply((d, c) => addCustomTitle(d, c, id, input, seasons), label)) return null
        toast(label, [...(openDetail ? [{ label: 'Open', onClick: () => openDetail(id) }] : []), undo])
        return id
      },
      updateTitle(id: string, input: TitleInput) {
        run(`Updated ${input.title.trim()}`, (d, c) => updateCustomTitle(d, c, id, input))
      },
      deleteTitle(v: TitleView) {
        run(`Deleted ${v.title.title}`, (d, c) => deleteCustomTitle(d, c, v.title.id))
      },
      addSeason(v: TitleView, input: SeasonInput) {
        const next = Math.max(0, ...v.seasons.map((s) => s.number)) + 1
        run(`Added Season ${next} to ${v.title.title}`, (d, c) => addSeason(d, c, v.title, catalog.seasons, input))
      },
      updateSeason(v: TitleView, s: Season, input: SeasonInput) {
        run(`Updated ${v.title.title} ${s.label}`, (d, c) => updateCustomSeason(d, c, s.id, input))
      },
      deleteSeason(v: TitleView, s: Season) {
        run(`Deleted ${v.title.title} ${s.label}`, (d, c) => deleteCustomSeason(d, c, s.id))
      },
      /** Moves a whole group between tabs; null puts it back where it's recommended. */
      setGroupPlacement(group: Collection, label: string, universe: Universe | null, recommended: Universe) {
        const to = universe ?? recommended
        run(`${label} now in ${to === 'mcu' ? 'MCU' : 'Other Marvel'}`, (d, c) => setGroupPlacement(d, c, group, universe))
      },
      resetGroupPlacement() {
        run('Back to the recommended placement', (d, c) => resetGroupPlacement(d, c))
      },
      /** Episode stepper: saved quietly, no toast for every tap. */
      setEpisodes(watchId: string, episodes: number, episodeCount: number | null) {
        store.apply((d, c) => setEpisodes(d, c, watchId, episodes, episodeCount), 'Changed episode count')
      },
    }
  }, [store, toast, openDetail])
}
