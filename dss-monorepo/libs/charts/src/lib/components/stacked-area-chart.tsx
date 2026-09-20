'use client';

import { useCallback } from 'react';
import { BaseChart } from './base-chart';
import { buildStackedAreaOption } from '../core/builders';
import type { MultiSeriesChartData } from '../core/builders';
import type { ChartOptionFactory, CommonChartProps } from '../core/types';

export interface StackedAreaChartProps extends CommonChartProps {
  data: MultiSeriesChartData;
}

export function StackedAreaChart({ data, title, ...props }: StackedAreaChartProps) {
  const option = useCallback<ChartOptionFactory>((theme) =>
    buildStackedAreaOption(data, title, theme), [data, title]);
  return <BaseChart {...props} title={title} option={option}
    empty={data.categories.length === 0 || data.series.every((series) => series.data.length === 0)} />;
}
