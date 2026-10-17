import { test as base, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Catalog } from '../src/lib/types.ts'

/** Every spec uses this `test`: it fails any test whose page throws an uncaught error, even if the UI looked fine. */
export const test = base.extend({
  page: async ({ page }, runTest) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.stack ?? e.message))
    await runTest(page)
    expect(errors, 'uncaught errors in the page').toEqual([])
  },
})
export { expect }

/**
 * The one place that knows how to reach each screen. When navigation changes (a home screen in
 * front of the list, a bottom tab bar), update these and every spec keeps working.
 */
export async function openList(page: Page) {
  await openHome(page)
  await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Browse' }).click()
  await expect(page.getByRole('searchbox', { name: 'Search titles' })).toBeVisible()
}

export async function openHome(page: Page) {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Continue watching' })).toBeVisible()
}

export async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(sheet(page)).toBeVisible()
}

export const sheet = (page: Page) => page.getByRole('dialog')
export const box = (page: Page, title: string) => page.getByRole('checkbox', { name: `${title} watched` })
export const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))

export const catalog: Catalog = JSON.parse(readFileSync(fileURLToPath(new URL('../src/data/catalog.json', import.meta.url)), 'utf8'))

/** Pins "today" so countdowns and "released yet?" checks don't drift. */
export const TODAY = new Date('2026-10-16T12:00:00')

export async function importBackup(page: Page, file: string, mode: 'Merge (keep both)' | "Replace this device's data" = 'Merge (keep both)') {
  await openSettings(page)
  const chooser = page.waitForEvent('filechooser')
  await sheet(page).getByRole('button', { name: 'Import…' }).click()
  await (await chooser).setFiles(fixture(file))
  await sheet(page).getByRole('button', { name: mode }).click()
  await page.keyboard.press('Escape')
  await expect(sheet(page)).toHaveCount(0)
}
