import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('h1').innerText()).toContain('BFF');
  expect(await page.locator('h2').innerText()).toContain('Backend for Frontend');
});

test('keeps the OAuth start route public and redirects to Keycloak', async ({ page }) => {
  await page.goto('/');
  const loginUrl = new URL(
    '/api/auth/login?returnTo=http://localhost:3001/login',
    page.url(),
  );
  const response = await page.request.get(
    loginUrl.toString(),
    { maxRedirects: 0 },
  );

  expect(response.status()).toBe(302);
  const location = response.headers().location;
  expect(location).toBeTruthy();
  expect(new URL(location!).searchParams.get('client_id')).toBe('dss-bff');
  expect(new URL(location!).searchParams.get('code_challenge_method')).toBe('S256');
});

test('requires authentication on the session endpoint', async ({ page }) => {
  await page.goto('/');
  const sessionUrl = new URL('/api/auth/me', page.url());
  const response = await page.request.get(sessionUrl.toString());

  expect(response.status()).toBe(401);
});
