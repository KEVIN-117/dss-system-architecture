'use client';

import { useCallback } from 'react';
import { BaseChart } from './base-chart';
import { buildSankeyOption } from '../core/builders';
import type { SankeyChartData } from '../core/builders';
import type { ChartOptionFactory, CommonChartProps } from '../core/types';

export interface SankeyChartProps extends CommonChartProps {
  data: SankeyChartData;
}

export function AcademicSankeyChart({ data, title, ...props }: SankeyChartProps) {
  const option = useCallback<ChartOptionFactory>((theme) =>
    buildSankeyOption(data, title, theme), [data, title]);
  return <BaseChart {...props} title={title} option={option}
    empty={data.nodes.length === 0} />;
}
