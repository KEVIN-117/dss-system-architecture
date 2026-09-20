'use client';

import { useCallback } from 'react';
import { BaseChart } from './base-chart';
import { buildClusteringScatterOption } from '../core/builders';
import type { ClusteringChartData } from '../core/builders';
import type { ChartOptionFactory, CommonChartProps } from '../core/types';

export interface ClusteringScatterChartProps extends CommonChartProps {
  data: ClusteringChartData;
}

export function ClusteringScatterChart({ data, title, ...props }: ClusteringScatterChartProps) {
  const option = useCallback<ChartOptionFactory>((theme) =>
    buildClusteringScatterOption(data, title, theme), [data, title]);
  return <BaseChart {...props} title={title} option={option}
    empty={data.clusters.every((cluster) => cluster.data.length === 0)} />;
}
