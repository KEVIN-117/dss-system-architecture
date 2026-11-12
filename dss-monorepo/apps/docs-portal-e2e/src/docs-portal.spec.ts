import { expect, test } from '@playwright/test';

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop layout only');

  test('home lists role guides and API services', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Documentación del DSS' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Rectorado/ }).first()).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Contenido' }).getByText('Auth Service API')).toBeVisible();
  });

  test('sidebar navigation gives each guide its own URL, anchors and TOC', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Contenido' }).getByRole('link', { name: 'Tablero de Decanato' }).click();
    await expect(page).toHaveURL(/\/docs\/guia-decanato$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Tablero de Decanato' })).toBeVisible();
    await expect(page.locator('h2#para-que-sirve')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'En esta página' }).getByRole('link', { name: 'Para qué sirve' })).toHaveAttribute(
      'href',
      '#para-que-sirve',
    );
    // GFM tables render as real tables.
    await expect(page.locator('.dp-prose table').first()).toBeVisible();
  });

  test('search matches guide body text, ignoring accents', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Buscar en la documentación').fill('desercion');
    const results = page.locator('.dp-results');
    await expect(results.getByText(/resultado/)).toBeVisible();
    await expect(results.getByRole('link').first()).toBeVisible();
    await page.getByLabel('Buscar en la documentación').press('Enter');
    await expect(page).toHaveURL(/\/docs\//);
  });

  test('API reference shows the operation and code samples', async ({ page }) => {
    await page.goto('/reference');
    await page.getByRole('link', { name: /BFF API/ }).first().click();
    await page.getByRole('link', { name: /\/api\/health/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Verifica que el BFF esté disponible' })).toBeVisible();
    await expect(page.locator('.dp-endpoint')).toContainText('/api/health');
    await expect(page.getByRole('tab', { name: 'cURL' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toContainText('curl -X GET');
    await page.getByRole('tab', { name: 'Python' }).click();
    await expect(page.getByRole('tabpanel')).toContainText('requests.get');
  });

  test('restricted guide fails closed without a session', async ({ page }) => {
    await page.goto('/docs/guia-portal-administracion');
    await expect(page.getByRole('heading', { name: 'Acceso restringido' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Iniciar sesión institucional' })).toBeVisible();
    await expect(page.getByText('Crear corte académico')).toHaveCount(0);
  });

  test('theme toggle persists across navigation', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    const initial = await html.getAttribute('data-docs-theme');
    await page.getByRole('button', { name: /Activar tema/ }).click();
    const toggled = initial === 'dark' ? 'light' : 'dark';
    await expect(html).toHaveAttribute('data-docs-theme', toggled);
    await page.goto('/reference');
    await expect(html).toHaveAttribute('data-docs-theme', toggled);
  });

  test('unknown guide returns the portal 404 page', async ({ page }) => {
    const response = await page.goto('/docs/no-existe');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'No encontramos esta página' })).toBeVisible();
  });
});

test.describe('mobile', () => {
  test.skip(({ isMobile }) => !isMobile, 'Mobile layout only');

  test('drawer opens, navigates and closes on selection', async ({ page }) => {
    await page.goto('/');
    const menu = page.getByRole('button', { name: 'Abrir navegación' });
    await menu.click();
    const sidebar = page.getByRole('complementary', { name: 'Navegación de la documentación' });
    await expect(sidebar).toBeInViewport();
    await sidebar.getByRole('link', { name: 'Tablero de Rectorado' }).click();
    await expect(page).toHaveURL(/\/docs\/guia-rectorado$/);
    await expect(page.getByRole('button', { name: 'Abrir navegación' })).toHaveAttribute('aria-expanded', 'false');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
