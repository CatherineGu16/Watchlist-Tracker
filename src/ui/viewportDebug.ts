/**
 * Temporary: records what iOS reports for the screen size at launch versus later, to diagnose the
 * home screen app's tab bar sitting in the wrong place until the first navigation. Remove once fixed.
 */

export type ViewportSnapshot = Record<string, string | number>

const start = performance.now()
const snapshots: { label: string; values: ViewportSnapshot }[] = []
const events: string[] = []

/** Resolves CSS lengths the way the page's CSS sees them. */
function cssLength(value: string, prop: 'height' | 'padding-top' = 'height'): number {
  const probe = document.createElement('div')
  probe.style.cssText = `position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;${prop}:${value}`
  document.body.appendChild(probe)
  const px = prop === 'height' ? probe.getBoundingClientRect().height : parseFloat(getComputedStyle(probe).paddingTop)
  probe.remove()
  return Math.round(px)
}

export function measureViewport(): ViewportSnapshot {
  const vv = window.visualViewport
  const bar = document.querySelectorAll('nav[aria-label="Pages"]')[1]?.getBoundingClientRect()
  return {
    'home screen app': matchMedia('(display-mode: standalone)').matches ? 'yes' : 'no',
    innerHeight: window.innerHeight,
    clientHeight: document.documentElement.clientHeight,
    'visualViewport h': vv ? Math.round(vv.height) : '-',
    'visualViewport top': vv ? Math.round(vv.offsetTop) : '-',
    'screen h': screen.height,
    'screen w': screen.width,
    svh: cssLength('100svh'),
    dvh: cssLength('100dvh'),
    lvh: cssLength('100lvh'),
    'safe top': cssLength('env(safe-area-inset-top)', 'padding-top'),
    'safe bottom': cssLength('env(safe-area-inset-bottom)', 'padding-top'),
    scrollY: Math.round(window.scrollY),
    'bar top': bar ? Math.round(bar.top) : '-',
    'bar bottom': bar ? Math.round(bar.bottom) : '-',
  }
}

export function recordViewport(label: string) {
  snapshots.push({ label, values: measureViewport() })
}

export const viewportSnapshots = () => snapshots
export const viewportEvents = () => events

function log(name: string) {
  if (events.length >= 30) return
  const vv = window.visualViewport
  events.push(`${Math.round(performance.now() - start)}ms ${name}: inner ${window.innerHeight}, vv ${vv ? Math.round(vv.height) : '-'}, lvh ${cssLength('100lvh')}`)
}

/** Call once, as early as possible. */
export function startViewportDebug() {
  recordViewport('launch')
  window.addEventListener('load', () => requestAnimationFrame(() => recordViewport('load')))
  setTimeout(() => recordViewport('2s'), 2000)
  for (const name of ['resize', 'orientationchange', 'pageshow', 'hashchange']) window.addEventListener(name, () => log(name))
  window.addEventListener('scroll', () => log('scroll'), { once: true })
  window.visualViewport?.addEventListener('resize', () => log('visualViewport resize'))
}
