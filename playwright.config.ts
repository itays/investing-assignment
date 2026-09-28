import { env } from "node:process"
import { defineConfig, devices } from "@playwright/test"

// Browser tests get their own port and database, so they never reuse the
// developer's dev server on port 3000 or touch data/alerts.db. They run against
// a production build: the dev server's on-demand module loading made WebKit
// and Firefox flaky on a cold start.
const port = 3100
const baseURL = `http://127.0.0.1:${port}`
const isCI = Boolean(env.CI)

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "ci-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `bunx vite build && bunx vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    env: { DATABASE_PATH: "data/e2e-alerts.db" },
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
})
