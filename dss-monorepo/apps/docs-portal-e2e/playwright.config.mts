import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// Set BASE_URL to test a deployed portal instead of the local dev server.
const baseURL = process.env['BASE_URL'] || 'http://localhost:3005';

export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  // With BASE_URL (e.g. a production `next start` or the Docker image) no dev
  // server is started; dev mode compiles routes on first hit and is slower.
  webServer: process.env['BASE_URL']
    ? undefined
    : {
        command: 'bun nx run @dss-monorepo/docs-portal:dev',
        url: 'http://localhost:3005',
        reuseExistingServer: true,
        cwd: workspaceRoot,
        timeout: 180_000,
      },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
  ],
});
