import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';
import { resolve } from 'node:path';
import { loadE2EEnv, resolveBaseURL } from '../../tools/load-e2e-env.mjs';

// For CI, you may want to set BASE_URL to the deployed application.
const env = loadE2EEnv(import.meta.dirname, 'admin-portal');
const configuredPort = Number(env['ADMIN_PORTAL_PORT_E2E']);
const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 3001;
process.env['ADMIN_PORTAL_PORT'] ??= String(port);
process.env.PORT = String(port);
// Unauthenticated visits redirect to the landing login; tests assert that hop.
process.env['NEXT_PUBLIC_LANDING_URL'] ??= env['NEXT_PUBLIC_LANDING_URL'] ?? 'http://localhost:3000';
const baseURL = resolveBaseURL(env['ADMIN_PORTAL_BASE_URL'], port);

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import 'dotenv/config';

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * Generated as a .mts file so Node forces ESM regardless of workspace
 * `type`. Playwright routes `.mts` through its ESM loader (dynamic import,
 * bypassing the pirates CJS-compile path), and Nx's native TS strip loads
 * `.mts` directly. Playwright's configLoader auto-discovers
 * `playwright.config.mts` via its extension list
 * (.ts/.js/.mts/.mjs/.cts/.cjs).
 */
export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  timeout: 90_000,
  // Pre-compiles the portal routes under `next dev` before the parallel workers start.
  globalSetup: './src/global-setup.ts',
  // Locally the preset runs fully parallel with no retries; 8 workers across three browsers
  // against a single `next dev` starved hydration and the landing redirect timed out. CI keeps
  // the preset (1 worker, 2 retries).
  ...(process.env.CI ? {} : { workers: 4 }),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /* Run your local dev server before starting the tests */
  // Start `next dev` directly (as rector-dashboard-e2e does) instead of a nested
  // `nx run …:dev`: the inferred Nx dev + wait-for-webserver dependencies hung
  // without ever starting Playwright. The e2e target now only depends on
  // `^build` (package.json), so the libraries are built before this runs.
  webServer: {
    command: `bun run next dev --webpack --port ${port}`,
    url: baseURL,
    timeout: 180_000,
    stdout: 'pipe',
    reuseExistingServer: !process.env.CI,
    cwd: resolve(workspaceRoot, 'apps/admin-portal'),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Uncomment for mobile browsers support
    /* {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    }, */

    // Uncomment for branded browsers
    /* {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    } */
  ].filter(
    // CI runs Chromium only to keep the pipeline fast; all browsers run locally.
    (project) => !process.env.CI || project.name === 'chromium',
  ),
});
