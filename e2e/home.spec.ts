import type { Page } from '@playwright/test'
import { TODAY, box, expect, openHome, sheet, test } from './helpers.ts'

const nav = (page: Page) => page.getByRole('navigation', { name: 'Pages' })
const watching = (page: Page) => page.getByRole('region', { name: 'Continue watching' })
const recent = (page: Page) => page.getByRole('region', { name: 'Recently watched' })

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY)
  await openHome(page)
})

test('opens on Home with empty sections that say what to do', async ({ page }) => {
  await expect(nav(page).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
  await expect(watching(page)).toContainText('Nothing in progress')
  await expect(recent(page)).toContainText('Check off a movie')
  await page.getByRole('button', { name: 'Browse all titles' }).click()
  await expect(page.getByRole('searchbox', { name: 'Search titles' })).toBeVisible()
  await expect(nav(page).getByRole('link', { name: 'Browse' })).toHaveAttribute('aria-current', 'page')
})

test('a season you start shows up under Continue watching, with +1 and Finish', async ({ page }) => {
  await nav(page).getByRole('link', { name: 'Browse' }).click()
  await page.getByRole('radio', { name: 'TV' }).click()
  await page.getByRole('button', { name: /^WandaVision: 0 of 1 seasons/ }).click()
  await sheet(page).getByRole('button', { name: 'Start watching' }).click()
  await page.keyboard.press('Escape')
  await nav(page).getByRole('link', { name: 'Home' }).click()

  const card = watching(page).getByRole('listitem').filter({ hasText: 'WandaVision' })
  await expect(card).toContainText('Season 1')
  await expect(card).toContainText('0 / 9')
  await card.getByRole('button', { name: 'One more episode of WandaVision Season 1' }).click()
  await expect(card).toContainText('1 / 9')
  await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')

  await card.getByRole('button', { name: 'Finish WandaVision Season 1 today' }).click()
  await expect(watching(page)).toContainText('Nothing in progress')
  await expect(recent(page).getByRole('button', { name: /WandaVision/ })).toContainText('Oct 16, 2026')
})

test('recently watched cards open the title, and Back closes it', async ({ page }) => {
  await nav(page).getByRole('link', { name: 'Browse' }).click()
  await box(page, 'Iron Man').click()
  await nav(page).getByRole('link', { name: 'Home' }).click()
  await recent(page).getByRole('button', { name: /Iron Man/ }).click()
  await expect(sheet(page).getByRole('heading', { name: 'Iron Man' })).toBeVisible()
  await page.goBack()
  await expect(sheet(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Continue watching' })).toBeVisible()
})

test('Back moves between pages', async ({ page }) => {
  await nav(page).getByRole('link', { name: 'Browse' }).click()
  await expect(page.getByRole('searchbox', { name: 'Search titles' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Continue watching' })).toBeVisible()
})

test('closing a panel with ✕ takes it out of the address', async ({ page }) => {
  await nav(page).getByRole('link', { name: 'Browse' }).click()
  await page.getByRole('button', { name: /^Thor Movie/ }).click()
  await sheet(page).getByRole('button', { name: 'Close' }).click()
  await expect(sheet(page)).toHaveCount(0)
  await expect(page).toHaveURL(/#\/browse$/)
})

test('a link to a title opens its panel', async ({ page }) => {
  await page.goto('./#/browse?title=the-avengers-2012')
  await expect(sheet(page).getByRole('heading', { name: 'The Avengers' })).toBeVisible()
})

test('Home fits the screen with a full row of recent watches', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Browse' }).click()
  for (const t of ['Iron Man', 'Thor', 'Black Panther', 'Eternals', 'The Marvels', 'Ant-Man']) await box(page, t).click()
  await nav(page).getByRole('link', { name: 'Home' }).click()
  await expect(recent(page).getByRole('listitem')).toHaveCount(6)
  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `at ${width}px`).toBeLessThanOrEqual(0)
    await expect(page.getByRole('button', { name: 'Browse all titles' })).toBeInViewport()
  }
})

test.describe('navigation layout', () => {
  test('phones get a bottom tab bar', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) >= 1024)
    const bar = nav(page)
    await expect(bar).toBeVisible()
    const box = await bar.boundingBox()
    expect(box!.y + box!.height).toBeGreaterThan((viewport?.height ?? 0) - 2)
  })
  test('desktop puts the page links in the top bar', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 1024)
    const bar = nav(page)
    await expect(bar).toBeVisible()
    expect((await bar.boundingBox())!.y).toBeLessThan(100)
  })
})
