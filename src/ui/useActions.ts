import { useMemo } from 'react'
import type { TitleView } from '../lib/catalogView.ts'
import { todayIso } from '../lib/partialDate.ts'
import { isFinished } from '../lib/status.ts'
import type { Season } from '../lib/types.ts'
import {
  checkOff,
  deleteWatch,
  finishWatch,
  logWatch,
  setEpisodes,
  startSeason,
  updateWatch,
  type NewWatch,
  type WatchPatch,
} from '../lib/watchActions.ts'
import { useToast } from '../components/toastContext.ts'
import { useStore } from '../store/StoreContext.tsx'
import type { Edit } from '../store/watchlistStore.ts'

/** Every change goes through here: apply, save, and confirm with an Undo. */
export function useActions(openDetail?: (titleId: string) => void) {
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
          toast(label, [...(openDetail ? [{ label: 'Change date', onClick: () => openDetail(v.title.id) }] : []), undo])
        } else if (finished.length === 1 && v.watches.length === 1) {
          run(`Unchecked ${v.title.title}`, (d, c) => deleteWatch(d, c, finished[0].id))
        } else {
          // Several watches: pick which one to remove in the detail panel.
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
      /** Episode stepper: saved quietly, no toast for every tap. */
      setEpisodes(watchId: string, episodes: number, episodeCount: number | null) {
        store.apply((d, c) => setEpisodes(d, c, watchId, episodes, episodeCount), 'Changed episode count')
      },
    }
  }, [store, toast, openDetail])
}
