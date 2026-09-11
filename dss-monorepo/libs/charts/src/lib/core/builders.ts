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
/**
 * Clasifica una etiqueta de riesgo en un nivel semántico fijo.
 * Usa coincidencia por palabra completa, no `includes` suelto,
 * para no confundir "Riesgo Alto" con "Sin Riesgo".
 */
function getRiskLevel(label: string): 'high' | 'medium' | 'none' {
  const words = label.toLowerCase().split(/\s+/);
  if (words.includes('alto') || words.includes('peligro') || words.includes('high')) return 'high';
  if (words.includes('medio') || words.includes('medium')) return 'medium';
  return 'none'; // "Sin Riesgo", "Bajo", "None", etc.
}

export function buildDonutOption(
  data: ChartDataPoint[],
  title?: string,
  theme: ChartThemeTokens = DEFAULT_DARK_THEME
): EChartsOption {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return {
    backgroundColor: 'transparent',
    color: theme.chartColors,

    // Accesibilidad: descripción textual para lectores de pantalla
    aria: {
      enabled: true,
      decal: { show: false },
      label: {
        enabled: true,
        description: `${title ?? 'Gráfico de dona'}. ${data
          .map(d => `${d.label}: ${d.value} (${total ? ((d.value / total) * 100).toFixed(0) : 0}%)`)
          .join('. ')}.`,
      },
    },

    tooltip: {
      trigger: 'item',
      backgroundColor: theme.alpha(theme.background, 0.9),
      textStyle: { color: theme.foreground }
    },

    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'middle',
      icon: 'roundRect',
      itemGap: 14,
      textStyle: { color: theme.foreground, fontSize: 13 },
      // Muestra el % directamente en la leyenda, no solo el nombre
      formatter: (name: string) => {
        const item = data.find(d => d.label === name);
        const pct = item && total ? ((item.value / total) * 100).toFixed(0) : '0';
        return `${name}: ${pct}%`;
      },
    },

    series: [
      {
        name: 'Risk Level',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: true,
        padAngle: 5,
        itemStyle: {
          borderRadius: 6,
          borderColor: theme.background,
          borderWidth: 2
        },
        label: {
          show: true, // visible siempre, no solo en hover
          position: 'outer',
          formatter: '{d}%',
          color: theme.foreground,
          fontSize: 20,
          fontWeight: 'bold'
        },
        labelLine: { show: true, length: 10, length2: 10 },
        emphasis: {
          scale: true,
          scaleSize: 6,
          label: { fontSize: 40, fontWeight: 'bold', color: theme.foreground },
          itemStyle: {
            shadowBlur: 15,
            shadowColor: theme.alpha(theme.foreground, 0.3)
          }
        },
        data: data.map(d => {
          const level = getRiskLevel(d.label);
          return {
            value: d.value,
            name: d.label,
            itemStyle: { color: theme.riskColors[level] },
          };
        })
      }
    ],
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

export interface MultiSeriesChartData {
  categories: string[];
  series: Array<{
    name: string;
    data: number[];
  }>;
}

/**
 * Builds the ECharts option for a Gradient Stacked Area Chart.
 */
export function buildStackedAreaOption(
  data: MultiSeriesChartData,
  title?: string,
  theme: ChartThemeTokens = DEFAULT_DARK_THEME
): EChartsOption {
  return {
    backgroundColor: 'transparent',
    color: theme.chartColors,
    title: title ? {
      text: title,
      left: 'center',
      top: 0,
      textStyle: { color: theme.foreground }
    } : undefined,
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: theme.mutedForeground
        }
      },
      backgroundColor: theme.alpha(theme.background, 0.8),
      borderColor: theme.alpha(theme.chartColors[0], 0.3),
      textStyle: { color: theme.foreground }
    },
    legend: {
      data: data.series.map(s => s.name),
      top: 30,
      textStyle: { color: theme.foreground }
    },
    toolbox: {
      feature: {
        saveAsImage: {
          name: title ? title.replace(/\s+/g, '_').toLowerCase() : 'chart',
          title: 'Guardar'
        }
      },
      iconStyle: {
        borderColor: theme.mutedForeground
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: title ? 70 : 50,
      containLabel: true
    },
    xAxis: [
      {
        type: 'category',
        boundaryGap: false,
        data: data.categories,
        axisLine: { lineStyle: { color: theme.alpha(theme.chartColors[0], 0.2) } },
        axisLabel: { color: theme.mutedForeground }
      }
    ],
    yAxis: [
      {
        type: 'value',
        axisLine: { lineStyle: { color: theme.alpha(theme.chartColors[0], 0.2) } },
        axisLabel: { color: theme.mutedForeground },
        splitLine: { 
          lineStyle: { 
            color: theme.gridLine,
            type: 'dashed' 
          } 
        }
      }
    ],
    series: data.series.map((s, index) => {
      const baseColor = theme.chartColors[index % theme.chartColors.length];
      const isLast = index === data.series.length - 1;
      
      return {
        name: s.name,
        type: 'line',
        stack: 'Total',
        smooth: true,
        lineStyle: {
          width: 0
        },
        showSymbol: false,
        label: {
          show: isLast,
          position: 'top',
          color: theme.foreground
        },
        areaStyle: {
          opacity: 0.8,
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: theme.alpha(baseColor, 0.9) },
              { offset: 1, color: theme.alpha(baseColor, 0.1) }
            ]
          }
        },
        emphasis: {
          focus: 'series'
        },
        data: s.data
      };
    })
  };
}
