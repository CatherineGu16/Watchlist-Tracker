import { expect, test } from '@playwright/test'
import { box, importBackup, openList, sheet, TODAY } from './helpers.ts'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY)
  await openList(page)
})

test('an unwatched show has no "date unknown" buttons face up; they live in the ⋯ menus', async ({ page }) => {
  await page.getByRole('radio', { name: 'TV' }).click()
  await page.getByRole('button', { name: /^Loki: 0 of 2 seasons watched/ }).click()
  await expect(sheet(page).getByRole('button', { name: /date unknown/i })).toHaveCount(0)
  await expect(sheet(page).getByRole('button', { name: 'Start watching' })).toHaveCount(2)

  await sheet(page).getByRole('button', { name: 'More for Loki' }).click()
  await expect(page.getByRole('menuitem', { name: 'Mark all 2 seasons watched, date unknown' })).toBeVisible()
  await page.keyboard.press('Escape')
  await sheet(page).getByRole('button', { name: 'More for Season 1' }).click()
  await page.getByRole('menuitem', { name: 'Watched, date unknown' }).click()
  await expect(sheet(page).getByRole('listitem', { name: 'Season 1' })).toContainText('Last watched date unknown')
})

test('a rewatched movie shows only its last watch; every date is in Watch history, newest first', async ({ page }) => {
  await importBackup(page, 'regression-backup.json')
  await page.getByRole('button', { name: /^Captain America: Brave New World Movie/ }).click()
  await expect(sheet(page).getByRole('heading', { name: 'Last watched Aug 10, 2025' })).toBeVisible()
  await expect(sheet(page).getByText('Watched 2 times')).toBeVisible()
  await expect(sheet(page).getByRole('button', { name: /^Edit / })).toHaveCount(0)

  await sheet(page).getByRole('button', { name: 'More for Captain America: Brave New World' }).click()
  await page.getByRole('menuitem', { name: 'Watch history (2)' }).click()
  const entries = sheet(page).getByRole('region', { name: 'Watch history' }).getByRole('listitem')
  await expect(entries).toHaveCount(2)
  await expect(entries.nth(0)).toContainText('Rewatch 1')
  await expect(entries.nth(0)).toContainText('Aug 10, 2025')
  await expect(entries.nth(1)).toContainText('First watch')
  await expect(entries.nth(1)).toContainText('Mar 1, 2025')
})

test('add a past watch with just a year', async ({ page }) => {
  await page.getByRole('button', { name: /^Thor Movie/ }).click()
  await sheet(page).getByRole('button', { name: 'More for Thor' }).click()
  await page.getByRole('menuitem', { name: 'Add a past watch' }).click()
  await sheet(page).getByRole('button', { name: 'Add a past watch' }).click()
  await sheet(page).getByRole('radio', { name: 'Year' }).click()
  const year = sheet(page).getByLabel('Watched on year')
  await year.fill('2012')
  await year.press('Enter')
  await sheet(page).getByRole('button', { name: 'Add watch' }).click()
  await expect(sheet(page).getByRole('region', { name: 'Watch history' }).getByRole('listitem')).toContainText(['2012'])
  await page.keyboard.press('Escape')
  await expect(box(page, 'Thor')).toHaveAttribute('aria-checked', 'true')
})

test('Change date in the confirmation opens straight into editing that watch', async ({ page }) => {
  await box(page, 'Ant-Man').click()
  await page.getByRole('status').getByRole('button', { name: 'Change date' }).click()
  await expect(sheet(page).getByRole('heading', { name: 'Ant-Man' })).toBeVisible()
  await expect(sheet(page).getByRole('group', { name: 'Watched on' })).toBeVisible()
  await expect(sheet(page).locator('input[type=date]')).toHaveValue('2026-10-16')
})

test('a season in progress shows its counter face up and its start in history', async ({ page }) => {
  await page.getByRole('radio', { name: 'TV' }).click()
  await page.getByRole('button', { name: /^Echo: 0 of 1 seasons/ }).click()
  await sheet(page).getByRole('button', { name: 'Start watching' }).click()
  const season = sheet(page).getByRole('listitem', { name: 'Season 1' })
  await expect(season).toContainText('Started Oct 16, 2026')
  await expect(season.getByRole('button', { name: 'One more episode' })).toBeVisible()
  await season.getByRole('button', { name: 'More for Season 1' }).click()
  await page.getByRole('menuitem', { name: 'Watch history (1)' }).click()
  await expect(sheet(page).getByRole('heading', { name: 'Season 1: watch history' })).toBeVisible()
  await expect(sheet(page).getByText('Started Oct 16, 2026')).toBeVisible()
})

test('removing a watch from history can be undone', async ({ page }) => {
  await box(page, 'Iron Man').click()
  await page.getByRole('status').getByRole('button', { name: 'Change date' }).click()
  await sheet(page).getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByRole('status')).toContainText('Removed a watch of Iron Man')
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await page.keyboard.press('Escape')
  await expect(box(page, 'Iron Man')).toHaveAttribute('aria-checked', 'true')
})
