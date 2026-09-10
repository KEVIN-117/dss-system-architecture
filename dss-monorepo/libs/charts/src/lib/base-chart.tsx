import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

export interface BaseChartProps {
  option: echarts.EChartsOption;
  loading?: boolean;
  onChartClick?: (params: any) => void;
  className?: string;
}

// Custom ECharts theme to match our Cyberpunk Design System
// We register it once globally
const registerCyberpunkTheme = () => {
  if (echarts.getInstanceByDom(document.createElement('div'))) return; // Avoid re-registering if not needed, but there's no check, so we just try/catch
  
  const colors = [
    'hsl(var(--primary))',
    'hsl(var(--destructive))',
    'hsl(var(--muted-foreground))',
    '#00ffcc',
    '#ff00ff'
  ];

  echarts.registerTheme('cyberpunk', {
    color: colors,
    backgroundColor: 'transparent',
    textStyle: {
      fontFamily: 'var(--font-mono), monospace',
    },
    title: {
      textStyle: {
        color: 'hsl(var(--foreground))',
      },
    },
    line: {
      smooth: true,
    },
    tooltip: {
      backgroundColor: 'hsl(var(--background) / 0.8)',
      borderColor: 'hsl(var(--primary) / 0.3)',
      textStyle: {
        color: 'hsl(var(--foreground))',
      },
      padding: [8, 12],
      backdropFilter: 'blur(8px)',
      borderRadius: 8,
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: 'hsl(var(--primary) / 0.2)' } },
      axisLabel: { color: 'hsl(var(--muted-foreground))' },
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { lineStyle: { color: 'hsl(var(--primary) / 0.2)' } },
      axisLabel: { color: 'hsl(var(--muted-foreground))' },
      splitLine: { 
        lineStyle: { 
          color: 'hsl(var(--primary) / 0.1)',
          type: 'dashed' 
        } 
      },
    }
  });
};

export const BaseChart: React.FC<BaseChartProps> = ({ option, loading, onChartClick, className }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    registerCyberpunkTheme();
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize ECharts instance
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'cyberpunk', { renderer: 'canvas' });
      
      if (onChartClick) {
        chartInstance.current.on('click', (params) => {
          onChartClick(params);
        });
      }
    }

    // Set options
    chartInstance.current.setOption(option, true);

    return () => {
      // Cleanup on unmount
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [option, onChartClick]);

  useEffect(() => {
    if (!chartInstance.current) return;
    
    if (loading) {
      chartInstance.current.showLoading('default', {
        text: 'LOADING METRICS...',
        color: 'hsl(var(--primary))',
        textColor: 'hsl(var(--primary))',
        maskColor: 'hsl(var(--background) / 0.8)',
        zlevel: 0,
        fontFamily: 'var(--font-mono), monospace'
      });
    } else {
      chartInstance.current.hideLoading();
    }
  }, [loading]);

  useEffect(() => {
    if (!chartRef.current) return;
    
    const resizeObserver = new ResizeObserver(() => {
      if (chartInstance.current) {
        chartInstance.current.resize();
      }
    });
    
    resizeObserver.observe(chartRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Effect to handle theme changes. We listen to the HTML class attribute changes.
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class' || mutation.attributeName === 'data-theme') {
          // Re-render chart to apply new CSS variables
          if (chartInstance.current) {
            chartInstance.current.resize(); 
            // Workaround to force repaint in ECharts with CSS variables
            const currentOption = chartInstance.current.getOption();
            chartInstance.current.clear();
            chartInstance.current.setOption(currentOption);
          }
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div 
      ref={chartRef} 
      className={className || "w-full h-full min-h-[300px]"} 
    />
  );
};
