export type ThemePref = 'system' | 'dark' | 'light'

export const THEME_KEY = 'watchlist.theme'

export function readThemePref(): ThemePref {
  try {
    const v = JSON.parse(localStorage.getItem(THEME_KEY) ?? '"system"')
    return v === 'dark' || v === 'light' ? v : 'system'
  } catch {
    return 'system'
  }
}

/** Sets the theme on <html> and matches the browser/status bar color to the page. */
export function applyTheme(pref: ThemePref) {
  const root = document.documentElement
  if (pref === 'system') delete root.dataset.theme
  else root.dataset.theme = pref
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#11152a')
}
