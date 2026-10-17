/**
 * Guards behavior the next round of changes (filters drawer, season history, home screen, adding
 * titles) is NOT meant to change. If one of these fails after those changes, something regressed.
 */
import { readFileSync } from 'node:fs'
import { TODAY, box, catalog, expect, importBackup, openList, openSettings, sheet, test } from './helpers.ts'

const mcu = catalog.titles.filter((t) => t.universe === 'mcu')
const infinity = mcu.filter((t) => t.saga === 'Infinity Saga')

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY)
  await openList(page)
})

test.describe('list and progress', () => {
  test('universe tab and saga legend counts follow check-offs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: `MCU 0/${mcu.length}` })).toBeVisible()
    await expect(page.getByText(`Infinity Saga 0/${infinity.length}`)).toBeVisible()
    await box(page, 'Iron Man').click()
    await expect(page.getByRole('tab', { name: `MCU 1/${mcu.length}` })).toBeVisible()
    await expect(page.getByText(`Infinity Saga 1/${infinity.length}`)).toBeVisible()
  })

  test('release order groups by year with watched counts', async ({ page }) => {
    const in2008 = mcu.filter((t) => t.releaseDate?.startsWith('2008')).length
    await expect(page.getByRole('heading', { name: '2008', exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: '2008' })).toContainText(`0/${in2008}`)
  })

  test('universe, type and sort are remembered after reload; search is not', async ({ page }) => {
    await page.getByRole('tab', { name: /Other Marvel/ }).click()
    await page.getByRole('radio', { name: 'TV' }).click()
    await page.getByRole('combobox', { name: 'Sort by' }).selectOption('title')
    await page.getByRole('searchbox', { name: 'Search titles' }).fill('legion')
    await page.reload()
    await expect(page.getByRole('tab', { name: /Other Marvel/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('radio', { name: 'TV' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('combobox', { name: 'Sort by' })).toHaveValue('title')
    await expect(page.getByRole('searchbox', { name: 'Search titles' })).toHaveValue('')
  })

  test('upcoming titles count down and the header points to the next release', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^Avengers: Doomsday Movie/ })).toContainText('Out Dec 18, 2026')
    await page.getByRole('button', { name: /^Next up Avengers: Doomsday/ }).click()
    await expect(sheet(page).getByRole('heading', { name: 'Avengers: Doomsday' })).toBeVisible()
  })

  test('an upcoming movie can still be checked off (early screenings)', async ({ page }) => {
    await box(page, 'Avengers: Doomsday').click()
    await expect(box(page, 'Avengers: Doomsday')).toHaveAttribute('aria-checked', 'true')
  })
})

test.describe('checking off', () => {
  test('uncheck a single-watch movie, then undo the uncheck', async ({ page }) => {
    await box(page, 'Thor').click()
    await box(page, 'Thor').click()
    await expect(box(page, 'Thor')).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByRole('status')).toContainText('Unchecked Thor')
    await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
    await expect(box(page, 'Thor')).toHaveAttribute('aria-checked', 'true')
  })

  test('Change date in the confirmation opens that title', async ({ page }) => {
    await box(page, 'Iron Man 2').click()
    await page.getByRole('status').getByRole('button', { name: 'Change date' }).click()
    await expect(sheet(page).getByRole('heading', { name: 'Iron Man 2' })).toBeVisible()
  })

  test('Escape closes the details and keeps the list where it was', async ({ page }) => {
    await page.getByRole('button', { name: /^The Avengers Movie/ }).click()
    await expect(sheet(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(sheet(page)).toHaveCount(0)
    await expect(page.getByRole('searchbox', { name: 'Search titles' })).toBeVisible()
  })
})

test.describe('imported history', () => {
  test.beforeEach(async ({ page }) => {
    await importBackup(page, 'regression-backup.json')
  })

  test('rewatched movies show a count, and their checkbox opens details instead of unchecking', async ({ page }) => {
    const row = page.getByRole('button', { name: /^Captain America: Brave New World Movie/ })
    await expect(row).toContainText('×2')
    await expect(row).toContainText('Aug 10, 2025')
    await box(page, 'Captain America: Brave New World').click()
    await expect(sheet(page).getByRole('heading', { name: 'Captain America: Brave New World' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(box(page, 'Captain America: Brave New World')).toHaveAttribute('aria-checked', 'true')
  })

  test('a watch with no date counts as watched and says so', async ({ page }) => {
    await expect(box(page, 'Werewolf by Night')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('button', { name: /^Werewolf by Night Special/ })).toContainText('Date unknown')
  })

  test('a show with a newer unwatched season is in progress', async ({ page }) => {
    const row = page.getByRole('button', { name: /^Daredevil: Born Again Series/ })
    await expect(row).toContainText('New: S2')
    await expect(page.getByRole('button', { name: /^Daredevil: Born Again: 1 of 2 seasons watched/ })).toBeVisible()
  })

  test('Export downloads everything on this device', async ({ page }) => {
    await openSettings(page)
    const download = page.waitForEvent('download')
    await sheet(page).getByRole('button', { name: 'Export' }).click()
    const file = await download
    expect(file.suggestedFilename()).toBe('marvel-watchlist-2026-10-16.json')
    const data = JSON.parse(readFileSync((await file.path())!, 'utf8'))
    expect(data.schemaVersion).toBe(1)
    expect(data.watches.map((w: { id: string }) => w.id).sort()).toEqual(['reg-1', 'reg-2', 'reg-3', 'reg-4'])
  })

  test('Replace swaps this device’s data for the file', async ({ page }) => {
    await box(page, 'Iron Man').click()
    await importBackup(page, 'regression-backup.json', "Replace this device's data")
    await expect(box(page, 'Iron Man')).toHaveAttribute('aria-checked', 'false')
    await expect(box(page, 'Werewolf by Night')).toHaveAttribute('aria-checked', 'true')
  })
})

test.describe('settings', () => {
  test('a file that is not a backup is refused with a reason', async ({ page }) => {
    await openSettings(page)
    const chooser = page.waitForEvent('filechooser')
    await sheet(page).getByRole('button', { name: 'Import…' }).click()
    await (await chooser).setFiles(new URL('./fixtures/not-a-backup.json', import.meta.url).pathname)
    await expect(sheet(page).getByText(/doesn't look like a watchlist backup/)).toBeVisible()
    await expect(sheet(page).getByRole('button', { name: 'Merge (keep both)' })).toHaveCount(0)
  })

  test('theme choice is remembered', async ({ page }) => {
    await openSettings(page)
    await sheet(page).getByRole('radio', { name: 'Dark' }).click()
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('sync is off until connected: no status chip, setup form shown', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Synced|Sync problem|Offline/ })).toHaveCount(0)
    await openSettings(page)
    await expect(sheet(page).getByRole('heading', { name: 'Sync across devices' })).toBeVisible()
    await expect(sheet(page).getByLabel('Private repo')).toHaveValue('watchlist-data')
  })
})
