import { test, expect } from '@playwright/test';

// The BFF runs under `next dev` during e2e: the first visit compiles chunks on
// demand and, with several browsers in parallel, the `load` event can take
// longer than the test timeout (seen on Firefox). The assertions only need the
// rendered HTML, so wait for DOMContentLoaded and let the locators retry.
test('has title', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1')).toContainText('BFF');
  await expect(page.locator('h2')).toContainText('Backend for Frontend');
});

// The API checks do not need a rendered page: use the request fixture, which
// resolves relative URLs against `baseURL`.
test('keeps the OAuth start route public and redirects to Keycloak', async ({
  request,
}) => {
  const response = await request.get(
    '/api/auth/login?returnTo=http://localhost:3001/login',
    { maxRedirects: 0 },
  );

  expect(response.status()).toBe(302);
  const location = response.headers().location;
  expect(location).toBeTruthy();
  expect(new URL(location!).searchParams.get('client_id')).toBe('dss-bff');
  expect(new URL(location!).searchParams.get('code_challenge_method')).toBe(
    'S256',
  );
});

test('requires authentication on the session endpoint', async ({ request }) => {
  const response = await request.get('/api/auth/me');

  expect(response.status()).toBe(401);
});
