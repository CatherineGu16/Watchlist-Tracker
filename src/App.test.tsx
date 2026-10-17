// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App.tsx'

afterEach(cleanup)

// jsdom lacks the layout APIs Radix menus measure with.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver
Element.prototype.scrollIntoView ??= () => {}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}

// One store per page load, so these steps build on each other like a single session.
describe('App', () => {
  it('checks off a movie, shows Undo, and undoes it', async () => {
    const user = userEvent.setup()
    render(<App />)
    const box = await screen.findByRole('checkbox', { name: 'Iron Man watched' })
    expect(box).toHaveAttribute('aria-checked', 'false')

    await user.click(box)
    expect(box).toHaveAttribute('aria-checked', 'true')
    const toast = await screen.findByRole('status')
    expect(toast).toHaveTextContent('Checked off Iron Man')

    await user.click(within(toast).getByRole('button', { name: 'Undo' }))
    expect(screen.getByRole('checkbox', { name: 'Iron Man watched' })).toHaveAttribute('aria-checked', 'false')
  })

  it('filters to TV and starts, counts and finishes a season', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('radio', { name: 'TV' }))
    expect(screen.queryByRole('checkbox', { name: 'Iron Man watched' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^WandaVision: 0 of 1 seasons watched/ }))
    const sheet = await screen.findByRole('dialog')
    await user.click(within(sheet).getByRole('button', { name: 'Start watching' }))
    await user.click(within(sheet).getByRole('button', { name: 'One more episode' }))
    await user.click(within(sheet).getByRole('button', { name: 'One more episode' }))
    expect(within(sheet).getByText('2')).toBeInTheDocument()

    await user.click(within(sheet).getByRole('button', { name: 'Finish season today' }))
    expect(within(sheet).getByText('All caught up')).toBeInTheDocument()
  })

  it('marks seasons watched long ago without inventing dates', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /^Loki: 0 of 2 seasons watched/ }))
    const sheet = await screen.findByRole('dialog')
    await user.click(within(sheet).getByRole('button', { name: 'More for Loki' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Mark all 2 seasons watched, date unknown' }))
    expect(within(sheet).getByText('All caught up')).toBeInTheDocument()
    expect(within(sheet).getAllByText('date unknown')).toHaveLength(2)
  })

  it('switches to Other Marvel and searches', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('tab', { name: /Other Marvel/ }))
    await user.type(screen.getByRole('searchbox', { name: 'Search titles' }), 'shield')
    expect(await screen.findByText('Agents of S.H.I.E.L.D.')).toBeInTheDocument()
    expect(screen.queryByText('Venom')).not.toBeInTheDocument()
  })
})
