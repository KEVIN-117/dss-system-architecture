import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';
import { resolve } from 'node:path';

// Set BASE_URL to test a deployed portal instead of the local dev server.
const baseURL = process.env['BASE_URL'] || 'http://localhost:3005';

export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  timeout: 90_000,
  globalSetup: './src/global-setup.ts',
  ...(process.env.CI ? {} : { workers: 2 }),
  expect: {
    timeout: 30_000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  // With BASE_URL (e.g. a production `next start` or the Docker image) no dev
  // server is started; dev mode compiles routes on first hit and is slower.
  //
  // reuseExistingServer must be false in CI. When it is true, @nx/playwright
  // turns this webServer into a continuous `docs-portal:dev` task in the Nx
  // graph. In `nx affected`, the Next.js `build` and the other `e2e` targets
  // have `parallelism: false`, and Nx only starts those once no other task is
  // running. If that `dev` process does not exit after the e2e run, the
  // pipeline waits forever.
  webServer: process.env['BASE_URL']
    ? undefined
    : {
        command: 'bun run next dev --webpack --port 3005',
        url: 'http://localhost:3005',
        reuseExistingServer: !process.env['CI'],
        cwd: resolve(workspaceRoot, 'apps/docs-portal'),
        timeout: 180_000,
        stdout: 'pipe',
      },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
  ],
});
