import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * IAM-016: an administrator creates a user and assigns a role from the admin portal. The BFF is mocked at
 * the network boundary (it lives on another origin), so the test exercises the real portal UI, its
 * BFF requests and their payloads.
 */

const NEW_USER_ID = '7d3c1b2a-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const ADMIN = {
  id: '6acb7476-663d-4c94-b3bd-9e5ac6db7f31',
  username: 'ana.admin',
  email: 'ana.admin@uatf.edu.bo',
  firstName: 'Ana',
  lastName: 'Admin',
  isActive: true,
  academicContexts: [],
};

/** The portal origin the mocked BFF must allow (CORS). */
function originOf(baseURL: string | undefined): string {
  return new URL(baseURL ?? 'http://localhost:3001').origin;
}

interface BffState {
  users: Array<Record<string, unknown>>;
  directRoles: string[];
  created?: Record<string, unknown>;
  replacedRoles?: string[];
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
  const state: BffState = { users: [], directRoles: [] };

  await page.route('**/api/auth/refresh', (route) =>
    answer(route, origin, 200, {
      expiresAt: Date.now() + 30 * 60_000,
      absoluteExpiresAt: Date.now() + 10 * 60 * 60_000,
      idleTimeoutSeconds: 1800,
    }));
  await page.route('**/api/auth/me', (route) =>
    answer(route, origin, 200, { user: ADMIN, roles: ['SUPERADMIN'], permissions }));
  await page.route('**/api/admin/academic-catalog', (route) =>
    answer(route, origin, 200, { faculties: [], careers: [] }));
  await page.route('**/api/admin/users?*', (route) =>
    answer(route, origin, 200, {
      content: state.users,
      page: 0,
      size: 20,
      totalElements: state.users.length,
      totalPages: state.users.length ? 1 : 0,
    }));
  await page.route('**/api/admin/iam/roles', (route) =>
    answer(route, origin, 200, [
      { name: 'DECANO', description: 'Decano de facultad', portal: 'decano', system: true },
      { name: 'DIRECTOR', description: 'Director de carrera', portal: 'director', system: true },
      { name: 'RECTOR', description: 'Rector', portal: 'rector', system: true },
    ]));
  await page.route('**/api/admin/iam/users', async (route) => {
    if (route.request().method() === 'POST') {
      state.created = route.request().postDataJSON() as Record<string, unknown>;
      state.users.push({
        id: NEW_USER_ID,
        username: state.created.username,
        email: state.created.email,
        firstName: state.created.firstName ?? null,
        lastName: state.created.lastName ?? null,
        isActive: true,
        roles: [],
        academicScope: 'NONE',
        academicContexts: [],
      });
      await answer(route, origin, 201, {
        id: NEW_USER_ID,
        username: state.created.username,
        email: state.created.email,
        firstName: state.created.firstName ?? null,
        lastName: state.created.lastName ?? null,
        enabled: true,
        emailVerified: false,
        createdAt: new Date().toISOString(),
        invitationSent: true,
      });
      return;
    }
    await answer(route, origin, 204);
  });
  await page.route(`**/api/admin/iam/users/${NEW_USER_ID}/roles`, async (route) => {
    if (route.request().method() === 'PUT') {
      state.replacedRoles = (route.request().postDataJSON() as { roles: string[] }).roles;
      state.directRoles = state.replacedRoles;
    }
    const roles = state.directRoles.map((name) => ({ name, description: null }));
    await answer(route, origin, 200, { direct: roles, effective: roles });
  });

  return state;
}

test('an administrator creates a user and assigns a role', async ({ page, baseURL }) => {
  const origin = originOf(baseURL);
  const bff = await mockBff(page, origin, ['iam:users:read', 'iam:users:write']);

  await page.goto('/users');
  await expect(page.getByRole('heading', { name: 'Usuarios', level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('No hay usuarios que coincidan con estos filtros.')).toBeVisible();

  await page.getByRole('button', { name: 'Nuevo usuario' }).click();
  const form = page.getByRole('dialog', { name: 'Nuevo usuario' });
  await form.getByLabel(/^Usuario/).fill('nuevo.docente');
  await form.getByLabel(/^Correo electrónico/).fill('nuevo.docente@uatf.edu.bo');
  await form.getByLabel('Nombres').fill('Nuevo');
  await form.getByLabel('Apellidos').fill('Docente');
  await form.getByRole('button', { name: 'Crear usuario' }).click();

  await expect(page.getByText('Usuario @nuevo.docente creado. Se le envió la invitación por correo.')).toBeVisible();
  expect(bff.created).toEqual({
    username: 'nuevo.docente',
    email: 'nuevo.docente@uatf.edu.bo',
    firstName: 'Nuevo',
    lastName: 'Docente',
    sendInvitation: true,
  });

  // The management panel opens on the new user's roles; it is titled with the person's name.
  const panel = page.getByRole('dialog', { name: 'Nuevo Docente' });
  await expect(panel.getByText('nuevo.docente@uatf.edu.bo', { exact: false })).toBeVisible();
  const director = panel.getByRole('checkbox', { name: 'DIRECTOR' });
  await expect(director).not.toBeChecked();
  await director.click();
  await panel.getByRole('button', { name: 'Guardar roles' }).click();

  await expect(panel.getByText(/Roles actualizados/)).toBeVisible();
  expect(bff.replacedRoles).toEqual(['DIRECTOR']);
  await expect(director).toBeChecked();
  await expect(panel.getByRole('region', { name: 'Roles efectivos' }).getByText('DIRECTOR')).toBeVisible();

  await page.screenshot({ path: 'test-output/user-management.png', fullPage: true });
});

test('a reader sees users but no write actions', async ({ page, baseURL }) => {
  const origin = originOf(baseURL);
  const bff = await mockBff(page, origin, ['iam:users:read']);
  bff.users.push({
    id: NEW_USER_ID,
    username: 'ana.directora',
    email: 'ana@uatf.edu.bo',
    firstName: 'Ana',
    lastName: 'García',
    isActive: true,
    roles: ['DIRECTOR'],
    academicScope: 'CAREER',
    academicContexts: [],
  });

  await page.goto('/users');
  await expect(page.getByText('Ana García')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Nuevo usuario' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Gestionar a ana.directora' }).click();
  await expect(page.getByText(/Vista de solo lectura/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Desactivar usuario' })).toHaveCount(0);
});
