'use client';

import { useCallback } from 'react';
import { BaseChart } from './base-chart';
import { buildRadarOption } from '../core/builders';
import type { RadarChartData } from '../core/builders';
import type { ChartOptionFactory, CommonChartProps } from '../core/types';

export interface RadarChartProps extends CommonChartProps {
  data: RadarChartData;
}

export function AcademicRadarChart({ data, title, ...props }: RadarChartProps) {
  const option = useCallback<ChartOptionFactory>((theme) =>
    buildRadarOption(data, title, theme), [data, title]);
  return <BaseChart {...props} title={title} option={option}
    empty={data.indicators.length === 0 || data.series.length === 0} />;
}
