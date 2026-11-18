import { test, expect } from '@playwright/test';

const landingURL =
  process.env.NEXT_PUBLIC_LANDING_URL ?? 'http://localhost:3000';

/** The landing is not part of this run; answer its login page with a stub. */
async function stubLandingLogin(page: import('@playwright/test').Page) {
  await page.route(`${landingURL}/**`, async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!DOCTYPE html><html><head><title>Landing login</title></head><body><h1>Landing login</h1></body></html>',
    }),
  );
}

/** Matches the landing login URL carrying exactly these query values. */
function isLandingLogin(params: Record<string, string>) {
  return (url: URL) =>
    `${url.origin}${url.pathname}` === `${landingURL}/login` &&
    Object.entries(params).every(
      ([key, value]) => url.searchParams.get(key) === value,
    );
}

test('sends visitors without a session to the landing login and back', async ({
  page,
  baseURL,
}) => {
  await mockUnauthenticatedSession(page, new URL(baseURL ?? '').origin);
  await stubLandingLogin(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(
    isLandingLogin({ returnTo: new URL('/', baseURL).href }),
    {
      // The redirect runs after hydration, slow on a cold dev bundle.
      timeout: 35_000,
    },
  );
});

test('forwards the portal login route and callback errors to the landing', async ({
  page,
  baseURL,
}) => {
  await mockUnauthenticatedSession(page, new URL(baseURL ?? '').origin);
  await stubLandingLogin(page);
  await page.goto('/login?error=authentication_failed&returnTo=%2Freportes', {
    waitUntil: 'domcontentloaded',
  });

  await expect(page).toHaveURL(
    isLandingLogin({
      error: 'authentication_failed',
      returnTo: new URL('/reportes', baseURL).href,
    }),
    {
      // The redirect runs after hydration, slow on a cold dev bundle.
      timeout: 35_000,
    },
  );
});

test('shows access denied to an authenticated user without the director role', async ({
  page,
}) => {
  await mockSession(page, 'http://localhost:3003', ['SUPERADMIN']);
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Acceso no autorizado' }),
  ).toBeVisible();
  await expect(page.getByText('portal Dirección de carrera')).toBeVisible();
  await expect(page.getByText('Director Dashboard')).toHaveCount(0);
});

test('integrates OLAP into the portal sidebar', async ({ page }) => {
  await mockSession(page, 'http://localhost:3003', ['DIRECTOR']);
  await page.goto('/');
  await page.getByRole('link', { name: 'Espacio de análisis OLAP' }).click();
  await expect(page).toHaveURL(/\/analisis-olap$/);
  await expect(
    page.getByRole('heading', { name: 'Consulta OLAP' }),
  ).toBeVisible();
  const explorer = page.getByRole('complementary', {
    name: 'Explorador de cubos',
  });
  await expect(explorer.getByLabel('Cubo')).toBeVisible();
  await expect(
    page
      .getByRole('main')
      .getByRole('complementary', { name: 'Explorador de cubos' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Exploración OLAP' }).click();
  await expect(explorer).toBeHidden();
  await page.getByRole('button', { name: 'Explorar cubos' }).click();
  await expect(explorer).toBeVisible();
});

test('opens the OLAP explorer on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSession(page, 'http://localhost:3003', ['DIRECTOR']);
  await page.goto('/analisis-olap');
  await page.getByRole('button', { name: 'Explorar cubos' }).click();
  await expect(
    page
      .getByRole('complementary', { name: 'Explorador de cubos' })
      .getByLabel('Cubo'),
  ).toBeVisible();
});

test('rejects another role on the OLAP route', async ({ page }) => {
  await mockSession(page, 'http://localhost:3003', ['SUPERADMIN']);
  await page.goto('/analisis-olap');
  await expect(
    page.getByRole('heading', { name: 'Acceso no autorizado' }),
  ).toBeVisible({ timeout: 20_000 });
});

async function mockSession(
  page: import('@playwright/test').Page,
  origin: string,
  roles: string[],
) {
  await page.unroute('**/api/auth/**').catch(() => undefined);
  // The idle-session heartbeat refreshes the BFF session on page load; without
  // this mock the real BFF answers 401 and the portal logs the user out.
  await page.route('**/api/auth/refresh', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': origin,
          'access-control-allow-credentials': 'true',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'Content-Type, Accept, Authorization',
        },
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': origin,
        'access-control-allow-credentials': 'true',
      },
      body: JSON.stringify({
        expiresAt: Date.now() + 30 * 60_000,
        absoluteExpiresAt: Date.now() + 10 * 60 * 60_000,
        idleTimeoutSeconds: 1800,
      }),
    });
  });
  await page.route('**/api/auth/me', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': origin,
          'access-control-allow-credentials': 'true',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'Content-Type, Accept, Authorization',
        },
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': origin,
        'access-control-allow-credentials': 'true',
      },
      body: JSON.stringify({
        user: {
          id: '6acb7476-663d-4c94-b3bd-9e5ac6db7f31',
          username: 'superadmin',
          email: 'admin@uatf.edu.bo',
          firstName: 'Administradora',
          lastName: 'DSS',
          isActive: true,
          academicContexts: [],
        },
        roles,
        permissions: [],
      }),
    });
  });
}

/**
 * The BFF answers 401. CORS headers make every browser read the response;
 * without a mock, Firefox keeps the request to the absent BFF pending.
 */
async function mockUnauthenticatedSession(
  page: import('@playwright/test').Page,
  origin: string,
) {
  await page.unroute('**/api/auth/**').catch(() => undefined);
  await page.route('**/api/auth/**', async (route) => {
    try {
      const requestOrigin = route.request().headerValue('origin') || origin;
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'access-control-allow-origin': requestOrigin,
            'access-control-allow-credentials': 'true',
            'access-control-allow-methods': 'GET, POST, OPTIONS',
            'access-control-allow-headers': 'Content-Type, Accept, Authorization',
          },
        }).catch(() => undefined);
        return;
      }
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        headers: {
          'access-control-allow-origin': requestOrigin,
          'access-control-allow-credentials': 'true',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'Content-Type, Accept, Authorization',
          vary: 'Origin',
        },
        body: JSON.stringify({ error: 'unauthorized' }),
      }).catch(() => undefined);
    } catch {
      // Ignore errors when fulfilling an already aborted request in Firefox
    }
  });
}
