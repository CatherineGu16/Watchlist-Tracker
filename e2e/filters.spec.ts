import { expect, test } from '@playwright/test'
import { catalog, openList, sheet, TODAY } from './helpers.ts'

const inPhase = (p: number) =>
  catalog.titles.filter(
    (t) => t.universe === 'mcu' && (t.phase === p || catalog.seasons.some((s) => s.titleId === t.id && s.phase === p)),
  )
const rows = (page: import('@playwright/test').Page) => page.locator('section li')

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY)
  await openList(page)
})

test.describe('phone and tablet: filters drawer', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 1024, 'desktop uses the sidebar')

  test('changes wait for Show N titles, which applies and closes', async ({ page }) => {
    await page.getByRole('button', { name: 'Filters' }).click()
    await sheet(page).getByRole('button', { name: '4', exact: true }).click()
    const apply = sheet(page).getByRole('button', { name: `Show ${inPhase(4).length} titles` })
    await expect(apply).toBeVisible()
    // Nothing applied yet behind the drawer.
    await expect(page.getByRole('list', { name: 'Active filters' })).toHaveCount(0)
    await apply.click()
    await expect(sheet(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Remove filter: Phase 4' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Filters\s*1/ })).toBeVisible()
    await expect(rows(page)).toHaveCount(inPhase(4).length)
  })

  test('closing without applying discards the draft', async ({ page }) => {
    await page.getByRole('button', { name: 'Filters' }).click()
    await sheet(page).getByRole('button', { name: 'Watched', exact: true }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('list', { name: 'Active filters' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Filters' }).click()
    await expect(sheet(page).getByRole('button', { name: 'Watched', exact: true })).toHaveAttribute('aria-pressed', 'false')
  })

  test('Clear all, then apply, removes every filter', async ({ page }) => {
    await page.getByRole('button', { name: 'Filters' }).click()
    await sheet(page).getByRole('button', { name: 'Multiverse Saga' }).click()
    await sheet(page).getByRole('button', { name: 'Upcoming' }).click()
    await sheet(page).getByRole('button', { name: /^Show / }).click()
    await expect(page.getByRole('list', { name: 'Active filters' }).getByRole('button')).toHaveCount(2)

    await page.getByRole('button', { name: /^Filters/ }).click()
    await sheet(page).getByRole('button', { name: 'Clear all' }).click()
    await sheet(page).getByRole('button', { name: /^Show / }).click()
    await expect(page.getByRole('list', { name: 'Active filters' })).toHaveCount(0)
  })

  test('a filter with no matches says so instead of a count', async ({ page }) => {
    await page.getByRole('button', { name: 'Filters' }).click()
    await sheet(page).getByRole('button', { name: '1', exact: true }).click()
    await sheet(page).getByRole('button', { name: 'Upcoming' }).click()
    await expect(sheet(page).getByRole('button', { name: 'No matches' })).toBeVisible()
  })
})

test.describe('desktop: filters sidebar', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'phones use the drawer')

  test('filters apply as you pick them, and chips remove them', async ({ page }) => {
    const sidebar = page.getByRole('complementary', { name: 'Filters' })
    await expect(sidebar).toBeVisible()
    await expect(page.getByRole('button', { name: 'Filters' })).toBeHidden()
    await sidebar.getByRole('button', { name: '4', exact: true }).click()
    await expect(rows(page)).toHaveCount(inPhase(4).length)
    await page.getByRole('button', { name: 'Remove filter: Phase 4' }).click()
    await expect(sidebar.getByRole('button', { name: 'Any', exact: true }).first()).toHaveAttribute('aria-pressed', 'true')
  })
})
