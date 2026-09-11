import React, { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import { ChartThemeTokens, resolveChartTheme } from '../core/theme';
import {
  buildClusteringScatterOption,
  ClusteringChartData,
} from '../core/builders';

export interface ClusteringScatterChartProps {
  data: ClusteringChartData;
  title?: string;
  loading?: boolean;
  onChartClick?: (params: any) => void;
  className?: string;
  themeTokens?: ChartThemeTokens;
}

export const ClusteringScatterChart: React.FC<ClusteringScatterChartProps> = ({
  data,
  title,
  loading,
  onChartClick,
  className,
  themeTokens,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const resolvedTheme = useMemo(
    () => themeTokens ?? resolveChartTheme(),
    [themeTokens],
  );

  const option = useMemo(() => {
    return buildClusteringScatterOption(data, title, resolvedTheme);
  }, [data, title, resolvedTheme]);

  useEffect(() => {
    if (!chartRef.current) return;
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, {
        renderer: 'canvas',
      });
      if (onChartClick) {
        chartInstance.current.on('click', (params) => {
          onChartClick(params);
        });
      }
    }
    chartInstance.current.setOption(option, true);
  }, [option, onChartClick]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!chartInstance.current) return;
    if (loading) {
      chartInstance.current.showLoading('default', {
        text: 'LOADING...',
        color: resolvedTheme.chartColors[0],
        textColor: resolvedTheme.chartColors[0],
        maskColor: resolvedTheme.alpha(resolvedTheme.background, 0.8),
        zlevel: 0,
        fontFamily: 'monospace',
      });
    } else {
      chartInstance.current.hideLoading();
    }
  }, [loading, resolvedTheme]);

  useEffect(() => {
    if (!chartRef.current) return;
    const resizeObserver = new ResizeObserver(() => {
      if (chartInstance.current) {
        chartInstance.current.resize();
      }
    });
    resizeObserver.observe(chartRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div
      ref={chartRef}
      className={className || 'w-full h-full'}
      style={{ width: '100%', minHeight: '300px', height: '100%' }}
    />
  );
};
