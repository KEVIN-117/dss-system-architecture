import type { CSSProperties } from 'react';
import type { ECElementEvent, EChartsOption } from 'echarts';
import type { ChartThemeTokens, ChartThemeOverrides } from './theme';

/** Unmodified ECharts event. No ECharts dependency is needed in a consumer. */
export type ChartClickEvent = ECElementEvent;
export type ChartOption = EChartsOption;
export type ChartOptionFactory = (theme: ChartThemeTokens, width: number) => ChartOption;

export interface CommonChartProps {
  title?: string;
  loading?: boolean;
  onChartClick?: (event: ChartClickEvent) => void;
  className?: string;
  themeTokens?: ChartThemeOverrides;
  height?: CSSProperties['height'];
  style?: CSSProperties;
  ariaLabel?: string;
  emptyMessage?: string;
}
