import React, { useMemo } from 'react';
import { BaseChart } from './base-chart';

export interface TrendLineChartProps {
  data: Array<{ label: string; value: number }>;
  title?: string;
  loading?: boolean;
  onChartClick?: (params: any) => void;
  className?: string;
}

export const TrendLineChart: React.FC<TrendLineChartProps> = ({ 
  data, 
  title, 
  loading, 
  onChartClick, 
  className 
}) => {
  const option = useMemo(() => {
    return {
      title: title ? { text: title, left: 'center', top: 0 } : undefined,
      tooltip: {
        trigger: 'axis'
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.map(d => d.label)
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: 'Trend',
          type: 'line',
          smooth: true,
          data: data.map(d => d.value),
          symbolSize: 8,
          itemStyle: {
            color: 'hsl(var(--primary))',
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'hsl(var(--primary) / 0.5)' },
                { offset: 1, color: 'hsl(var(--primary) / 0.05)' }
              ]
            }
          }
        }
      ]
    };
  }, [data, title]);

  return (
    <BaseChart 
      option={option} 
      loading={loading} 
      onChartClick={onChartClick} 
      className={className} 
    />
  );
};
