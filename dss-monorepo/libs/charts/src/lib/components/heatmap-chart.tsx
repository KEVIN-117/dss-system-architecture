'use client';

import { useCallback } from 'react';
import { BaseChart } from './base-chart';
import { buildHeatmapOption } from '../core/builders';
import type { HeatmapChartData } from '../core/builders';
import type { ChartOptionFactory, CommonChartProps } from '../core/types';

export interface HeatmapChartProps extends CommonChartProps {
  data: HeatmapChartData;
}

export function AcademicHeatmapChart({ data, title, ...props }: HeatmapChartProps) {
  const option = useCallback<ChartOptionFactory>((theme) =>
    buildHeatmapOption(data, title, theme), [data, title]);
  return <BaseChart {...props} title={title} option={option}
    empty={data.data.length === 0} />;
}
