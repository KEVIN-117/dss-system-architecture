import { expect, test, type Page } from '@playwright/test';

type Credentials = { username: string; password: string };

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) test.skip(true, `Set ${name} in apps/rector-dashboard-e2e/.env.e2e.`);
  return value!;
}

function testData() {
  return {
    programRef: requiredEnv('PREDICTION_E2E_PROGRAM_REF'),
    cutId: requiredEnv('PREDICTION_E2E_CUT_ID'),
    rector: {
      username: requiredEnv('PREDICTION_E2E_RECTOR_USERNAME'),
      password: requiredEnv('PREDICTION_E2E_RECTOR_PASSWORD'),
    } satisfies Credentials,
    outOfScope: {
      username: requiredEnv('PREDICTION_E2E_OUT_OF_SCOPE_USERNAME'),
      password: requiredEnv('PREDICTION_E2E_OUT_OF_SCOPE_PASSWORD'),
    } satisfies Credentials,
  };
}

async function signIn(page: Page, credentials: Credentials) {
  await page.goto('/login?returnTo=%2Fpredictions');
  const dashboardOrigin = new URL(page.url()).origin;
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.locator('#username').fill(credentials.username);
  await page.locator('#password').fill(credentials.password);
  await page.locator('#kc-login').click();
  const outcome = await Promise.race([
    page.waitForURL((url) => url.origin === dashboardOrigin && (
      url.pathname === '/predictions' || url.searchParams.get('error') === 'authentication_failed'
    ), {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    }).then(() => 'callback' as const),
    page.getByRole('heading', { name: /update password/i })
      .waitFor({ state: 'visible', timeout: 20_000 })
      .then(() => 'password_update_required' as const),
  ]);
  if (outcome === 'password_update_required') {
    throw new Error(
      'La cuenta E2E tiene la acción requerida Update password. Completa el cambio una vez en Keycloak o configura una contraseña permanente (Temporary=Off) antes de ejecutar la prueba.',
    );
  }
  const callbackUrl = new URL(page.url());
  if (callbackUrl.searchParams.get('error') === 'authentication_failed') {
    throw new Error(
      'BFF rechazó el callback OIDC. Revisa sus logs: en PRED-007 el Auth Service debe tener un perfil activo asociado al sub de Keycloak; después asigna el rol y contexto académico de la cuenta.',
    );
  }
}

test.describe('PRED-007 · Keycloak → BFF → Prediction Service → Rector UI', () => {
  test('Rector publica la población Faker, la consulta por GraphQL y ve el lote completo', async ({ page }) => {
    test.setTimeout(300_000);
    const { programRef, cutId, rector } = testData();
    await signIn(page, rector);

    await expect(page.getByRole('heading', { name: 'Riesgo de abandono del programa' })).toBeVisible();
    const programSelect = page.getByLabel('Programa');
    const cutSelect = page.getByLabel('Cierre académico');
    await expect(programSelect).toBeEnabled();
    await programSelect.selectOption(programRef);
    await cutSelect.selectOption(cutId);

    await page.getByRole('button', { name: 'Calcular y publicar' }).click();
    await expect(page.getByText('Lote completo y publicado.')).toBeVisible({ timeout: 240_000 });
    await expect(page.getByRole('heading', { name: 'Resultados del lote' })).toBeVisible();
    await expect(page.getByText('PUBLISHED', { exact: true })).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible();

    const graphQlResponse = page.waitForResponse((response) =>
      response.url().endsWith('/api/graphql') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Consultar' }).click();
    const response = await graphQlResponse;
    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.errors).toBeUndefined();
    expect(payload.data.predictionPublication.publication.status).toBe('PUBLISHED');
    expect(payload.data.predictionPublication.publication.result_count).toBeGreaterThan(0);
    expect(payload.data.predictionPublication.publication.results.length).toBeGreaterThan(0);

    const activeVersion = payload.data.predictionPublication.publication.model_version;
    const rows = payload.data.predictionPublication.publication.results as Array<{ model_version: string }>;
    expect(rows.every((row) => row.model_version === activeVersion)).toBe(true);
  });

  test('la publicación exige sesión y rechaza por BFF una cuenta válida fuera del ámbito', async ({ page }) => {
    const { programRef, cutId, outOfScope } = testData();
    const bffUrl = process.env.NEXT_PUBLIC_BFF_URL ?? 'http://localhost:3006';

    await page.goto('/predictions');
    await expect(page.getByRole('heading', { name: 'Sesión requerida' })).toBeVisible();
    const anonymousStatus = await page.evaluate(async ({ base, programRef, cutId }) => {
      const query = new URLSearchParams({ program_ref: programRef, cut_id: cutId });
      const response = await fetch(`${base}/api/prediction/v1/prediction-publications?${query}`, {
        credentials: 'include',
      });
      return response.status;
    }, { base: bffUrl, programRef, cutId });
    expect(anonymousStatus).toBe(401);

    await signIn(page, outOfScope);
    await expect(page.getByRole('heading', { name: 'Acceso no autorizado' })).toBeVisible();
    const outOfScopeStatus = await page.evaluate(async ({ base, programRef, cutId }) => {
      const query = new URLSearchParams({ program_ref: programRef, cut_id: cutId });
      const response = await fetch(`${base}/api/prediction/v1/prediction-publications?${query}`, {
        credentials: 'include',
      });
      return response.status;
    }, { base: bffUrl, programRef, cutId });
    expect(outOfScopeStatus).toBe(403);
  });
});
