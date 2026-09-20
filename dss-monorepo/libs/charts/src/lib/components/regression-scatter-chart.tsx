'use client';

import { useCallback } from 'react';
import { BaseChart } from './base-chart';
import { buildRegressionScatterOption } from '../core/builders';
import type { RegressionChartData } from '../core/builders';
import type { ChartOptionFactory, CommonChartProps } from '../core/types';

export interface RegressionScatterChartProps extends CommonChartProps {
  data: RegressionChartData;
}

export function RegressionScatterChart({ data, title, ...props }: RegressionScatterChartProps) {
  const option = useCallback<ChartOptionFactory>((theme) =>
    buildRegressionScatterOption(data, title, theme), [data, title]);
  return <BaseChart {...props} title={title} option={option}
    empty={data.points.length === 0 && data.line.length === 0} />;
}
