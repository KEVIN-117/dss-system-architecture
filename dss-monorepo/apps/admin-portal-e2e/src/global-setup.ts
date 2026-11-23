import type { FullConfig } from '@playwright/test';

/**
 * Routes the specs open. Under `next dev` each one compiles on its first request; when
 * several browsers hit a cold route in parallel the compile can outlast the test timeout
 * (seen as Firefox stuck on "Verificando sesión…" or never redirecting). Requesting them
 * once, sequentially, before the workers start keeps compilation out of the tests.
 */
const ROUTES = ['/', '/login', '/users', '/permissions', '/access-matrix', '/audit', '/clients'];

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) return;

  for (const route of ROUTES) {
    try {
      // `manual`: unauthenticated visits redirect to the landing, which is not running.
      await fetch(new URL(route, baseURL), {
        redirect: 'manual',
        signal: AbortSignal.timeout(180_000),
      });
    } catch {
      // Warm-up is best effort; a failing route still surfaces in its own spec.
    }
  }
}
