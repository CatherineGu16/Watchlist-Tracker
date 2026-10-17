import { mergeData } from '../lib/privateData.ts'
import type { PrivateData } from '../lib/types.ts'
import { emptyData, revertTo, type EditContext } from '../lib/watchActions.ts'
import type { StorageBackend } from './storage.ts'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface WatchlistState {
  status: 'loading' | 'ready' | 'error'
  data: PrivateData
  saveState: SaveState
  error: string | null
  /** False when the browser blocked storage and changes only last until the tab closes. */
  durable: boolean
  /** Label of the edit Undo would revert, e.g. "Checked off Iron Man". */
  undoLabel: string | null
}

export type Edit = (data: PrivateData, ctx: EditContext) => PrivateData

const UNDO_LIMIT = 20

export interface WatchlistStore {
  getState(): WatchlistState
  subscribe(listener: () => void): () => void
  init(): Promise<void>
  /**
   * Applies an edit right away, then saves in the background. Returns the edit's undo id, or null
   * if the edit was refused.
   */
  apply(edit: Edit, label: string): number | null
  /**
   * Reverts the latest edit, or with an id only that edit, and only while nothing has changed
   * since (so an old confirmation's Undo can't revert something else). False if refused.
   */
  undo(id?: number): boolean
  /** Import: merge keeps edits from both; replace swaps in the file as-is. */
  importData(incoming: PrivateData, mode: 'merge' | 'replace'): void
  /**
   * Takes in data merged with another device. Clears undo: older snapshots don't know about the
   * incoming watches, so undoing past this point would delete them.
   */
  applySynced(data: PrivateData): void
  /** Resolves once everything applied so far is on disk. */
  flush(): Promise<void>
}

export function createWatchlistStore(
  backend: StorageBackend,
  clock: () => Date = () => new Date(),
  newId: () => string = () => crypto.randomUUID(),
): WatchlistStore {
  const ctx = (): EditContext => ({ now: clock().toISOString(), newId })
  let state: WatchlistState = {
    status: 'loading',
    data: emptyData(clock().toISOString()),
    saveState: 'idle',
    error: null,
    durable: backend.kind === 'indexeddb',
    undoLabel: null,
  }
  const listeners = new Set<() => void>()
  const undoStack: { id: number; label: string; data: PrivateData }[] = []
  let nextUndoId = 1

  const set = (patch: Partial<WatchlistState>) => {
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
  }

  // Saves run one at a time; a burst of edits ends with one write of the latest data.
  let writing: Promise<void> = Promise.resolve()
  let dirty = false
  const persist = () => {
    dirty = true
    set({ saveState: 'saving' })
    writing = writing.then(async () => {
      if (!dirty) return
      dirty = false
      try {
        await backend.save(state.data)
        if (!dirty) set({ saveState: 'saved', error: null })
      } catch (e) {
        set({ saveState: 'error', error: `Couldn't save on this device: ${(e as Error).message}` })
      }
    })
  }

  const commit = (data: PrivateData, label: string | null): number | null => {
    let id: number | null = null
    if (label) {
      id = nextUndoId++
      undoStack.push({ id, label, data: state.data })
      if (undoStack.length > UNDO_LIMIT) undoStack.shift()
    }
    set({ data, undoLabel: undoStack.at(-1)?.label ?? null })
    persist()
    return id
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async init() {
      try {
        const saved = await backend.load()
        set({ status: 'ready', data: saved ?? state.data })
      } catch (e) {
        set({ status: 'error', error: `Couldn't read saved data: ${(e as Error).message}` })
      }
    },
    apply(edit, label) {
      if (state.status !== 'ready') return null
      try {
        return commit(edit(state.data, ctx()), label)
      } catch (e) {
        set({ error: (e as Error).message })
        return null
      }
    },
    undo(id) {
      const last = undoStack.at(-1)
      if (!last || (id !== undefined && last.id !== id)) return false
      undoStack.pop()
      commit(revertTo(state.data, last.data, ctx()), null)
      return true
    },
    importData(incoming, mode) {
      commit(mode === 'merge' ? mergeData(state.data, incoming) : incoming, mode === 'merge' ? 'Imported backup' : 'Replaced data from backup')
    },
    applySynced(data) {
      undoStack.length = 0
      commit(data, null)
    },
    flush: () => writing,
  }
}
