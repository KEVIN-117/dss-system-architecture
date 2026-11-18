import { test, expect } from '@playwright/test';

const landingURL =
  process.env.NEXT_PUBLIC_LANDING_URL ?? 'http://localhost:3000';

/** The landing is not part of this run; answer its login page with a stub. */
async function stubLandingLogin(page: import('@playwright/test').Page) {
  await page.route(`${landingURL}/**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<h1>Landing login</h1>',
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
  // The page redirects right away; waiting for its load event stalls Firefox.
  await page.goto('/', { waitUntil: 'commit' });

  await expect(page).toHaveURL(
    isLandingLogin({ returnTo: new URL('/', baseURL).href }),
    {
      // The redirect runs after hydration, slow on a cold dev bundle.
      timeout: 20_000,
    },
  );
});

test('forwards the portal login route and callback errors to the landing', async ({
  page,
  baseURL,
}) => {
  await mockUnauthenticatedSession(page, new URL(baseURL ?? '').origin);
  await stubLandingLogin(page);
  // The page redirects right away; waiting for its load event stalls Firefox.
  await page.goto('/login?error=authentication_failed&returnTo=%2Freportes', {
    waitUntil: 'commit',
  });

  await expect(page).toHaveURL(
    isLandingLogin({
      error: 'authentication_failed',
      returnTo: new URL('/reportes', baseURL).href,
    }),
    {
      // The redirect runs after hydration, slow on a cold dev bundle.
      timeout: 20_000,
    },
  );
});

test('shows access denied to an authenticated user without the administration role', async ({
  page,
}) => {
  await mockSession(page, 'http://localhost:3001', ['DIRECTOR']);
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Acceso no autorizado' }),
  ).toBeVisible();
  await expect(page.getByText('portal de administración')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Cerrar sesión y cambiar de cuenta' }),
  ).toHaveAttribute('href', 'http://localhost:3006/api/auth/logout');
  await expect(page.getByText('MAINFRAME STATUS')).toHaveCount(0);
});

async function mockSession(
  page: import('@playwright/test').Page,
  origin: string,
  roles: string[],
) {
  // The idle-session heartbeat refreshes the BFF session on page load; without
  // this mock the real BFF answers 401 and the portal logs the user out.
  await page.route(/\/api\/auth\/refresh$/, (route) =>
    route.fulfill({
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
    }),
  );
  await page.route('http://localhost:3006/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': origin,
        'access-control-allow-credentials': 'true',
      },
      body: JSON.stringify({
        user: {
          id: '6acb7476-663d-4c94-b3bd-9e5ac6db7f31',
          username: 'director',
          email: 'director@uatf.edu.bo',
          firstName: 'Directora',
          lastName: 'DSS',
          isActive: true,
          academicContexts: [],
        },
        roles,
        permissions: [],
      }),
    }),
  );
}

/**
 * The BFF answers 401. CORS headers make every browser read the response;
 * without a mock, Firefox keeps the request to the absent BFF pending.
 */
async function mockUnauthenticatedSession(
  page: import('@playwright/test').Page,
  origin: string,
) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': origin,
        'access-control-allow-credentials': 'true',
      },
      body: JSON.stringify({ error: 'unauthorized' }),
    }),
  );
}
