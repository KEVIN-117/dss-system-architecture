import { chromium, type FullConfig } from '@playwright/test';

/**
 * Routes the specs open. Under `next dev` each route compiles on its first browser request.
 * Concurrently requesting cold routes across multiple workers causes compilation timeouts.
 * Pre-navigating them once in globalSetup compiles the bundles before parallel workers run.
 */
const ROUTES = ['/', '/analisis-olap', '/login'];

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL || 'http://localhost:3004';

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const route of ROUTES) {
      try {
        await page.goto(new URL(route, baseURL).toString(), {
          waitUntil: 'domcontentloaded',
          timeout: 120_000,
        });
      } catch {
        // Warm-up is best effort
      }
    }
  } finally {
    await browser.close();
  }
}
