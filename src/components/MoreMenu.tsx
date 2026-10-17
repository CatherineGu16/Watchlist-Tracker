import * as Menu from '@radix-ui/react-dropdown-menu'

export interface MenuItem {
  label: string
  onSelect: () => void
  tone?: 'danger'
}

/** The ⋯ button: less-used actions live here so the panel stays readable. */
export function MoreMenu({ label, items }: { label: string; items: MenuItem[] }) {
  if (items.length === 0) return null
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        aria-label={label}
        className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-raised hover:text-fg data-[state=open]:bg-raised data-[state=open]:text-fg"
      >
        <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
          <circle cx="4.5" cy="10" r="1.6" fill="currentColor" />
          <circle cx="10" cy="10" r="1.6" fill="currentColor" />
          <circle cx="15.5" cy="10" r="1.6" fill="currentColor" />
        </svg>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={4}
          collisionPadding={12}
          className="z-[60] min-w-56 rounded-xl border border-line bg-raised p-1 shadow-[0_8px_30px_rgb(0_0_0/0.35)] [animation:fade-in_120ms_ease-out]"
        >
          {items.map((item) => (
            <Menu.Item
              key={item.label}
              onSelect={item.onSelect}
              className={`flex min-h-11 cursor-pointer items-center rounded-lg px-3 text-sm outline-none select-none data-[highlighted]:bg-line ${item.tone === 'danger' ? 'text-danger' : 'text-fg'}`}
            >
              {item.label}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
