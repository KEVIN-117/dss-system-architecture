'use client';

import { useCallback } from 'react';
import { BaseChart } from './base-chart';
import { buildBarOption } from '../core/builders';
import type { ChartDataPoint } from '../core/builders';
import type { ChartOptionFactory, CommonChartProps } from '../core/types';

export interface AcademicBarChartProps extends CommonChartProps {
  data: ChartDataPoint[];
}

export function AcademicBarChart({ data, title, ...props }: AcademicBarChartProps) {
  const option = useCallback<ChartOptionFactory>((theme) =>
    buildBarOption(data, title, theme), [data, title]);
  const invalid = data.some((point) => !Number.isFinite(point.value) || point.value < 0);
  return <BaseChart {...props} title={title} option={option}
    empty={data.length === 0} invalid={invalid} />;
}
