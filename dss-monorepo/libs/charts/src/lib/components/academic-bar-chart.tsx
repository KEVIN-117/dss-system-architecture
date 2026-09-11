import React, { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import { ChartThemeTokens, DEFAULT_DARK_THEME } from '../core/theme';
import { buildBarOption, ChartDataPoint } from '../core/builders';

export interface AcademicBarChartProps {
  data: ChartDataPoint[];
  title?: string;
  loading?: boolean;
  onChartClick?: (params: any) => void;
  className?: string;
  themeTokens?: ChartThemeTokens;
}

export const AcademicBarChart: React.FC<AcademicBarChartProps> = ({ 
  data, 
  title, 
  loading, 
  onChartClick, 
  className,
  themeTokens = DEFAULT_DARK_THEME
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const option = useMemo(() => {
    return buildBarOption(data, title, themeTokens);
  }, [data, title, themeTokens]);

  useEffect(() => {
    if (!chartRef.current) return;
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, { renderer: 'canvas' });
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
        color: themeTokens.chartColors[0],
        textColor: themeTokens.chartColors[0],
        maskColor: themeTokens.alpha(themeTokens.background, 0.8),
        zlevel: 0,
        fontFamily: 'monospace'
      });
    } else {
      chartInstance.current.hideLoading();
    }
  }, [loading, themeTokens]);

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
      className={className || "w-full h-full"} 
      style={{ width: '100%', minHeight: '300px', height: '100%' }}
    />
  );
};
