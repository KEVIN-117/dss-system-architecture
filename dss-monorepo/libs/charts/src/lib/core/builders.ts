import type { EChartsOption } from 'echarts';
import { ChartThemeTokens, DEFAULT_DARK_THEME } from './theme';

export interface ChartDataPoint {
  label: string;
  value: number;
}

/**
 * Builds the ECharts option for an Academic Bar Chart.
 */
export function buildBarOption(
  data: ChartDataPoint[],
  title?: string,
  theme: ChartThemeTokens = DEFAULT_DARK_THEME
): EChartsOption {
  const primary = theme.chartColors[0];
  
  return {
    backgroundColor: 'transparent',
    color: theme.chartColors, // Saiku-UI categorical palette
    title: title ? { 
      text: title, 
      left: 'center', 
      top: 0,
      textStyle: { color: theme.foreground }
    } : undefined,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: theme.alpha(theme.background, 0.8),
      borderColor: theme.alpha(primary, 0.3),
      textStyle: { color: theme.foreground }
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
      axisTick: { alignWithLabel: true },
      axisLine: { lineStyle: { color: theme.alpha(primary, 0.2) } },
      axisLabel: { color: theme.mutedForeground }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: theme.alpha(primary, 0.2) } },
      axisLabel: { color: theme.mutedForeground },
      splitLine: { 
        lineStyle: { 
          color: theme.gridLine,
          type: 'dashed' 
        } 
      }
    },
    series: [
      {
        name: 'Value',
        type: 'bar',
        barWidth: '40%',
        data: data.map(d => d.value),
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: primary
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 15,
            shadowColor: theme.alpha(primary, 0.5)
          }
        }
      }
    ]
  };
}

/**
 * Builds the ECharts option for a Risk Donut Chart.
 */
export function buildDonutOption(
  data: ChartDataPoint[],
  title?: string,
  theme: ChartThemeTokens = DEFAULT_DARK_THEME
): EChartsOption {
  const primary = theme.chartColors[0];
  
  return {
    backgroundColor: 'transparent',
    color: theme.chartColors, // Saiku-UI categorical palette
    title: title ? { 
      text: title, 
      left: 'center', 
      top: 'center',
      textStyle: { color: theme.foreground, fontSize: 16 }
    } : undefined,
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
      backgroundColor: theme.alpha(theme.background, 0.8),
      borderColor: theme.alpha(primary, 0.3),
      textStyle: { color: theme.foreground }
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      textStyle: { color: theme.foreground }
    },
    series: [
      {
        name: 'Risk Level',
        type: 'pie',
        radius: ['50%', '75%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: theme.background,
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 18,
            fontWeight: 'bold',
            color: theme.foreground
          },
          itemStyle: {
            shadowBlur: 15,
            shadowColor: theme.alpha(primary, 0.5)
          }
        },
        labelLine: {
          show: false
        },
        data: data.map((d, index) => {
          const lowerLabel = d.label.toLowerCase();
          const isRisk = lowerLabel.includes('risk') || lowerLabel.includes('riesgo') || lowerLabel.includes('deserción') || lowerLabel.includes('peligro') || lowerLabel.includes('alto');
          // Use saiku-ui cycle color or destructive for risk
          const defaultColor = theme.chartColors[index % theme.chartColors.length];
          return {
            value: d.value,
            name: d.label,
            itemStyle: { 
              color: isRisk ? theme.destructive : defaultColor
            }
          };
        })
      }
    ]
  };
}

/**
 * Builds the ECharts option for a Trend Line Chart.
 */
export function buildLineOption(
  data: ChartDataPoint[],
  title?: string,
  theme: ChartThemeTokens = DEFAULT_DARK_THEME
): EChartsOption {
  const primary = theme.chartColors[0];
  
  return {
    backgroundColor: 'transparent',
    color: theme.chartColors, // Saiku-UI categorical palette
    title: title ? { 
      text: title, 
      left: 'center', 
      top: 0,
      textStyle: { color: theme.foreground }
    } : undefined,
    tooltip: {
      trigger: 'axis',
      backgroundColor: theme.alpha(theme.background, 0.8),
      borderColor: theme.alpha(primary, 0.3),
      textStyle: { color: theme.foreground }
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
      data: data.map(d => d.label),
      axisLine: { lineStyle: { color: theme.alpha(primary, 0.2) } },
      axisLabel: { color: theme.mutedForeground }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: theme.alpha(primary, 0.2) } },
      axisLabel: { color: theme.mutedForeground },
      splitLine: { 
        lineStyle: { 
          color: theme.gridLine,
          type: 'dashed' 
        } 
      }
    },
    series: [
      {
        name: 'Trend',
        type: 'line',
        smooth: true,
        data: data.map(d => d.value),
        symbolSize: 8,
        itemStyle: {
          color: primary,
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: theme.alpha(primary, 0.5) },
              { offset: 1, color: theme.alpha(primary, 0.05) }
            ]
          }
        }
      }
    ]
  };
}
