import { expect, test } from '@playwright/test'
import { box, importBackup, openList, openSettings, sheet } from './helpers.ts'

test.beforeEach(async ({ page }) => {
  await openList(page)
})

test('check off a movie, undo, and keep it after reload', async ({ page }) => {
  await box(page, 'Iron Man').click()
  await expect(box(page, 'Iron Man')).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect(box(page, 'Iron Man')).toHaveAttribute('aria-checked', 'false')

  await box(page, 'Thor').click()
  await page.reload()
  await expect(box(page, 'Thor')).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('tab', { name: /MCU 1\/\d+/ })).toBeVisible()
})

test('change a watch date to just a month', async ({ page }) => {
  await page.getByRole('button', { name: /^Iron Man Movie/ }).click()
  await sheet(page).getByRole('button', { name: 'Watched it today' }).click()
  await sheet(page).getByRole('button', { name: 'More for Iron Man' }).click()
  await page.getByRole('menuitem', { name: 'Watch history (1)' }).click()
  await sheet(page).getByRole('button', { name: 'Edit first watch' }).click()
  await sheet(page).getByRole('radio', { name: 'Month' }).click()
  await sheet(page).getByLabel('Watched on month').selectOption('03')
  const year = sheet(page).getByLabel('Watched on year')
  await year.fill('2019')
  await year.press('Enter')
  await sheet(page).getByRole('button', { name: 'Save' }).click()
  await expect(sheet(page).getByText('Mar 2019')).toBeVisible()
  await sheet(page).getByRole('button', { name: 'Back' }).click()
  await expect(sheet(page).getByRole('heading', { name: 'Last watched Mar 2019' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /^Iron Man Movie/ })).toContainText('Mar 2019')
})

test('track a season from start to finish', async ({ page }) => {
  await page.getByRole('radio', { name: 'TV' }).click()
  await page.getByRole('button', { name: /^WandaVision: 0 of 1 seasons/ }).click()
  await sheet(page).getByRole('button', { name: 'Start watching' }).click()
  for (let i = 0; i < 9; i++) await sheet(page).getByRole('button', { name: 'One more episode' }).click()
  await expect(sheet(page).getByText('That was the last episode.')).toBeVisible()
  await expect(sheet(page).getByRole('button', { name: 'One more episode' })).toBeDisabled()
  await sheet(page).getByRole('button', { name: 'Finish season today' }).click()
  await expect(sheet(page).getByText('All caught up')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /^WandaVision: 1 of 1 seasons/ })).toBeVisible()
})

test('filter, sort and search', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Sort by' }).selectOption('story')
  await expect(page.getByRole('heading', { name: 'In story order' })).toBeVisible()
  // Eyes of Wakanda spans history from ancient times, so it leads the timeline.
  await expect(page.locator('section li').first()).toContainText('Eyes of Wakanda')
  await page.getByRole('tab', { name: /Other Marvel/ }).click()
  // Story order is MCU-only, so it falls back to release order.
  await expect(page.getByRole('combobox', { name: 'Sort by' })).toHaveValue('release')
  await page.getByRole('searchbox', { name: 'Search titles' }).fill('shield')
  await expect(page.getByText('Agents of S.H.I.E.L.D.')).toBeVisible()
  await expect(page.getByText('Venom', { exact: true })).toHaveCount(0)
})

test('import a backup file', async ({ page }) => {
  await importBackup(page, 'backup.json')
  await expect(box(page, 'Captain America: Brave New World')).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('searchbox', { name: 'Search titles' }).fill('born again')
  await expect(page.getByRole('button', { name: /^Daredevil: Born Again Series/ })).toContainText('New: S2')
})

test('syncs to a private GitHub repo (simulated)', async ({ page, context }) => {
  let file: { sha: string; content: string } | null = null
  let version = 0
  const auth: string[] = []
  await context.route('https://api.github.com/**', async (route) => {
    const req = route.request()
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    auth.push(req.headers()['authorization'] ?? '')
    const json = (status: number, body: unknown) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) })
    const path = new URL(req.url()).pathname
    if (path === '/repos/me/watchlist-data') return json(200, { private: true })
    if (req.method() === 'GET') return file ? json(200, { sha: file.sha, encoding: 'base64', content: file.content }) : json(404, {})
    const body = JSON.parse(req.postData() ?? '{}')
    if ((file?.sha ?? undefined) !== body.sha) return json(409, {})
    file = { sha: `v${++version}`, content: body.content }
    return json(200, { content: { sha: file.sha } })
  })

  await openSettings(page)
  await sheet(page).getByLabel('GitHub username').fill('me')
  await sheet(page).getByLabel('Access key').fill('github_pat_example')
  await sheet(page).getByRole('button', { name: 'Connect' }).click()
  await expect(sheet(page).getByText('Last synced just now.')).toBeVisible()
  await page.keyboard.press('Escape')

  await box(page, 'Black Panther').click()
  await expect(page.getByRole('button', { name: 'Synced. Sync now' })).toBeVisible({ timeout: 10_000 })
  await expect.poll(() => file && JSON.parse(Buffer.from(file.content, 'base64').toString()).watches.map((w: { titleId: string }) => w.titleId)).toEqual([
    'black-panther-2018',
  ])
  expect(new Set(auth)).toEqual(new Set(['Bearer github_pat_example']))
})

test.describe('offline', () => {
  test.use({ serviceWorkers: 'allow' })
  test('opens with no connection once installed', async ({ page, context }) => {
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await box(page, 'Iron Man').click()
    await context.setOffline(true)
    await page.reload()
    await expect(box(page, 'Iron Man')).toHaveAttribute('aria-checked', 'true')
    await context.setOffline(false)
  })
})

test('fits the screen without sideways scrolling', async ({ page }) => {
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `at ${width}px`).toBeLessThanOrEqual(0)
  }
})
