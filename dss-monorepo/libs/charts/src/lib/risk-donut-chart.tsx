import React, { useMemo } from 'react';
import { BaseChart } from './base-chart';

export interface RiskDonutChartProps {
  data: Array<{ label: string; value: number }>;
  title?: string;
  loading?: boolean;
  onChartClick?: (params: any) => void;
  className?: string;
}

export const RiskDonutChart: React.FC<RiskDonutChartProps> = ({ 
  data, 
  title, 
  loading, 
  onChartClick, 
  className 
}) => {
  const option = useMemo(() => {
    return {
      title: title ? { text: title, left: 'center', top: 'center' } : undefined,
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        textStyle: { color: 'hsl(var(--foreground))' }
      },
      series: [
        {
          name: 'Risk Level',
          type: 'pie',
          radius: ['50%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: 'hsl(var(--background))',
            borderWidth: 2
          },
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: '18',
              fontWeight: 'bold',
              color: 'hsl(var(--foreground))'
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          },
          labelLine: {
            show: false
          },
          data: data.map(d => ({
            value: d.value,
            name: d.label,
            // Automatically assign red hue to risk categories (crude logic, but effective for this demo)
            itemStyle: d.label.toLowerCase().includes('risk') || d.label.toLowerCase().includes('deserción') || d.label.toLowerCase().includes('peligro')
              ? { color: 'hsl(var(--destructive))' }
              : undefined
          }))
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
