import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';
import { resolve } from 'node:path';
import { loadE2EEnv, resolveBaseURL } from '../../tools/load-e2e-env.mjs';

const env = loadE2EEnv(import.meta.dirname, 'olap-workspace');
const configuredPort = Number(env['OLAP_WORKSPACE_PORT_E2E']);
// The app's normal dev port is reserved for a developer's existing session.
// Keep E2E isolated even when a copied local env file still says 3007.
const port =
  Number.isInteger(configuredPort) &&
  configuredPort > 0 &&
  configuredPort !== 3007
    ? configuredPort
    : 3017;
process.env.PORT = String(port);
process.env['NEXT_PUBLIC_BFF_URL'] ??=
  env['NEXT_PUBLIC_BFF_URL'] ?? 'http://localhost:3006';
const baseURL = resolveBaseURL(env['OLAP_WORKSPACE_BASE_URL'], port);

export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  use: { baseURL, trace: 'on-first-retry' },
  webServer: {
    command: `node ../../node_modules/next/dist/bin/next dev --webpack --port ${port}`,
    url: baseURL,
    // Always start an isolated server: reusing any process on the URL can
    // silently test a different app or a stale Next.js build.
    reuseExistingServer: false,
    cwd: resolve(workspaceRoot, 'apps/olap-workspace'),
    env: {
      NEXT_DIST_DIR: '.next-e2e-olap-workspace',
      NEXT_PUBLIC_BFF_URL: process.env['NEXT_PUBLIC_BFF_URL'],
      PORT: String(port),
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
