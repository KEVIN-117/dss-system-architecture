import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';
import { loadE2EEnv, resolveBaseURL } from '../../tools/load-e2e-env.mjs';

// For CI, you may want to set BASE_URL to the deployed application.
const bffEnv = loadE2EEnv(import.meta.dirname, 'bff');
const portalEnv = loadE2EEnv(import.meta.dirname, 'rector-dashboard');
const env = { ...bffEnv, ...portalEnv };
const configuredPort = Number(env['RECTOR_DASHBOARD_PORT_E2E']);
const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 3004;
process.env['RECTOR_DASHBOARD_PORT'] ??= String(port);
process.env.PORT = String(port);
const baseURL = resolveBaseURL(
  env['RECTOR_DASHBOARD_BASE_URL'] ?? env['RECTOR_DASHBOARD_URL'],
  port,
);

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
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Keep authentication artifacts disabled in the credentialed PRED-007 run. */
    trace: process.env['PREDICTION_E2E_FORCE_SERVER'] === '1' ? 'off' : 'on-first-retry',
    screenshot: process.env['PREDICTION_E2E_FORCE_SERVER'] === '1' ? 'off' : 'only-on-failure',
    video: 'off',
  },
  workers: process.env['PREDICTION_E2E_FORCE_SERVER'] === '1' ? 1 : undefined,
  /* Run your local dev server before starting the tests */
  webServer: [
    {
      name: 'BFF',
      command: 'bun nx run @dss-monorepo/bff:dev',
      url: `${env['BFF_BASE_URL'] ?? 'http://localhost:3006'}/api/auth/me`,
      timeout: 180_000,
      stdout: 'pipe',
      reuseExistingServer: !process.env.CI && process.env['PREDICTION_E2E_FORCE_SERVER'] !== '1',
      cwd: workspaceRoot,
    },
    {
      name: 'Rector Dashboard',
      command: 'bun nx run @dss-monorepo/rector-dashboard:dev',
      url: baseURL,
      timeout: 180_000,
      stdout: 'pipe',
      reuseExistingServer: !process.env.CI && process.env['PREDICTION_E2E_FORCE_SERVER'] !== '1',
      cwd: workspaceRoot,
    },
  ],
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
  ],
});
