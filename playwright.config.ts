import { defineConfig, devices } from '@playwright/test'

/** End-to-end tests against the production build, as a desktop browser and as an iPhone (WebKit = Safari's engine). */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/watchlist-tracker/',
    // The offline test opts back in; elsewhere a cached app shell would hide fresh builds.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/watchlist-tracker/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
