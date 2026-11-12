import type { CSSProperties } from 'react';
import type { ECElementEvent, EChartsOption } from 'echarts';
import type { ChartThemeTokens, ChartThemeOverrides } from './theme';

/** Unmodified ECharts event. No ECharts dependency is needed in a consumer. */
export type ChartClickEvent = ECElementEvent;
export type ChartOption = EChartsOption;
export type ChartOptionFactory = (theme: ChartThemeTokens, width: number, height: number) => ChartOption;

export interface CommonChartProps {
  title?: string;
  loading?: boolean;
  onChartClick?: (event: ChartClickEvent) => void;
  className?: string;
  themeTokens?: ChartThemeOverrides;
  height?: number | string;
  style?: CSSProperties;
  /**
   * Short accessible name for the chart. It is prepended to the data summary
   * a builder provides, never a replacement for it.
   */
  ariaLabel?: string;
  /**
   * Adds directional line textures to every series so identity never depends
   * on colour alone. Always on while the OS forced-colours mode is active.
   */
  textures?: boolean;
  emptyMessage?: string;
  invalidMessage?: string;
}
