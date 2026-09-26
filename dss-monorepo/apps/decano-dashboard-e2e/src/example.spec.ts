import { test, expect } from '@playwright/test';

test('requires a session before rendering the dashboard', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Sesión requerida' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login');
});

test('exposes the BFF login entry point', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByText('Sistema de Soporte a la Decisión')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
});
