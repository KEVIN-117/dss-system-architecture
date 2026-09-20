import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('h1').innerText()).toContain('BFF');
  expect(await page.locator('h2').innerText()).toContain('Backend for Frontend');
});
