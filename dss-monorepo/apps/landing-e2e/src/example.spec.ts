import { expect, test, type Page } from '@playwright/test';

test('renders the public landing page', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: /la plataforma inteligente para datos académicos/i,
    }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /ingresar/i })).toHaveAttribute(
    'href',
    '/login',
  );
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dsa');
});

test('presents the SSO login entry point without collecting credentials', async ({
  page,
}) => {
  await page.goto('/login');

  await expect(
    page.getByText('Dirección de Servicios Académicos', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /iniciar sesión/i }),
  ).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});

test('shows access denied when the session has no DSS role', async ({
  page,
}) => {
  await mockBffSession(page, {
    user: {
      id: '123e4567-e89b-42d3-a456-426614174000',
      username: 'without-role',
      email: 'without-role@example.edu',
      firstName: 'Without',
      lastName: 'Role',
      isActive: true,
      academicContexts: [],
    },
    roles: [],
    permissions: [],
  });

  await page.goto('/auth/callback');

  await expect(
    page.getByRole('alert').filter({ hasText: 'Acceso no autorizado' }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /cerrar sesión/i }),
  ).toHaveAttribute('href', /\/api\/auth\/logout$/);
});

test('returns to login when the BFF has no authenticated session', async ({
  page,
}) => {
  const bffUrl = getBffUrl();
  await page.route(`${bffUrl}/api/auth/me`, (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'unauthorized' }),
    }),
  );

  await page.goto('/auth/callback');

  await expect(
    page.getByRole('heading', {
      name: /no se pudo completar el inicio de sesión/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /volver al inicio de sesión/i }),
  ).toHaveAttribute('href', '/login');
});

async function mockBffSession(page: Page, body: Record<string, unknown>) {
  const bffUrl = getBffUrl();
  await page.route(`${bffUrl}/api/auth/me`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    }),
  );
}

function getBffUrl() {
  return (process.env.NEXT_PUBLIC_BFF_URL ?? 'http://localhost:3006').replace(
    /\/$/,
    '',
  );
}
