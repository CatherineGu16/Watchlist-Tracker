/**
 * iOS home screen apps launch with a viewport that's short by the status bar height, and anything fixed
 * to the bottom (tab bar, sheets) is cut off at that height. WebKit re-measures once the page becomes
 * scrollable, which a short page like Home never does on its own. So make the page a pixel taller and
 * scroll it once, right after launch.
 */
export function settleViewport() {
  if (!matchMedia('(display-mode: standalone)').matches) return
  const nudge = () =>
    requestAnimationFrame(() => {
      // Leave a restored scroll position alone; the page has already scrolled.
      if (window.scrollY !== 0) return
      const root = document.documentElement
      root.style.minHeight = 'calc(100% + 1px)'
      window.scrollTo(0, 1)
      requestAnimationFrame(() => {
        window.scrollTo(0, 0)
        root.style.minHeight = ''
      })
    })
  if (document.readyState === 'complete') nudge()
  else window.addEventListener('load', nudge, { once: true })
}
