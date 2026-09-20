'use client';

import { useCallback } from 'react';
import { BaseChart } from './base-chart';
import { buildSunburstOption } from '../core/builders';
import type { SunburstNode } from '../core/builders';
import type { ChartOptionFactory, CommonChartProps } from '../core/types';

export interface SunburstChartProps extends CommonChartProps {
  data: SunburstNode[];
}

export function AcademicSunburstChart({ data, title, ...props }: SunburstChartProps) {
  const option = useCallback<ChartOptionFactory>((theme) =>
    buildSunburstOption(data, title, theme), [data, title]);
  return <BaseChart {...props} title={title} option={option}
    empty={data.length === 0} />;
}
