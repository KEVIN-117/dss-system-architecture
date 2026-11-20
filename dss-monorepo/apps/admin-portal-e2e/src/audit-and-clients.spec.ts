import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * IAM-018: the audit list (filters, paging, before/after detail) and registering an application whose
 * secret is shown once. The BFF is mocked at the network boundary (another origin), so the tests drive
 * the real portal UI and check the queries and payloads it sends.
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

/** 25 entries: the newest is a role update, the rest alternate targets so filters have something to cut. */
function auditEntries() {
  return Array.from({ length: 25 }, (_, index) => ({
    id: `0b6f8c1e-1a2b-4c3d-8e9f-${String(index).padStart(12, '0')}`,
    occurredAt: new Date(Date.UTC(2026, 10, 20, 14, 30 - index)).toISOString(),
    actor: { keycloakId: 'kc-1', username: 'ana.admin', ipAddress: '10.0.0.5' },
    action: index === 0 ? 'ROLE_UPDATED' : index % 2 ? 'CLIENT_UPDATED' : 'USER_ROLES_REPLACED',
    targetType: index === 0 ? 'ROLE' : index % 2 ? 'CLIENT' : 'USER',
    targetId: index === 0 ? 'AUDITOR' : index % 2 ? `app-${index}` : `user-${index}`,
    before: index === 0 ? { description: 'Auditor', portal: null } : null,
    after: index === 0 ? { description: 'Auditor externo', portal: null } : { secret: '[REDACTED]' },
    outcome: index === 3 ? 'FAILURE' : 'SUCCESS',
    failureReason: index === 3 ? 'Keycloak no respondió' : null,
    completedAt: null,
  }));
}

interface BffState {
  auditQueries: URLSearchParams[];
  createdClient?: Record<string, unknown>;
}

async function mockBff(page: Page, origin: string, permissions: string[]): Promise<BffState> {
  const state: BffState = { auditQueries: [] };
  const entries = auditEntries();
  const clients: Array<Record<string, unknown>> = [
    { clientId: 'dss-bff', name: 'BFF', description: null, type: 'CONFIDENTIAL', enabled: true, system: true, redirectUris: [] },
  ];

  await page.route('**/api/auth/refresh', (route) =>
    answer(route, origin, 200, {
      expiresAt: Date.now() + 30 * 60_000,
      absoluteExpiresAt: Date.now() + 10 * 60 * 60_000,
      idleTimeoutSeconds: 1800,
    }));
  await page.route('**/api/auth/me', (route) =>
    answer(route, origin, 200, { user: ADMIN, roles: ['SUPERADMIN'], permissions }));
  await page.route('**/api/admin/iam/audit?*', async (route) => {
    const query = new URL(route.request().url()).searchParams;
    state.auditQueries.push(query);
    const type = query.get('targetType');
    const matching = entries.filter((item) => !type || item.targetType === type);
    const number = Number(query.get('page') ?? 0);
    const size = Number(query.get('size') ?? 20);
    await answer(route, origin, 200, {
      content: matching.slice(number * size, (number + 1) * size),
      page: number,
      size,
      totalElements: matching.length,
      totalPages: Math.ceil(matching.length / size),
    });
  });
  await page.route('**/api/admin/iam/clients?*', (route) => answer(route, origin, 200, clients));
  await page.route('**/api/admin/iam/clients', async (route) => {
    state.createdClient = route.request().postDataJSON() as Record<string, unknown>;
    const created = { ...state.createdClient, enabled: true, system: false };
    clients.push(created);
    await answer(route, origin, 201, { client: created, secret: 'e2e-secreto-unico' });
  });

  return state;
}

test('an administrator reviews, filters and pages the audit log', async ({ page, baseURL }) => {
  const bff = await mockBff(page, originOf(baseURL), ['iam:audit:read']);

  await page.goto('/audit');
  await expect(page.getByRole('heading', { name: 'Auditoría', level: 1 })).toBeVisible({ timeout: 30_000 });
  const table = page.getByRole('table', { name: 'Registros de auditoría' });
  await expect(table.getByRole('row')).toHaveCount(21);
  await expect(page.getByText('Mostrando 1–20 de 25')).toBeVisible();
  await expect(table.getByRole('row').nth(1)).toContainText('Rol actualizado');

  await page.getByRole('button', { name: 'Página siguiente' }).click();
  await expect(page.getByText('Mostrando 21–25 de 25')).toBeVisible();
  expect(bff.auditQueries.at(-1)?.get('page')).toBe('1');

  await page.getByLabel('Tipo de objetivo').selectOption('CLIENT');
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page.getByText('Mostrando 1–12 de 12')).toBeVisible();
  expect(bff.auditQueries.at(-1)?.get('targetType')).toBe('CLIENT');
  expect(bff.auditQueries.at(-1)?.get('page')).toBe('0');
  await expect(table.getByText('Fallido')).toBeVisible();

  await page.getByRole('button', { name: 'Limpiar' }).click();
  await expect(page.getByText('Mostrando 1–20 de 25')).toBeVisible();
  await page.getByRole('button', { name: 'Ver detalle: Rol actualizado AUDITOR' }).click();
  const detail = page.getByRole('dialog', { name: 'Detalle de auditoría' });
  const changes = detail.getByRole('table', { name: 'Cambios registrados' });
  await expect(changes.getByRole('row', { name: /description/ })).toContainText('Auditor externo');
  await expect(changes.getByRole('row', { name: /description/ })).toHaveAttribute('data-changed', 'true');
  await expect(changes.getByRole('row', { name: /portal/ })).toHaveAttribute('data-changed', 'false');

  await page.screenshot({ path: 'test-output/audit.png' });
});

test('an administrator registers an application and sees its secret once', async ({ page, baseURL }) => {
  const bff = await mockBff(page, originOf(baseURL), ['iam:clients:read', 'iam:clients:write']);

  await page.goto('/clients');
  await expect(page.getByRole('heading', { name: 'Aplicaciones', level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Editar dss-bff' })).toBeVisible();

  await page.getByRole('button', { name: 'Nueva aplicación' }).click();
  const form = page.getByRole('dialog', { name: 'Nueva aplicación' });
  await form.getByLabel(/^Identificador/).fill('portal-becas');
  await form.getByLabel('Nombre').fill('Portal de becas');
  await form.getByLabel('URIs de redirección').fill('https://becas.uatf.edu.bo/callback');
  await form.getByRole('button', { name: 'Registrar aplicación' }).click();

  const secret = page.getByRole('dialog', { name: 'Secreto de portal-becas' });
  await expect(secret.getByLabel('Secreto')).toHaveValue('e2e-secreto-unico');
  expect(bff.createdClient).toEqual({
    clientId: 'portal-becas',
    type: 'CONFIDENTIAL',
    enabled: true,
    name: 'Portal de becas',
    serviceAccountsEnabled: false,
    redirectUris: ['https://becas.uatf.edu.bo/callback'],
    webOrigins: [],
    postLogoutRedirectUris: [],
  });
  await page.screenshot({ path: 'test-output/client-secret.png' });

  await secret.getByRole('button', { name: 'Ya lo guardé' }).click();
  await expect(page.getByText('e2e-secreto-unico')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rotar secreto de portal-becas' })).toBeVisible();
});
