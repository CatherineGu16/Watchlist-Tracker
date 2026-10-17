import type { ReactNode } from 'react'
import type { Page } from '../ui/route.ts'

const PAGES: { id: Page; label: string; href: string; icon: ReactNode }[] = [
  {
    id: 'home',
    label: 'Home',
    href: '#/',
    icon: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
  },
  {
    id: 'browse',
    label: 'Browse',
    href: '#/browse',
    icon: <path d="M5 6h14M5 12h14M5 18h9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  },
]

/** App title, page links (desktop), sync status and Settings. Shown on every page. */
export function AppBar({ page, onSettings, syncChip, actions }: { page: Page; onSettings: () => void; syncChip?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex items-center gap-2 px-3 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 sm:px-4">
      <h1 className="font-display text-[2rem] leading-none font-semibold tracking-tight">Watchlist</h1>
      <nav aria-label="Pages" className="ml-6 hidden gap-1 lg:flex">
        {PAGES.map((p) => (
          <a
            key={p.id}
            href={p.href}
            aria-current={p.id === page ? 'page' : undefined}
            className={`min-h-10 rounded-lg px-3 py-2 font-bold ${p.id === page ? 'bg-raised text-fg' : 'text-muted hover:text-fg'}`}
          >
            {p.label}
          </a>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-1">
        {actions}
        {syncChip}
        <button
          onClick={onSettings}
          aria-label="Settings"
          className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
        >
          <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm7.4-2.5a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5Z"
            />
          </svg>
        </button>
      </div>
    </header>
  )
}

/** Phones and tablets: pages at the bottom, in thumb reach. Desktop uses the links in the app bar. */
export function TabBar({ page, onAdd }: { page: Page; onAdd: () => void }) {
  return (
    <nav
      aria-label="Pages"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {PAGES.map((p) => (
          <li key={p.id} className="flex-1">
            <a
              href={p.href}
              aria-current={p.id === page ? 'page' : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-bold ${p.id === page ? 'text-fg' : 'text-muted'}`}
            >
              <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
                {p.icon}
              </svg>
              {p.label}
            </a>
          </li>
        ))}
        <li className="flex-1">
          <button onClick={onAdd} className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs font-bold text-muted">
            <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Add
          </button>
        </li>
      </ul>
    </nav>
  )
}
