'use client';

import { BaseChart } from './base-chart';
import type { ChartOptionFactory } from '../core/types';

/** One observed or projected period of a program series (Prediction Service forecasts). */
export interface ForecastBandPoint {
  year: number;
  period: number;
  kind: 'HISTORY' | 'FORECAST';
  horizon: number | null;
  value: number;
  /** Prediction bands keyed by level ('0.8', '0.95'). */
  interval: Record<string, { lower: number; upper: number }> | null;
}

const integer = (value: number) => new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(value);

/** "2026" for annual series, "2026-1" for semester series. */
export function forecastPeriodLabel(point: Pick<ForecastBandPoint, 'year' | 'period'>, cadence?: string | null): string {
  return cadence === 'ANUAL' ? String(point.year) : `${point.year}-${point.period}`;
}

export interface ForecastBandChartProps {
  points: ForecastBandPoint[];
  cadence?: string | null;
  height?: number;
}

/** History and projection of a program series, with the 80 % and 95 % prediction bands. */
export function ForecastBandChart({ points, cadence, height = 340 }: ForecastBandChartProps) {
  const categories = points.map((point) => forecastPeriodLabel(point, cadence));
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
          const label = forecastPeriodLabel(point, cadence);
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
      height={height}
      ariaLabel="Serie histórica y proyección con bandas de predicción del 80 % y 95 %"
      empty={points.length === 0}
      option={option}
    />
  );
}
