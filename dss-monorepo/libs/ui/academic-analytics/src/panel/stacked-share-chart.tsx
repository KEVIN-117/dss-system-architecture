'use client';

import { useCallback } from 'react';
import { BaseChart, type ChartOptionFactory } from '@dss-monorepo/charts';

export interface StackedShareRow {
  label: string;
  parts: (number | null)[];
}

/**
 * 100 % stacked bars: each row shows how its total splits into the given parts
 * (e.g. aprobadas / reprobadas / abandono). Horizontal for long labels.
 */
export function StackedShareChart({
  rows,
  parts,
  horizontal = false,
  ariaLabel,
  height,
}: {
  rows: StackedShareRow[];
  parts: string[];
  horizontal?: boolean;
  ariaLabel: string;
  height?: number;
}) {
  const option = useCallback<ChartOptionFactory>(
    (theme) => {
      const shares = rows.map((row) => {
        const total = row.parts.reduce<number>((sum, value) => sum + (value ?? 0), 0);
        return row.parts.map((value) => (total > 0 && value !== null ? (value * 100) / total : null));
      });
      const category = {
        type: 'category' as const,
        data: rows.map((row) => row.label),
        axisLabel: { color: theme.mutedForeground, width: horizontal ? 180 : 90, overflow: 'truncate' as const },
        axisLine: { lineStyle: { color: theme.gridLine } },
        inverse: horizontal,
      };
      const value = {
        type: 'value' as const,
        max: 100,
        axisLabel: { color: theme.mutedForeground, formatter: '{value} %' },
        splitLine: { lineStyle: { color: theme.gridLine, type: 'dashed' as const } },
      };
      return {
        backgroundColor: 'transparent',
        color: theme.chartColors,
        legend: { top: 0, textStyle: { color: theme.foreground } },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          backgroundColor: theme.alpha(theme.background, 0.9),
          textStyle: { color: theme.foreground },
          valueFormatter: (v: unknown) => (typeof v === 'number' ? `${v.toFixed(1)} %` : '—'),
        },
        grid: { left: '3%', right: '4%', bottom: '3%', top: 36, containLabel: true },
        xAxis: horizontal ? value : category,
        yAxis: horizontal ? category : value,
        series: parts.map((name, index) => ({
          name,
          type: 'bar',
          stack: 'total',
          barMaxWidth: 36,
          emphasis: { focus: 'series' },
          data: shares.map((share) => (share[index] === null ? null : Number(share[index]?.toFixed(1)))),
        })),
      };
    },
    [rows, parts, horizontal],
  );
  return (
    <BaseChart
      option={option}
      ariaLabel={ariaLabel}
      empty={rows.length === 0}
      height={height ?? (horizontal ? Math.max(240, rows.length * 28 + 60) : 320)}
    />
  );
}
