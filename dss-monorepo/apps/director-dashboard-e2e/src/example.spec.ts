import { test, expect } from '@playwright/test';

test('requires a session before rendering the dashboard', async ({ page }) => {
  await mockUnauthenticatedSession(page);
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Sesión requerida' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login');
});

test('exposes the BFF login entry point', async ({ page }) => {
  await mockUnauthenticatedSession(page);
  await page.goto('/login');

  await expect(page.getByText('Sistema de Soporte a la Decisión')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
});

test('shows access denied to an authenticated user without the director role', async ({ page }) => {
  await mockSession(page, 'http://localhost:3003', ['SUPERADMIN']);
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Acceso no autorizado' })).toBeVisible();
  await expect(page.getByText('portal Dirección de carrera')).toBeVisible();
  await expect(page.getByText('Director Dashboard')).toHaveCount(0);
});

async function mockSession(page: import('@playwright/test').Page, origin: string, roles: string[]) {
  await page.route('http://localhost:3006/api/auth/me', (route) => route.fulfill({
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
  }));
}

async function mockUnauthenticatedSession(page: import('@playwright/test').Page) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'unauthorized' }),
    }),
  );
}
