'use client';

import { useCallback } from 'react';
import { BaseChart } from './base-chart';
import { buildScatterOption } from '../core/builders';
import type { ScatterDataPoint } from '../core/builders';
import type { ChartOptionFactory, CommonChartProps } from '../core/types';

export interface ScatterChartProps extends CommonChartProps {
  data: ScatterDataPoint[];
}

export function ScatterChart({ data, title, ...props }: ScatterChartProps) {
  const option = useCallback<ChartOptionFactory>((theme) =>
    buildScatterOption(data, title, theme), [data, title]);
  return <BaseChart {...props} title={title} option={option}
    empty={data.length === 0} />;
}
