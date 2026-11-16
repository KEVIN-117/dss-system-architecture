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

/** Asserts the hop to the landing login and the query it carries. */
async function expectLandingLogin(
  page: import('@playwright/test').Page,
  params: Record<string, string>,
) {
  await expect(page).toHaveURL(
    (url) =>
      `${url.origin}${url.pathname}` === `${landingURL}/login` &&
      Object.entries(params).every(
        ([key, value]) => url.searchParams.get(key) === value,
      ),
  );
}

test('sends visitors without a session to the landing login and back', async ({
  page,
  baseURL,
}) => {
  await mockUnauthenticatedSession(page);
  await stubLandingLogin(page);
  await page.goto('/');

  await expectLandingLogin(page, { returnTo: new URL('/', baseURL).href });
});

test('forwards the portal login route and callback errors to the landing', async ({
  page,
  baseURL,
}) => {
  await mockUnauthenticatedSession(page);
  await stubLandingLogin(page);
  await page.goto('/login?error=authentication_failed&returnTo=%2Freportes');

  await expectLandingLogin(page, {
    error: 'authentication_failed',
    returnTo: new URL('/reportes', baseURL).href,
  });
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
  await mockSession(page, 'http://localhost:3003', ['DECANO']);
  await page.goto('/analisis-olap');
  await expect(
    page.getByRole('heading', { name: 'Acceso no autorizado' }),
  ).toBeVisible();
});

async function mockSession(
  page: import('@playwright/test').Page,
  origin: string,
  roles: string[],
) {
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
    }),
  );
}

async function mockUnauthenticatedSession(
  page: import('@playwright/test').Page,
) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'unauthorized' }),
    }),
  );
}
