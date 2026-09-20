'use client';

import { useCallback } from 'react';
import { BaseChart } from './base-chart';
import { buildLineOption } from '../core/builders';
import type { ChartDataPoint } from '../core/builders';
import type { ChartOptionFactory, CommonChartProps } from '../core/types';

export interface TrendLineChartProps extends CommonChartProps {
  data: ChartDataPoint[];
}

export function TrendLineChart({ data, title, ...props }: TrendLineChartProps) {
  const option = useCallback<ChartOptionFactory>((theme) =>
    buildLineOption(data, title, theme), [data, title]);
  const invalid = data.some((point) => !Number.isFinite(point.value) || point.value < 0);
  return <BaseChart {...props} title={title} option={option}
    empty={data.length === 0} invalid={invalid} />;
}
