import type { Page } from '@playwright/test'
import { TODAY, box, expect, openAddTitle, openList, openSettings, sheet, test } from './helpers.ts'
import { readFileSync } from 'node:fs'

const form = (page: Page) => sheet(page)

async function setYear(page: Page, label: string, year: string) {
  await form(page).getByRole('radiogroup', { name: `${label} precision` }).getByRole('radio', { name: 'Year' }).click()
  const input = form(page).getByLabel(`${label} year`)
  await input.fill(year)
  await input.press('Enter')
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY)
  await openList(page)
})

test('add a movie, open it from the confirmation, and find it in the list', async ({ page }) => {
  await openAddTitle(page)
  await form(page).getByLabel('Title').fill('Blade')
  await setYear(page, 'Release date', '2027')
  await form(page).getByLabel('Phase').selectOption('6')
  await form(page).getByRole('button', { name: 'Add title' }).click()

  await expect(page.getByRole('status')).toContainText('Added Blade')
  await page.getByRole('status').getByRole('button', { name: 'Open' }).click()
  await expect(sheet(page).getByRole('heading', { name: 'Blade' })).toBeVisible()
  await expect(sheet(page)).toContainText('Added by you')
  await expect(sheet(page)).toContainText('Coming 2027')
  await page.keyboard.press('Escape')

  await page.getByRole('searchbox', { name: 'Search titles' }).fill('blade')
  await expect(page.getByRole('button', { name: /^Blade Movie/ })).toContainText('Phase 6')
  await page.reload()
  await page.getByRole('searchbox', { name: 'Search titles' }).fill('blade')
  await expect(box(page, 'Blade')).toBeVisible()
})

test('add a show with seasons and start watching it', async ({ page }) => {
  await openAddTitle(page)
  await form(page).getByLabel('Title').fill('Wonder Woman Animated')
  await form(page).getByRole('radiogroup', { name: 'Type' }).getByRole('radio', { name: 'Show' }).click()
  await setYear(page, 'Premiere date', '2024')
  await form(page).getByRole('radiogroup', { name: 'Where it goes' }).getByRole('radio', { name: 'Other Marvel' }).click()
  await form(page).getByLabel('Saga').selectOption('__new__')
  await form(page).getByLabel('New saga name').fill('Animated')
  await form(page).getByRole('listitem', { name: 'Season 1' }).getByLabel('Episodes').fill('10')
  await form(page).getByRole('button', { name: 'Add another season' }).click()
  const s2 = form(page).getByRole('listitem', { name: 'Season 2' })
  await s2.getByLabel('Episodes').fill('8')
  await s2.getByRole('radiogroup', { name: 'Premiere precision' }).getByRole('radio', { name: 'Year' }).click()
  await s2.getByLabel('Premiere year').fill('2025')
  await s2.getByLabel('Premiere year').press('Enter')
  await form(page).getByRole('button', { name: 'Add title' }).click()
  await expect(sheet(page)).toHaveCount(0)

  await page.getByRole('tab', { name: /Other Marvel/ }).click()
  await page.getByRole('button', { name: /^Wonder Woman Animated: 0 of 2 seasons/ }).click()
  await expect(sheet(page).getByRole('listitem', { name: 'Season 1' })).toContainText('10 episodes')
  // Season 1 was left undated, so it takes the show's premiere year.
  await expect(sheet(page).getByRole('listitem', { name: 'Season 1' })).toContainText('Premiered 2024')
  await expect(sheet(page).getByRole('listitem', { name: 'Season 2' })).toContainText('8 episodes')
  await sheet(page).getByRole('listitem', { name: 'Season 1' }).getByRole('button', { name: 'Start watching' }).click()
  await expect(sheet(page).getByRole('listitem', { name: 'Season 1' })).toContainText('0 / 10')
})

test('a title needs a name', async ({ page }) => {
  await openAddTitle(page)
  await form(page).getByRole('button', { name: 'Add title' }).click()
  await expect(form(page).getByText('Give it a name.')).toBeVisible()
  await expect(form(page).getByLabel('Title')).toHaveAttribute('aria-invalid', 'true')
})

test('warns about a title already in the list and opens it', async ({ page }) => {
  await openAddTitle(page)
  await form(page).getByLabel('Title').fill('iron man')
  await setYear(page, 'Release date', '2008')
  await expect(form(page).getByRole('status')).toContainText('Iron Man (2008) is already in your list')
  await form(page).getByRole('button', { name: 'Open it' }).click()
  await expect(sheet(page).getByRole('heading', { name: 'Iron Man' })).toBeVisible()
})

test('edit and delete a title you added, with undo', async ({ page }) => {
  await openAddTitle(page)
  await form(page).getByLabel('Title').fill('Nova')
  await form(page).getByRole('button', { name: 'Add title' }).click()
  await page.getByRole('status').getByRole('button', { name: 'Open' }).click()

  await sheet(page).getByRole('button', { name: 'More for Nova' }).click()
  await page.getByRole('menuitem', { name: 'Edit title' }).click()
  await expect(page.getByRole('heading', { name: 'Edit title' })).toBeVisible()
  await page.getByRole('dialog', { name: 'Edit title' }).getByLabel('Title').fill('Nova (series)')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(sheet(page).getByRole('heading', { name: 'Nova (series)' })).toBeVisible()

  await sheet(page).getByRole('button', { name: 'More for Nova (series)' }).click()
  await page.getByRole('menuitem', { name: 'Delete title…' }).click()
  await sheet(page).getByRole('button', { name: 'Delete title' }).click()
  await expect(page.getByRole('status')).toContainText('Deleted Nova (series)')
  await page.getByRole('searchbox', { name: 'Search titles' }).fill('nova')
  await expect(page.getByText('Nothing matches')).toBeVisible()
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect(box(page, 'Nova (series)')).toBeVisible()
})

test('catalog titles cannot be edited or deleted', async ({ page }) => {
  await page.getByRole('button', { name: /^Iron Man Movie/ }).click()
  await sheet(page).getByRole('button', { name: 'More for Iron Man' }).click()
  await expect(page.getByRole('menuitem', { name: 'Edit title' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: /Delete/ })).toHaveCount(0)
})

test('add an announced season to a show from the catalog, then delete it', async ({ page }) => {
  await page.getByRole('radio', { name: 'TV' }).click()
  await page.getByRole('button', { name: /^Hawkeye: 0 of 1 seasons/ }).click()
  await sheet(page).getByRole('button', { name: 'More for Hawkeye' }).click()
  await page.getByRole('menuitem', { name: 'Add a season' }).click()
  await expect(sheet(page).getByRole('heading', { name: 'Add Season 2' })).toBeVisible()
  await sheet(page).getByLabel('Episodes').fill('6')
  await sheet(page).getByRole('button', { name: 'Add season' }).click()

  const s2 = sheet(page).getByRole('listitem', { name: 'Season 2' })
  await expect(s2).toContainText('6 episodes')
  await expect(s2).toContainText('Premiere date to be announced')
  await expect(s2).toContainText('Upcoming')
  // An unaired season doesn't count against being caught up.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /^Hawkeye: 0 of 1 seasons/ })).toBeVisible()

  await page.getByRole('button', { name: /^Hawkeye Series/ }).click()
  await sheet(page).getByRole('button', { name: 'More for Season 2' }).click()
  await page.getByRole('menuitem', { name: 'Edit or delete season' }).click()
  await sheet(page).getByRole('button', { name: 'Delete season' }).click()
  await expect(sheet(page).getByRole('listitem', { name: 'Season 2' })).toHaveCount(0)
})

test('titles you add are in the backup file', async ({ page }) => {
  await openAddTitle(page)
  await form(page).getByLabel('Title').fill('Armor Wars')
  await form(page).getByRole('button', { name: 'Add title' }).click()
  await openSettings(page)
  const download = page.waitForEvent('download')
  await sheet(page).getByRole('button', { name: 'Export' }).click()
  const data = JSON.parse(readFileSync((await (await download).path())!, 'utf8'))
  expect(data.customTitles).toEqual([expect.objectContaining({ title: 'Armor Wars', custom: true, type: 'movie' })])
})
