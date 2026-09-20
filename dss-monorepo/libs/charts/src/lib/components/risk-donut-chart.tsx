'use client';

import { useCallback } from 'react';
import { BaseChart } from './base-chart';
import { buildDonutOption } from '../core/builders';
import type { ChartDataPoint } from '../core/builders';
import type { ChartOptionFactory, CommonChartProps } from '../core/types';

export interface RiskDonutChartProps extends CommonChartProps {
  data: ChartDataPoint[];
}

export function RiskDonutChart({ data, title, ...props }: RiskDonutChartProps) {
  const option = useCallback<ChartOptionFactory>((theme, width) =>
    buildDonutOption(data, title, theme, width), [data, title]);
  const invalid = data.some((point) => !Number.isFinite(point.value) || point.value < 0);
  return <BaseChart {...props} title={title} option={option}
    empty={data.length === 0 || data.every((point) => point.value === 0)} invalid={invalid} />;
}
