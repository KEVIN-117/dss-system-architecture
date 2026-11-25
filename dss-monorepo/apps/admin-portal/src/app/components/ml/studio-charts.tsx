'use client';

import { BaseChart, ForecastBandChart, forecastPeriodLabel, type ChartOptionFactory } from '@dss-monorepo/charts';

import type { ForecastPoint, NumericSummary } from '../../data-access/ml-studio';
import type { RegressionMetrics } from '../../data-access/ml-operations';
import { decimal } from './model-charts';

const integer = (value: number) => new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(value);

function bars(
  categories: string[],
  values: number[],
  options: { horizontal?: boolean; min?: number; max?: number; format?: (value: number) => string; name?: string } = {},
): ChartOptionFactory {
  const format = options.format ?? integer;
  return (theme, width) => {
    const compact = width < 560;
    const valueAxis = {
      type: 'value' as const,
      min: options.min,
      max: options.max,
      axisLabel: { color: theme.mutedForeground, formatter: (value: number) => format(value) },
      splitLine: { lineStyle: { color: theme.gridLine } },
    };
    const categoryAxis = {
      type: 'category' as const,
      data: categories,
      axisLabel: {
        color: theme.mutedForeground,
        interval: options.horizontal ? 0 : ('auto' as const),
        rotate: !options.horizontal && compact && categories.length > 4 ? 35 : 0,
        width: options.horizontal ? 140 : undefined,
        overflow: 'truncate' as const,
      },
      axisLine: { lineStyle: { color: theme.gridLine } },
      inverse: options.horizontal,
    };
    return {
      backgroundColor: 'transparent',
      color: theme.chartColors,
      aria: { enabled: true },
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (value: unknown) => (typeof value === 'number' ? format(value) : '—'),
      },
      xAxis: options.horizontal ? valueAxis : categoryAxis,
      yAxis: options.horizontal ? categoryAxis : valueAxis,
      series: [
        {
          name: options.name ?? 'Valor',
          type: 'bar',
          barMaxWidth: 26,
          data: values.map((value) => ({
            value,
            itemStyle: value < 0 ? { color: theme.destructive } : undefined,
          })),
        },
      ],
    };
  };
}

/** Counts per category (rows by period, by program or by class). */
export function CountBarChart({
  items,
  ariaLabel,
  horizontal = false,
  height = 260,
}: {
  items: Array<{ key: string; count: number }>;
  ariaLabel: string;
  horizontal?: boolean;
  height?: number;
}) {
  return (
    <BaseChart
      height={height}
      ariaLabel={ariaLabel}
      empty={items.length === 0}
      option={bars(items.map((item) => item.key), items.map((item) => item.count), { horizontal, name: 'Filas' })}
    />
  );
}

/** Equal-width histogram computed by the dataset profile. */
export function HistogramChart({ summary, ariaLabel }: { summary: NumericSummary; ariaLabel: string }) {
  const labels = summary.histogram.map((bin) => `${decimal(bin.start, 2)}–${decimal(bin.end, 2)}`);
  return (
    <BaseChart
      height={240}
      ariaLabel={ariaLabel}
      empty={summary.histogram.length === 0}
      option={bars(labels, summary.histogram.map((bin) => bin.count), { name: 'Filas' })}
    />
  );
}

/** Pearson correlation of each feature with the target, strongest first. */
export function CorrelationChart({ correlations }: { correlations: Array<{ field: string; correlation: number }> }) {
  const top = correlations.slice(0, 12);
  return (
    <BaseChart
      height={Math.max(180, top.length * 26 + 40)}
      ariaLabel="Correlación de cada variable con el objetivo"
      empty={top.length === 0}
      option={bars(top.map((item) => item.field), top.map((item) => item.correlation), {
        horizontal: true,
        min: -1,
        max: 1,
        format: (value) => decimal(value, 2),
        name: 'Correlación',
      })}
    />
  );
}

/** Regression error by bucket of the observed value: MAE and bias (prediction minus observed). */
export function ResidualsChart({ metrics, unit }: { metrics: RegressionMetrics | null | undefined; unit?: string | null }) {
  const buckets = metrics?.residuals_by_bucket ?? [];
  if (buckets.length === 0) {
    return <p className="text-sm text-muted-foreground">El candidato no publicó residuos por tramo.</p>;
  }
  const categories = buckets.map((bucket) => `${decimal(bucket.observed_min, 1)}–${decimal(bucket.observed_max, 1)}`);
  const option: ChartOptionFactory = (theme) => ({
    backgroundColor: 'transparent',
    color: theme.chartColors,
    aria: { enabled: true },
    grid: { left: 8, right: 16, top: 44, bottom: 8, containLabel: true },
    legend: { top: 0, textStyle: { color: theme.mutedForeground } },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (value: unknown) => (typeof value === 'number' ? decimal(value, 2) : '—'),
    },
    xAxis: {
      type: 'category',
      name: unit ? `Valor observado (${unit})` : 'Valor observado',
      nameLocation: 'middle',
      nameGap: 28,
      data: categories,
      axisLabel: { color: theme.mutedForeground },
      axisLine: { lineStyle: { color: theme.gridLine } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: theme.mutedForeground },
      splitLine: { lineStyle: { color: theme.gridLine } },
    },
    series: [
      { name: 'Error absoluto medio', type: 'bar', barMaxWidth: 26, data: buckets.map((bucket) => bucket.mae) },
      { name: 'Sesgo (predicho − real)', type: 'bar', barMaxWidth: 26, data: buckets.map((bucket) => bucket.bias) },
    ],
  });
  return <BaseChart height={300} ariaLabel="Error de la prueba final por tramo del valor observado" option={option} />;
}

/** Shared with the academic dashboards (PRED-108): the chart lives in @dss-monorepo/charts. */
export function periodLabel(point: Pick<ForecastPoint, 'year' | 'period'>, cadence?: string | null): string {
  return forecastPeriodLabel(point, cadence);
}

/** History and projection of a program series, with the 80 % and 95 % prediction bands. */
export function ForecastChart({ points, cadence }: { points: ForecastPoint[]; cadence?: string | null }) {
  return <ForecastBandChart points={points} cadence={cadence} />;
}
