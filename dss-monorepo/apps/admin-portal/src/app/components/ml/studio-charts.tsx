'use client';

import { BaseChart, type ChartOptionFactory } from '@dss-monorepo/charts';

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

export function periodLabel(point: Pick<ForecastPoint, 'year' | 'period'>, cadence?: string | null): string {
  return cadence === 'ANUAL' ? String(point.year) : `${point.year}-${point.period}`;
}

/** History and projection of a program series, with the 80 % and 95 % prediction bands. */
export function ForecastChart({ points, cadence }: { points: ForecastPoint[]; cadence?: string | null }) {
  const categories = points.map((point) => periodLabel(point, cadence));
  const lastHistory = points.map((point) => point.kind).lastIndexOf('HISTORY');
  const history = points.map((point) => (point.kind === 'HISTORY' ? point.value : null));
  // The projection starts at the last observed point so both lines join.
  const projection = points.map((point, index) =>
    point.kind === 'FORECAST' || index === lastHistory ? point.value : null,
  );
  const band = (level: string, side: 'lower' | 'upper') =>
    points.map((point) => (point.kind === 'FORECAST' ? point.interval?.[level]?.[side] ?? null : null));
  const lower95 = band('0.95', 'lower');
  const upper95 = band('0.95', 'upper');
  const lower80 = band('0.8', 'lower');
  const upper80 = band('0.8', 'upper');
  const width = (upper: Array<number | null>, lower: Array<number | null>) =>
    upper.map((value, index) => (value === null || lower[index] === null ? null : value - (lower[index] as number)));

  const option: ChartOptionFactory = (theme) => {
    const accent = theme.chartColors[1] ?? theme.chartColors[0];
    const stackedBand = (name: string, stack: string, base: Array<number | null>, size: Array<number | null>, opacity: number) => [
      { name: `${name} base`, type: 'line' as const, stack, data: base, symbol: 'none', lineStyle: { opacity: 0 }, tooltip: { show: false } },
      {
        name,
        type: 'line' as const,
        stack,
        data: size,
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: { color: theme.alpha(accent, opacity) },
        tooltip: { show: false },
      },
    ];
    return {
      backgroundColor: 'transparent',
      color: theme.chartColors,
      aria: { enabled: true },
      grid: { left: 8, right: 16, top: 44, bottom: 8, containLabel: true },
      legend: {
        top: 0,
        data: ['Histórico', 'Proyección', 'Banda 95 %', 'Banda 80 %'],
        textStyle: { color: theme.mutedForeground },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const first = (Array.isArray(params) ? params[0] : params) as { dataIndex?: number } | undefined;
          const point = points[first?.dataIndex ?? 0];
          if (!point) return '';
          const label = periodLabel(point, cadence);
          if (point.kind === 'HISTORY') return `${label}<br/>Observado: ${integer(point.value)}`;
          const i95 = point.interval?.['0.95'];
          const i80 = point.interval?.['0.8'];
          return [
            `${label} (h=${point.horizon ?? '—'})`,
            `Proyección: ${integer(point.value)}`,
            i80 ? `80 %: ${integer(i80.lower)} – ${integer(i80.upper)}` : '',
            i95 ? `95 %: ${integer(i95.lower)} – ${integer(i95.upper)}` : '',
          ].filter(Boolean).join('<br/>');
        },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: categories,
        axisLabel: { color: theme.mutedForeground },
        axisLine: { lineStyle: { color: theme.gridLine } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        axisLabel: { color: theme.mutedForeground, formatter: (value: number) => integer(value) },
        splitLine: { lineStyle: { color: theme.gridLine } },
      },
      series: [
        ...stackedBand('Banda 95 %', 'band95', lower95, width(upper95, lower95), 0.14),
        ...stackedBand('Banda 80 %', 'band80', lower80, width(upper80, lower80), 0.24),
        { name: 'Histórico', type: 'line' as const, data: history, symbolSize: 6, lineStyle: { width: 2, color: theme.chartColors[0] }, itemStyle: { color: theme.chartColors[0] } },
        { name: 'Proyección', type: 'line' as const, data: projection, symbolSize: 6, lineStyle: { width: 2, type: 'dashed' as const, color: accent }, itemStyle: { color: accent } },
      ],
    };
  };
  return (
    <BaseChart
      height={340}
      ariaLabel="Serie histórica y proyección con bandas de predicción del 80 % y 95 %"
      empty={points.length === 0}
      option={option}
    />
  );
}
