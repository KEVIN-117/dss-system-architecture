import { expect, type Request, test } from '@playwright/test';

test('discovers and queries an OLAP cube through the authenticated BFF', async ({
  page,
}) => {
  test.setTimeout(120_000);

  const username = process.env['OLAP_WORKSPACE_E2E_USERNAME'];
  const password = process.env['OLAP_WORKSPACE_E2E_PASSWORD'];
  if (!username || !password) {
    test.skip(
      true,
      'Configure OLAP Workspace E2E credentials to run against the integration stack.',
    );
    return;
  }

  const bffOrigin = new URL(
    process.env['NEXT_PUBLIC_BFF_URL'] ?? 'http://localhost:3006',
  ).origin;
  const olapRequests: Request[] = [];
  const olapResponses: Array<{ url: string; status: number }> = [];
  const olapFailures: Array<{ url: string; error: string | null }> = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/olap/')) olapRequests.push(request);
  });
  page.on('response', (response) => {
    if (response.url().includes('/api/olap/')) {
      olapResponses.push({ url: response.url(), status: response.status() });
    }
  });
  page.on('requestfailed', (request) => {
    if (request.url().includes('/api/olap/')) {
      olapFailures.push({
        url: request.url(),
        error: request.failure()?.errorText ?? null,
      });
    }
  });

  const sessionRequestPromise = page.waitForRequest(
    (request) => new URL(request.url()).pathname === '/api/auth/me',
    { timeout: 10_000 },
  );
  await page.goto('/login');
  const sessionRequest = await sessionRequestPromise;
  const sessionResponse = await sessionRequest.response();
  if (!sessionResponse) {
    const appOrigin = new URL(page.url()).origin;
    throw new Error(
      `BFF session request to ${sessionRequest.url()} failed without an HTTP response (${sessionRequest.failure()?.errorText ?? 'unknown network error'}). Verify that the BFF is reachable and BFF_ALLOWED_ORIGINS includes ${appOrigin}.`,
    );
  }
  expect(sessionResponse.status()).toBe(401);
  await expect(
    page.getByText('Sistema de Soporte a la Decisión', { exact: true }),
  ).toBeVisible();
  const loginButton = page.getByRole('button', { name: 'Iniciar sesión' });
  await expect(loginButton).toBeEnabled();
  await expect(
    page.getByText('No fue posible verificar tu sesión.'),
  ).toHaveCount(0);
  await loginButton.click();
  const usernameInput = page.locator('input[name="username"]');
  const passwordInput = page.locator('input[name="password"]');
  await expect(usernameInput).toBeVisible();
  await usernameInput.fill(username);
  await passwordInput.fill(password);
  await passwordInput.press('Enter');
  await page.waitForURL((url) => url.pathname === '/', { timeout: 45_000 });

  const discoverResponsePromise = page.waitForResponse(
    (response) => {
      const pathname = new URL(response.url()).pathname;
      return (
        pathname.includes('/api/olap/rest/saiku/') &&
        pathname.endsWith('/discover')
      );
    },
    { timeout: 45_000 },
  );
  await page.goto('/analysis');
  const discoverResponse = await discoverResponsePromise;
  expect(
    discoverResponse.ok(),
    `OLAP discovery returned HTTP ${discoverResponse.status()}`,
  ).toBe(true);

  const cubePicker = page.getByRole('combobox', { name: 'Cubo' });
  const cubeOptions = cubePicker.locator('option:not([disabled])');
  await expect
    .poll(() => cubeOptions.count(), {
      timeout: 35_000,
      message: `No published cubes were returned. OLAP responses: ${JSON.stringify(olapResponses)}. Failed requests: ${JSON.stringify(olapFailures)}.`,
    })
    .toBeGreaterThan(0);
  await cubePicker.selectOption({ index: 1 });

  await expect(
    page.getByRole('heading', { name: 'Dimensiones y medidas' }),
  ).toBeVisible();
  const measureButton = page
    .getByRole('button', { name: /^Agregar .+ a columnas$/i })
    .first();
  const metadataError = page
    .getByRole('alert')
    .filter({ hasText: /Failed to fetch|No se pudieron cargar los metadatos/i });
  await expect
    .poll(
      async () =>
        (await measureButton.isVisible()) || (await metadataError.isVisible()),
      {
        timeout: 35_000,
        message: 'The selected cube metadata did not finish loading.',
      },
    )
    .toBe(true);
  if (await metadataError.isVisible()) {
    throw new Error(
      `Cube metadata failed: ${await metadataError.textContent()}. OLAP responses: ${JSON.stringify(olapResponses)}. Failed requests: ${JSON.stringify(olapFailures)}.`,
    );
  }
  await measureButton.click();
  const dimensionButton = page
    .getByRole('button', { name: /^Agregar .+ a filas$/i })
    .first();
  if (await dimensionButton.count()) await dimensionButton.click();

  await page.getByRole('button', { name: 'Ejecutar consulta' }).click();
  await expect(page.getByRole('heading', { name: 'Resultados' })).toBeVisible();
  await expect(
    page.getByRole('table').or(page.getByText('No hay datos para mostrar')),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByRole('button', { name: 'Gráfico' }).click();
  await expect(page.getByRole('img')).toBeVisible();

  expect(olapRequests.length).toBeGreaterThan(0);
  for (const request of olapRequests) {
    const headers = await request.allHeaders();
    expect(new URL(request.url()).origin).toBe(bffOrigin);
    expect(headers['authorization']).toBeUndefined();
    expect(headers['cookie']).toContain('dss_session=');
  }
});
