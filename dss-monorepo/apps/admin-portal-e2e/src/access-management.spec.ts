import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * IAM-017: an administrator creates a permission, adds it to a role in the matrix and sees it there. The
 * BFF is mocked at the network boundary (another origin), so the test drives the real portal UI and checks
 * the payloads it sends.
 */

const ADMIN = {
  id: '6acb7476-663d-4c94-b3bd-9e5ac6db7f31',
  username: 'ana.admin',
  email: 'ana.admin@uatf.edu.bo',
  firstName: 'Ana',
  lastName: 'Admin',
  isActive: true,
  academicContexts: [],
};

interface Permission {
  name: string;
  description: string;
  resource: string;
  action: string;
  system: boolean;
}

interface BffState {
  permissions: Permission[];
  grants: Record<string, string[]>;
  createdPermission?: Record<string, unknown>;
  replaced?: { role: string; permissions: string[] };
}

const ROLES = [
  { name: 'DECANO', description: 'Decano de facultad', portal: 'decano', system: true },
  { name: 'DIRECTOR', description: 'Director de carrera', portal: 'director', system: true },
  { name: 'SUPERADMIN', description: 'Administración', portal: null, system: true },
];

function permission(name: string, description: string): Permission {
  const split = name.lastIndexOf(':');
  return { name, description, resource: name.slice(0, split), action: name.slice(split + 1), system: name.startsWith('iam:') };
}

/** The portal origin the mocked BFF must allow (CORS). */
function originOf(baseURL: string | undefined): string {
  return new URL(baseURL ?? 'http://localhost:3001').origin;
}

async function answer(route: Route, origin: string, status: number, body?: unknown) {
  const cors = {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Accept, Authorization',
  };
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: cors });
    return;
  }
  await route.fulfill({
    status,
    headers: cors,
    contentType: 'application/json',
    body: body === undefined ? '' : JSON.stringify(body),
  });
}

async function mockBff(page: Page, origin: string, permissions: string[]): Promise<BffState> {
  const state: BffState = {
    permissions: [
      permission('analytics:read', 'Consultar analítica'),
      permission('iam:roles:read', 'Ver roles y permisos'),
    ],
    grants: { DECANO: ['analytics:read'], DIRECTOR: ['analytics:read'], SUPERADMIN: ['iam:roles:read'] },
  };

  await page.route('**/api/auth/refresh', (route) =>
    answer(route, origin, 200, {
      expiresAt: Date.now() + 30 * 60_000,
      absoluteExpiresAt: Date.now() + 10 * 60 * 60_000,
      idleTimeoutSeconds: 1800,
    }));
  await page.route('**/api/auth/me', (route) =>
    answer(route, origin, 200, { user: ADMIN, roles: ['SUPERADMIN'], permissions }));
  await page.route('**/api/admin/iam/permissions', async (route) => {
    if (route.request().method() === 'POST') {
      state.createdPermission = route.request().postDataJSON() as Record<string, unknown>;
      const created = permission(String(state.createdPermission.name), String(state.createdPermission.description));
      state.permissions.push(created);
      await answer(route, origin, 201, created);
      return;
    }
    await answer(route, origin, 200, state.permissions);
  });
  await page.route('**/api/admin/iam/permissions/matrix', (route) =>
    answer(route, origin, 200, { roles: ROLES, permissions: state.permissions, grants: state.grants }));
  await page.route('**/api/admin/iam/roles/*/permissions', async (route) => {
    const role = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-2) ?? '');
    const body = route.request().postDataJSON() as { permissions: string[] };
    state.replaced = { role, permissions: body.permissions };
    state.grants[role] = body.permissions;
    await answer(route, origin, 200, state.permissions.filter((item) => body.permissions.includes(item.name)));
  });

  return state;
}

test('an administrator creates a permission, adds it to a role and sees it in the matrix', async ({ page, baseURL }) => {
  const bff = await mockBff(page, originOf(baseURL), ['iam:roles:read', 'iam:roles:write']);

  await page.goto('/permissions');
  await expect(page.getByRole('heading', { name: 'Permisos', level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('table', { name: 'Permisos de analytics' })).toBeVisible();

  await page.getByRole('button', { name: 'Nuevo permiso' }).click();
  const form = page.getByRole('dialog', { name: 'Nuevo permiso' });
  await form.getByLabel(/^Nombre/).fill('reports:export');
  await form.getByLabel(/^Descripción/).fill('Exportar reportes institucionales');
  await form.getByRole('button', { name: 'Crear permiso' }).click();

  await expect(page.getByText('Permiso reports:export creado.', { exact: false })).toBeVisible();
  expect(bff.createdPermission).toEqual({ name: 'reports:export', description: 'Exportar reportes institucionales' });
  await expect(page.getByRole('table', { name: 'Permisos de reports' })).toBeVisible();

  await page.getByRole('link', { name: 'Matriz de acceso' }).click();
  await expect(page.getByRole('heading', { name: 'Matriz de acceso', level: 1 })).toBeVisible({ timeout: 30_000 });
  const cell = page.getByRole('checkbox', { name: 'DECANO · reports:export' });
  await expect(cell).not.toBeChecked();
  await cell.check();

  await page.getByRole('button', { name: 'Revisar cambios (1)' }).click();
  const review = page.getByRole('dialog', { name: 'Revisar cambios' });
  await expect(review.getByText('DECANO')).toBeVisible();
  await expect(review.getByText('reports:export')).toBeVisible();
  await review.getByRole('button', { name: 'Guardar cambios' }).click();

  await expect(page.getByText(/Se guardaron los permisos de 1 rol\./)).toBeVisible();
  expect(bff.replaced).toEqual({ role: 'DECANO', permissions: ['analytics:read', 'reports:export'] });

  // After a reload the matrix comes from the BFF again and still shows the grant.
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'DECANO · reports:export' })).toBeChecked({ timeout: 30_000 });
  await expect(page.getByRole('checkbox', { name: 'DIRECTOR · reports:export' })).not.toBeChecked();

  await page.screenshot({ path: 'test-output/access-matrix.png', fullPage: true });
});

test('a reader sees the matrix but cannot change it', async ({ page, baseURL }) => {
  await mockBff(page, originOf(baseURL), ['iam:roles:read']);

  await page.goto('/access-matrix');
  await expect(page.getByRole('checkbox', { name: 'DECANO · analytics:read' })).toBeChecked({ timeout: 30_000 });
  await expect(page.getByRole('checkbox', { name: 'DECANO · analytics:read' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Revisar cambios/ })).toHaveCount(0);
});
