import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const playground = '/iframe.html?id=charts-validation--lifecycle-and-themes&viewMode=story';
type Snapshot = {
  width: number; height: number;
  option: { animation: boolean; series: Array<{ data: unknown[]; itemStyle?: { color: string } }>; textStyle?: { color: string } };
  colors: Array<{ input: string; normalized: string; alpha: string }>;
};
async function inspect(page: Page): Promise<Snapshot> {
  await page.getByRole('button', { name: 'Inspeccionar opciones' }).click();
  return JSON.parse(await page.getByTestId('snapshot').textContent() || '{}');
}
test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => { throw error; });
  page.on('console', (message) => {
    if (message.type() === 'error') throw new Error(message.text());
  });
});

test('updates data, the click callback, resize and hidden containers', async ({ page }) => {
  await page.goto(playground);
  const canvas = page.getByTestId('local-theme').locator('canvas');
  await expect(canvas).toHaveCount(1);
  const original = await page.locator('[role="img"]').getAttribute('_echarts_instance_');
  if (!original) throw new Error('Missing initial ECharts instance');
  await page.getByLabel('Datos', { exact: true }).selectOption('reduced');
  await expect.poll(async () => (await inspect(page)).option.series[0].data.length).toBe(1);
  await page.getByRole('button', { name: 'Cambiar callback' }).click();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Missing canvas');
  await canvas.click({ position: { x: box.width / 2, y: box.height * 0.6 } });
  await expect(page.getByTestId('selection')).toHaveText('1:Ingeniería:80');
  await page.getByRole('button', { name: 'Cambiar callback' }).click();
  await canvas.click({ position: { x: box.width / 2, y: box.height * 0.6 } });
  await expect(page.getByTestId('selection')).toHaveText('2:Ingeniería:80');
  await page.getByRole('button', { name: 'Cambiar ancho' }).click();
  await expect.poll(async () => (await inspect(page)).width).toBe(300);
  await page.getByRole('button', { name: 'Ocultar o mostrar' }).click();
  await expect(canvas).toBeHidden();
  await page.getByRole('button', { name: 'Ocultar o mostrar' }).click();
  await expect(canvas).toBeVisible();
  await expect(page.locator('[role="img"]')).toHaveAttribute('_echarts_instance_', original);
  await page.getByRole('button', { name: 'Montar o desmontar' }).click();
  await expect(canvas).toHaveCount(0);
  await page.getByRole('button', { name: 'Montar o desmontar' }).click();
  await expect(canvas).toHaveCount(1);
  await expect(page.locator('[role="img"]')).not.toHaveAttribute('_echarts_instance_', original);
});

test('resolves DSS themes, local OKLCH and transparent colors without remounting', async ({ page }) => {
  await page.goto(playground);
  await expect(page.locator('canvas')).toHaveCount(1);
  const instance = await page.locator('[role="img"]').getAttribute('_echarts_instance_');
  if (!instance) throw new Error('Missing initial ECharts instance');
  let previousColor = (await inspect(page)).option.series[0].itemStyle?.color;
  for (const role of ['rector', 'decano', 'director', 'admin']) {
    await page.getByLabel('Ámbito', { exact: true }).selectOption(role);
    await expect.poll(async () => (await inspect(page)).option.series[0].itemStyle?.color).not.toBe(previousColor);
    previousColor = (await inspect(page)).option.series[0].itemStyle?.color;
    await page.getByRole('button', { name: 'Cambiar modo' }).click();
    await expect.poll(async () => (await inspect(page)).option.series[0].itemStyle?.color).not.toBe(previousColor);
    previousColor = (await inspect(page)).option.series[0].itemStyle?.color;
    await page.getByRole('button', { name: 'Cambiar modo' }).click();
  }
  await page.getByRole('button', { name: 'Color local' }).click();
  await expect.poll(async () => (await inspect(page)).option.series[0].itemStyle?.color).toBe((await inspect(page)).colors[3].normalized);
  const colors = (await inspect(page)).colors;
  expect(colors[1].alpha).toBe('rgba(10, 20, 30, 0.2)');
  expect(colors[2].normalized).toBe('rgba(0, 128, 0, 1)');
  expect(colors[3].normalized).toMatch(/^rgba\(/);
  expect(colors[3].alpha).toMatch(/, 0\.5\)$/);
  await expect(page.locator('[role="img"]')).toHaveAttribute('_echarts_instance_', instance);
});

for (const kind of ['bar', 'donut', 'line']) {
  test(`${kind}: loading, empty, invalid, zero and narrow layouts`, async ({ page }) => {
    await page.goto(playground);
    await page.getByLabel('Gráfico', { exact: true }).selectOption(kind);
    await expect(page.locator('canvas')).toHaveCount(1);
    await page.getByLabel('Datos', { exact: true }).selectOption('empty');
    const chartState = page.locator('[data-chart-state]');
    await expect(chartState.getByRole('status')).toHaveText('Sin datos disponibles');
    await page.getByRole('button', { name: 'Alternar carga' }).click();
    await expect(chartState.getByRole('status')).toHaveText('Cargando…');
    await page.getByLabel('Datos', { exact: true }).selectOption('invalid');
    await expect(chartState.getByRole('status')).toHaveText('Cargando…');
    await page.getByRole('button', { name: 'Alternar carga' }).click();
    await expect(page.getByRole('alert')).toContainText('Datos inválidos');
    await page.getByLabel('Datos', { exact: true }).selectOption('zero');
    await expect(page.locator('[data-chart-state]')).toHaveAttribute('data-chart-state', kind === 'donut' ? 'empty' : 'ready');
    await page.getByLabel('Datos', { exact: true }).selectOption('long');
    await page.getByRole('button', { name: 'Cambiar ancho' }).click();
    await expect.poll(async () => (await inspect(page)).width).toBe(300);
    await page.screenshot({ path: `libs/charts/test-output/${kind}-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator('canvas')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `libs/charts/test-output/${kind}-mobile.png`, fullPage: true });
  });
}

test('honors reduced motion, including changes after mount', async ({ page }) => {
  await page.goto(playground);
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(async () => (await inspect(page)).option.animation).toBe(false);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(async () => (await inspect(page)).option.animation).not.toBe(false);
});

for (const component of ['AcademicBarChart', 'RiskDonutChart', 'TrendLineChart', 'StackedAreaChart', 'ScatterChart',
  'ClusteringScatterChart', 'RegressionScatterChart', 'AcademicRadarChart', 'AcademicHeatmapChart', 'AcademicSunburstChart', 'AcademicSankeyChart']) {
  test(`catalog: ${component} renders and resizes`, async ({ page }) => {
    await page.goto(`/iframe.html?id=charts-${component.toLowerCase()}--default&viewMode=story`);
    const host = page.locator('[role="img"]');
    await expect(host).toBeVisible();
    // Heatmap may allocate layers, so verify the canvas belonging to the chart
    // instead of asserting a document-wide canvas count.
    const canvas = host.locator('canvas').first();
    await expect(canvas).toBeVisible();
    const initial = await canvas.boundingBox();
    if (!initial) throw new Error('Missing canvas bounds');
    await page.setViewportSize({ width: 375, height: 812 });
    await expect.poll(async () => (await canvas.boundingBox())?.width).toBeLessThan(initial.width);
    expect(await canvas.evaluate((node: HTMLCanvasElement) => {
      const ctx = node.getContext('2d');
      return ctx && ctx.getImageData(0, 0, node.width, node.height).data.some((channel, i) => i % 4 === 3 && channel > 0);
    })).toBe(true);
  });
}
