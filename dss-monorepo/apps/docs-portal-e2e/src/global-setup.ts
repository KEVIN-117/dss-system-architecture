import { chromium, type FullConfig } from '@playwright/test';

/**
 * Routes the specs open. Under `next dev` each route compiles on its first browser request
 * (both Server Components and Client Components). When multiple workers hit cold routes
 * concurrently, compilation times out. Pre-navigating them once in a browser during
 * globalSetup compiles all assets sequentially before the test workers start.
 */
const ROUTES = [
  '/',
  '/docs/guia-decanato',
  '/docs/guia-portal-administracion',
  '/reference',
  '/reference/bff-contracts-bff-v1',
];

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL || 'http://localhost:3005';

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
