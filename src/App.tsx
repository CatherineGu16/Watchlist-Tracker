import catalogJson from './data/catalog.json'
import type { Catalog } from './lib/types.ts'

const catalog = catalogJson as Catalog

// Placeholder shell until the list UI lands in M3.
export default function App() {
  const mcu = catalog.titles.filter((t) => t.universe === 'mcu').length
  return (
    <main className="min-h-dvh bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold">Marvel Watchlist</h1>
        <p className="mt-2 text-zinc-400">
          Catalog loaded: {catalog.titles.length} titles ({mcu} MCU, {catalog.titles.length - mcu} other),{' '}
          {catalog.seasons.length} seasons.
        </p>
      </div>
    </main>
  )
}
