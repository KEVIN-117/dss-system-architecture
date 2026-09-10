import React, { useMemo } from 'react';
import { BaseChart } from './base-chart';

export interface AcademicBarChartProps {
  data: Array<{ label: string; value: number }>;
  title?: string;
  loading?: boolean;
  onChartClick?: (params: any) => void;
  className?: string;
}

export const AcademicBarChart: React.FC<AcademicBarChartProps> = ({ 
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
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: data.map(d => d.label),
        axisTick: { alignWithLabel: true }
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: 'Value',
          type: 'bar',
          barWidth: '40%',
          data: data.map(d => d.value),
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: 'hsl(var(--primary))'
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 15,
              shadowColor: 'hsl(var(--primary) / 0.5)'
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
