/**
 * One-time import of the Google Sheet export.
 *
 *   npm run import:sheet
 *
 * Reads   data/source/main-list.csv, data/source/series-tracker.csv,
 *         data/source/watch-overrides.json (optional)  — all git-ignored
 * Writes  src/data/catalog.json          — public title catalog, committed
 *         data/private/watchlist.json    — your watch history, git-ignored, goes to the private repo
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildFromSheet, type WatchOverrides } from './import-lib.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')
const write = (p: string, data: unknown) => {
  const file = resolve(root, p)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
}

const overridesFile = 'data/source/watch-overrides.json'
const { _comment, ...overrides } = existsSync(resolve(root, overridesFile)) ? JSON.parse(read(overridesFile)) : {}

const { catalog, privateData, warnings } = buildFromSheet(
  read('data/source/main-list.csv'),
  read('data/source/series-tracker.csv'),
  new Date(),
  { overrides: overrides as WatchOverrides },
)

write('src/data/catalog.json', catalog)
write('data/private/watchlist.json', privateData)

const count = (u: string) => catalog.titles.filter((t) => t.universe === u).length
console.log(`Catalog: ${catalog.titles.length} titles (${count('mcu')} MCU, ${count('other')} other), ${catalog.seasons.length} seasons`)
console.log(`Private: ${privateData.watches.length} watches`)
for (const w of warnings) console.warn(`warning: ${w}`)
