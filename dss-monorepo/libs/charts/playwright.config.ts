import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  outputDir: './test-output/playwright',
  // Keep CI browser work below the hosted runner's memory/CPU limit. Nx can
  // execute several affected E2E projects at once, so each project uses one
  // browser worker in CI.
  fullyParallel: process.env.CI !== 'true',
  workers: process.env.CI === 'true' ? 1 : 2,
  reporter: [['list'], ['html', { outputFolder: './test-output/playwright-report', open: 'never' }]],
  // Storybook's Vite preview protects development builds served by a host
  // other than localhost. Keep the browser URL aligned with the dev server.
  use: { baseURL: 'http://localhost:6011', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node ../../node_modules/storybook/dist/bin/dispatcher.js dev --ci --no-open --port 6011 --host localhost',
    url: 'http://localhost:6011',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
