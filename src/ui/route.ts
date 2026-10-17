import { useCallback, useSyncExternalStore } from 'react'

export type Page = 'home' | 'browse'

export interface Route {
  page: Page
  /** The title whose panel is open, if any. */
  titleId: string | null
}

/**
 * Routes live in the hash ("#/browse?title=iron-man-2008") so GitHub Pages needs no server rules,
 * the installed app opens on Home, and Back moves between pages and closes an open panel.
 */
export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?')
  const page: Page = path.replace(/^\/+|\/+$/g, '') === 'browse' ? 'browse' : 'home'
  const titleId = new URLSearchParams(query).get('title')
  return { page, titleId: titleId || null }
}

export function toHash(route: Route): string {
  const path = route.page === 'browse' ? '#/browse' : '#/'
  return route.titleId ? `${path}?title=${encodeURIComponent(route.titleId)}` : path
}

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  window.addEventListener('hashchange', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
    window.removeEventListener('hashchange', listener)
  }
}

/** Marks history entries this app pushed for an open panel, so closing it can step back instead. */
const PANEL_STATE = 'watchlist-panel'

export function useRoute() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  const route = parseHash(hash)

  const go = useCallback((next: Route, mode: 'push' | 'replace' = 'push', state: unknown = null) => {
    const url = toHash(next)
    if (url === window.location.hash) return
    if (mode === 'push') window.history.pushState(state, '', url)
    else window.history.replaceState(state, '', url)
    notify()
  }, [])

  const openTitle = useCallback((id: string) => go({ ...parseHash(window.location.hash), titleId: id }, 'push', PANEL_STATE), [go])

  /** Closing a panel we opened steps Back, so the Back button and the close button agree. */
  const closeTitle = useCallback(() => {
    if (window.history.state === PANEL_STATE) window.history.back()
    else go({ ...parseHash(window.location.hash), titleId: null }, 'replace')
  }, [go])

  const goTo = useCallback((page: Page) => go({ page, titleId: null }), [go])

  return { route, goTo, openTitle, closeTitle }
}
