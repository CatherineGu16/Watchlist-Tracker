import { TODAY, catalog, expect, openList, openSettings, sheet, test } from './helpers.ts'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY)
  await openList(page)
})

test('the Netflix shows are MCU', async ({ page }) => {
  await page.getByRole('radio', { name: 'TV' }).click()
  for (const name of ['Daredevil', 'Jessica Jones', 'Luke Cage', 'Iron Fist', 'The Defenders', 'The Punisher']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${name} Series`) })).toBeVisible()
  }
  await page.getByRole('tab', { name: /Other Marvel/ }).click()
  await expect(page.getByRole('button', { name: /^Jessica Jones Series/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Agents of S\.H\.I\.E\.L\.D\. Series/ })).toBeVisible()
})

test('Release by season interleaves seasons as they premiered', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Sort by' }).selectOption('release-seasons')
  await page.getByRole('radio', { name: 'TV' }).click()

  const netflix = catalog.titles.filter((t) => t.collection === 'netflix')
  const expected = catalog.seasons
    .filter((s) => netflix.some((t) => t.id === s.titleId))
    .sort((a, b) => (a.premiereDate ?? '').localeCompare(b.premiereDate ?? ''))
    .map((s) => `${netflix.find((t) => t.id === s.titleId)!.title} ${s.label}`)
  expect(expected.slice(0, 4)).toEqual(['Daredevil Season 1', 'Jessica Jones Season 1', 'Daredevil Season 2', 'Luke Cage Season 1'])

  const shown = await page.locator('section li button[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!))
  expect(shown.filter((label) => expected.includes(label))).toEqual(expected)
})

test('a season row checks off just that season', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Sort by' }).selectOption('release-seasons')
  await page.getByRole('searchbox', { name: 'Search titles' }).fill('jessica')
  const s1 = page.getByRole('checkbox', { name: 'Jessica Jones Season 1 watched' })
  await s1.click()
  await expect(s1).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('checkbox', { name: 'Jessica Jones Season 2 watched' })).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByRole('status')).toContainText('Checked off Jessica Jones Season 1')

  await page.getByRole('button', { name: 'Jessica Jones Season 2' }).click()
  await expect(sheet(page).getByRole('heading', { name: '1 of 3 seasons watched' })).toBeVisible()
})

test('other sorts keep one row per show', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Sort by' }).selectOption('release-seasons')
  await page.getByRole('combobox', { name: 'Sort by' }).selectOption('title')
  await page.getByRole('searchbox', { name: 'Search titles' }).fill('daredevil')
  await expect(page.getByRole('button', { name: /^Daredevil Series/ })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Daredevil Season 1 watched' })).toHaveCount(0)
})

test('Settings can move the Fox X-Men films into MCU, with undo', async ({ page }) => {
  const xmenInMcu = page.getByRole('button', { name: /^X-Men Movie/ })
  await expect(xmenInMcu).toHaveCount(0)

  await openSettings(page)
  const group = sheet(page).getByRole('radiogroup', { name: 'Fox X-Men' })
  await expect(group.getByRole('radio', { name: 'Other Marvel' })).toHaveAttribute('aria-checked', 'true')
  await group.getByRole('radio', { name: 'MCU' }).click()
  await expect(page.getByRole('status')).toContainText('Fox X-Men now in MCU')
  await page.keyboard.press('Escape')

  const foxCount = catalog.titles.filter((t) => t.collection === 'fox-xmen').length
  const mcuCount = catalog.titles.filter((t) => t.universe === 'mcu').length
  await expect(page.getByRole('tab', { name: `MCU 0/${mcuCount + foxCount}` })).toBeVisible()
  await expect(xmenInMcu).toBeVisible()

  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect(xmenInMcu).toHaveCount(0)
  await expect(page.getByRole('tab', { name: `MCU 0/${mcuCount}` })).toBeVisible()
})
