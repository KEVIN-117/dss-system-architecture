'use client';

import { BaseChart } from './base-chart';
import type { ChartOptionFactory } from '../core/types';
import { forecastPeriodLabel, type ForecastBandPoint } from './forecast-band-chart';

export interface StackedForecastSeries {
  programRef: string;
  label: string;
  points: ForecastBandPoint[];
}

export interface ForecastStackedChartProps {
  seriesList: StackedForecastSeries[];
  cadence?: string | null;
  height?: number;
  ariaLabel?: string;
}

const integer = (value: number) => new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(value);

/**
 * Stacked line/area chart comparing observed history and projected values across multiple
 * academic programs for applications, admitted or enrolled series.
 */
export function ForecastStackedChart({
  seriesList,
  cadence,
  height = 380,
  ariaLabel = 'Gráfica de líneas apiladas de pronósticos por carrera',
}: ForecastStackedChartProps) {
  const periodMap = new Map<string, { year: number; period: number; kind: 'HISTORY' | 'FORECAST'; horizon: number | null }>();
  for (const item of seriesList) {
    for (const pt of item.points) {
      const key = `${pt.year}-${pt.period}`;
      const prev = periodMap.get(key);
      if (!prev || (prev.kind === 'HISTORY' && pt.kind === 'FORECAST')) {
        periodMap.set(key, { year: pt.year, period: pt.period, kind: pt.kind, horizon: pt.horizon });
      }
    }
  }
  const orderedPeriods = Array.from(periodMap.values()).sort((a, b) => a.year - b.year || a.period - b.period);
  const categories = orderedPeriods.map((pt) => forecastPeriodLabel(pt, cadence));
  const firstForecastIndex = orderedPeriods.findIndex((pt) => pt.kind === 'FORECAST');

  const option: ChartOptionFactory = (theme) => {
    const echartsSeries = seriesList.map((item, idx) => {
      const color = theme.chartColors[idx % theme.chartColors.length];
      const byPeriod = new Map(item.points.map((pt) => [`${pt.year}-${pt.period}`, pt.value]));
      const data = orderedPeriods.map((pt) => byPeriod.get(`${pt.year}-${pt.period}`) ?? 0);
      return {
        name: item.label,
        type: 'line' as const,
        stack: 'programs',
        smooth: false,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2, color },
        itemStyle: { color },
        areaStyle: { color: theme.alpha(color, 0.22) },
        emphasis: { focus: 'series' as const },
        data,
        ...(idx === 0 && firstForecastIndex >= 0
          ? {
              markLine: {
                silent: true,
                symbol: 'none',
                lineStyle: { color: theme.mutedForeground, type: 'dashed' as const, width: 1.5 },
                label: {
                  formatter: 'Proyección',
                  color: theme.mutedForeground,
                  fontSize: 11,
                },
                data: [{ xAxis: categories[firstForecastIndex] }],
              },
            }
          : {}),
      };
    });

    return {
      backgroundColor: 'transparent',
      color: theme.chartColors,
      aria: { enabled: true },
      grid: { left: 8, right: 16, top: 52, bottom: 12, containLabel: true },
      legend: {
        type: 'scroll',
        top: 0,
        textStyle: { color: theme.mutedForeground },
        pageTextStyle: { color: theme.mutedForeground },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const items = (Array.isArray(params) ? params : [params]) as Array<{
            dataIndex?: number;
            seriesName?: string;
            value?: number;
            marker?: string;
          }>;
          const idx = items[0]?.dataIndex ?? 0;
          const period = orderedPeriods[idx];
          if (!period) return '';
          const header =
            period.kind === 'FORECAST'
              ? `${categories[idx]} · Proyección (h=${period.horizon ?? '—'})`
              : `${categories[idx]} · Observado`;
          const total = items.reduce((sum, entry) => sum + (typeof entry.value === 'number' ? entry.value : 0), 0);
          const rows = items
            .filter((entry) => typeof entry.value === 'number' && entry.value > 0)
            .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
            .slice(0, 12)
            .map((entry) => `${entry.marker ?? ''}${entry.seriesName ?? ''}: <b>${integer(entry.value ?? 0)}</b>`);
          return [header, `<b>Total: ${integer(total)}</b>`, ...rows].join('<br/>');
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
      series: echartsSeries,
    };
  };

  return (
    <BaseChart
      height={height}
      ariaLabel={ariaLabel}
      empty={seriesList.length === 0 || categories.length === 0}
      option={option}
    />
  );
}
