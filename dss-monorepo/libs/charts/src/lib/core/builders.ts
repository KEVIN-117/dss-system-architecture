import type { EChartsOption } from 'echarts';
import {
  ChartThemeTokens,
  DARK_SEQUENTIAL_COLORS,
  DEFAULT_DARK_THEME,
  isDarkColor,
  labelInkFor,
  LIGHT_SEQUENTIAL_COLORS,
} from './theme';

export interface ChartDataPoint {
  label: string;
  value: number;
  tone?: 'default' | 'success' | 'warning' | 'destructive';
}

/**
 * Builds the ECharts option for an Academic Bar Chart.
 */
export function buildBarOption(
  data: ChartDataPoint[],
  title?: string,
  theme: ChartThemeTokens = DEFAULT_DARK_THEME,
): EChartsOption {
  const primary = theme.primary ?? theme.chartColors[0];

  return {
    backgroundColor: 'transparent',
    color: theme.chartColors, // Saiku-UI categorical palette
    title: title
      ? {
          text: title,
          left: 'center',
          top: 0,
          textStyle: { color: theme.foreground },
        }
      : undefined,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: theme.alpha(theme.background, 0.8),
      borderColor: theme.alpha(primary, 0.3),
      textStyle: { color: theme.foreground },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.label),
      axisTick: { alignWithLabel: true },
      axisLine: { lineStyle: { color: theme.alpha(primary, 0.2) } },
      axisLabel: {
        color: theme.mutedForeground,
        hideOverlap: true,
        overflow: 'truncate',
        width: 90,
      },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: theme.alpha(primary, 0.2) } },
      axisLabel: {
        color: theme.mutedForeground,
        hideOverlap: true,
        overflow: 'truncate',
        width: 90,
      },
      splitLine: {
        lineStyle: {
          color: theme.gridLine,
          type: 'dashed',
        },
      },
    },
    series: [
      {
        name: 'Value',
        type: 'bar',
        barWidth: '40%',
        data: data.map((d) => d.value),
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: primary,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 15,
            shadowColor: theme.alpha(primary, 0.5),
          },
        },
      },
    ],
  };
}

export function buildDonutOption(
  data: ChartDataPoint[],
  title?: string,
  theme: ChartThemeTokens = DEFAULT_DARK_THEME,
  width = 640,
): EChartsOption {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const compact = width < 480;

  return {
    backgroundColor: 'transparent',
    color: theme.chartColors,

    // Accesibilidad: descripción textual para lectores de pantalla
    aria: {
      enabled: true,
      label: {
        enabled: true,
        description: `${title ?? 'Gráfico de dona'}. ${data
          .map(
            (d) =>
              `${d.label}: ${d.value} (${total ? ((d.value / total) * 100).toFixed(0) : 0}%)`,
          )
          .join('. ')}.`,
      },
    },

    tooltip: {
      trigger: 'item',
      confine: true,
      extraCssText: `max-width: ${Math.max(0, width - 32)}px; white-space: normal; overflow-wrap: anywhere;`,
      backgroundColor: theme.alpha(theme.background, 0.9),
      textStyle: { color: theme.foreground },
    },

    title: title
      ? {
          text: title,
          left: 'center',
          textStyle: {
            color: theme.foreground,
            fontSize: 14,
            width: Math.max(width - 32, 0),
            overflow: 'truncate',
          },
        }
      : undefined,
    legend: {
      type: 'scroll',
      orient: 'horizontal',
      left: 'center',
      right: 12,
      bottom: 0,
      icon: 'roundRect',
      itemGap: 14,
      textStyle: {
        color: theme.foreground,
        fontSize: 13,
        width: Math.max(80, Math.min(200, width - 110)),
        overflow: 'truncate',
      },
      // Muestra el % directamente en la leyenda, no solo el nombre
      formatter: (name: string) => {
        const item = data.find((d) => d.label === name);
        const pct =
          item && total ? ((item.value / total) * 100).toFixed(0) : '0';
        return `${name}: ${pct}%`;
      },
    },

    series: [
      {
        name: 'Risk Level',
        type: 'pie',
        radius: compact ? ['32%', '52%'] : ['35%', '58%'],
        center: ['50%', '42%'],
        stillShowZeroSum: false,
        avoidLabelOverlap: true,
        padAngle: 5,
        itemStyle: {
          borderRadius: 6,
          borderColor: theme.background,
          borderWidth: 2,
        },
        label: {
          show: false,
          position: 'outer',
          formatter: '{d}%',
          color: theme.foreground,
          fontSize: 13,
          fontWeight: 'bold',
        },
        labelLine: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 6,
          label: { fontSize: 15, fontWeight: 'bold', color: theme.foreground },
          itemStyle: {
            shadowBlur: 15,
            shadowColor: theme.alpha(theme.foreground, 0.3),
          },
        },
        data: data.map((d, index) => {
          const color =
            d.tone === 'destructive'
              ? theme.riskColors.high
              : d.tone === 'warning'
                ? theme.riskColors.medium
                : d.tone === 'success'
                  ? theme.riskColors.none
                  : theme.chartColors[index % theme.chartColors.length];
          return {
            value: d.value,
            name: d.label,
            itemStyle: { color },
          };
        }),
      },
    ],
  };
}

/**
 * Builds the ECharts option for a Trend Line Chart.
 */
export function buildLineOption(
  data: ChartDataPoint[],
  title?: string,
  theme: ChartThemeTokens = DEFAULT_DARK_THEME,
): EChartsOption {
  const primary = theme.primary ?? theme.chartColors[0];

  return {
    backgroundColor: 'transparent',
    color: theme.chartColors, // Saiku-UI categorical palette
    title: title
      ? {
          text: title,
          left: 'center',
          top: 0,
          textStyle: { color: theme.foreground },
        }
      : undefined,
    tooltip: {
      trigger: 'axis',
      backgroundColor: theme.alpha(theme.background, 0.8),
      borderColor: theme.alpha(primary, 0.3),
      textStyle: { color: theme.foreground },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map((d) => d.label),
      axisLine: { lineStyle: { color: theme.alpha(primary, 0.2) } },
      axisLabel: {
        color: theme.mutedForeground,
        hideOverlap: true,
        overflow: 'truncate',
        width: 90,
      },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: theme.alpha(primary, 0.2) } },
      axisLabel: {
        color: theme.mutedForeground,
        hideOverlap: true,
        overflow: 'truncate',
        width: 90,
      },
      splitLine: {
        lineStyle: {
          color: theme.gridLine,
          type: 'dashed',
        },
      },
    },
    series: [
      {
        name: 'Trend',
        type: 'line',
        smooth: true,
        data: data.map((d) => d.value),
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
              { offset: 1, color: theme.alpha(primary, 0.05) },
            ],
          },
        },
      },
    ],
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
  theme: ChartThemeTokens = DEFAULT_DARK_THEME,
): EChartsOption {
  return {
    backgroundColor: 'transparent',
    color: theme.chartColors,
    title: title
      ? {
          text: title,
          left: 'center',
          top: 0,
          textStyle: { color: theme.foreground },
        }
      : undefined,
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: theme.mutedForeground,
        },
      },
      backgroundColor: theme.alpha(theme.background, 0.8),
      borderColor: theme.alpha(theme.chartColors[0], 0.3),
      textStyle: { color: theme.foreground },
    },
    legend: {
      data: data.series.map((s) => s.name),
      top: 30,
      textStyle: { color: theme.foreground },
    },
    toolbox: {
      feature: {
        saveAsImage: {
          name: title ? title.replace(/\s+/g, '_').toLowerCase() : 'chart',
          title: 'Guardar',
        },
      },
      iconStyle: {
        borderColor: theme.mutedForeground,
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: title ? 70 : 50,
      containLabel: true,
    },
    xAxis: [
      {
        type: 'category',
        boundaryGap: false,
        data: data.categories,
        axisLine: {
          lineStyle: { color: theme.alpha(theme.chartColors[0], 0.2) },
        },
        axisLabel: {
          color: theme.mutedForeground,
          hideOverlap: true,
          overflow: 'truncate',
          width: 90,
        },
      },
    ],
    yAxis: [
      {
        type: 'value',
        axisLine: {
          lineStyle: { color: theme.alpha(theme.chartColors[0], 0.2) },
        },
        axisLabel: {
          color: theme.mutedForeground,
          hideOverlap: true,
          overflow: 'truncate',
          width: 90,
        },
        splitLine: {
          lineStyle: {
            color: theme.gridLine,
            type: 'dashed',
          },
        },
      },
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
          width: 0,
        },
        showSymbol: false,
        label: {
          show: isLast,
          position: 'top',
          color: theme.foreground,
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
              { offset: 1, color: theme.alpha(baseColor, 0.1) },
            ],
          },
        },
        emphasis: {
          focus: 'series',
        },
        data: s.data,
      };
    }),
  };
}

export interface ScatterDataPoint {
  x: number;
  y: number;
  name?: string;
  size?: number;
}

export interface ClusteringChartData {
  clusters: Array<{
    name: string;
    data: ScatterDataPoint[];
  }>;
}

export interface RegressionChartData {
  points: ScatterDataPoint[];
  line: ScatterDataPoint[];
}

export function buildScatterOption(
  data: ScatterDataPoint[],
  title?: string,
  theme: ChartThemeTokens = DEFAULT_DARK_THEME,
): EChartsOption {
  const primary = theme.primary ?? theme.chartColors[0];
  return {
    backgroundColor: 'transparent',
    color: theme.chartColors,
    title: title
      ? {
          text: title,
          left: 'center',
          top: 0,
          textStyle: { color: theme.foreground },
        }
      : undefined,
    tooltip: {
      trigger: 'item',
      backgroundColor: theme.alpha(theme.background, 0.8),
      borderColor: theme.alpha(primary, 0.3),
      textStyle: { color: theme.foreground },
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'value',
      scale: true,
      axisLine: { lineStyle: { color: theme.alpha(primary, 0.2) } },
      axisLabel: {
        color: theme.mutedForeground,
        hideOverlap: true,
        overflow: 'truncate',
        width: 90,
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLine: { lineStyle: { color: theme.alpha(primary, 0.2) } },
      axisLabel: {
        color: theme.mutedForeground,
        hideOverlap: true,
        overflow: 'truncate',
        width: 90,
      },
      splitLine: { lineStyle: { color: theme.gridLine, type: 'dashed' } },
    },
    series: [
      {
        type: 'scatter',
        symbolSize: (data: number[]) => data[2] || 10,
        data: data.map((d) => [d.x, d.y, d.size || 10, d.name]),
        // Solid marks with a surface ring: translucent fills wash out on
        // dark surfaces and turn overlaps into new, unlabelled colours.
        itemStyle: {
          color: primary,
          borderColor: theme.background,
          borderWidth: 1.5,
        },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: primary },
        },
      },
    ],
  };
}

export function buildClusteringScatterOption(
  data: ClusteringChartData,
  title?: string,
  theme: ChartThemeTokens = DEFAULT_DARK_THEME,
): EChartsOption {
  return {
    backgroundColor: 'transparent',
    color: theme.chartColors,
    title: title
      ? {
          text: title,
          left: 'center',
          top: 0,
          textStyle: { color: theme.foreground },
        }
      : undefined,
    tooltip: {
      trigger: 'item',
      backgroundColor: theme.alpha(theme.background, 0.8),
      textStyle: { color: theme.foreground },
    },
    legend: { top: 30, textStyle: { color: theme.foreground } },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: title ? 70 : 50,
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      scale: true,
      axisLine: {
        lineStyle: { color: theme.alpha(theme.chartColors[0], 0.2) },
      },
      axisLabel: {
        color: theme.mutedForeground,
        hideOverlap: true,
        overflow: 'truncate',
        width: 90,
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLine: {
        lineStyle: { color: theme.alpha(theme.chartColors[0], 0.2) },
      },
      axisLabel: {
        color: theme.mutedForeground,
        hideOverlap: true,
        overflow: 'truncate',
        width: 90,
      },
      splitLine: { lineStyle: { color: theme.gridLine, type: 'dashed' } },
    },
    series: data.clusters.map((cluster, index) => {
      const color = theme.chartColors[index % theme.chartColors.length];
      return {
        name: cluster.name,
        type: 'scatter',
        symbolSize: 12,
        data: cluster.data.map((d) => [d.x, d.y, d.name]),
        itemStyle: {
          color,
          borderColor: theme.background,
          borderWidth: 1.5,
        },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: color } },
      };
    }),
  };
}

export function buildRegressionScatterOption(
  data: RegressionChartData,
  title?: string,
  theme: ChartThemeTokens = DEFAULT_DARK_THEME,
): EChartsOption {
  const primary = theme.primary ?? theme.chartColors[0];
  const secondary = theme.chartColors[1] || theme.destructive;
  return {
    backgroundColor: 'transparent',
    title: title
      ? {
          text: title,
          left: 'center',
          top: 0,
          textStyle: { color: theme.foreground },
        }
      : undefined,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: theme.alpha(theme.background, 0.8),
      textStyle: { color: theme.foreground },
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'value',
      scale: true,
      axisLine: { lineStyle: { color: theme.alpha(primary, 0.2) } },
      axisLabel: {
        color: theme.mutedForeground,
        hideOverlap: true,
        overflow: 'truncate',
        width: 90,
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLine: { lineStyle: { color: theme.alpha(primary, 0.2) } },
      axisLabel: {
        color: theme.mutedForeground,
        hideOverlap: true,
        overflow: 'truncate',
        width: 90,
      },
      splitLine: { lineStyle: { color: theme.gridLine, type: 'dashed' } },
    },
    series: [
      {
        name: 'Datos',
        type: 'scatter',
        symbolSize: 8,
        data: data.points.map((d) => [d.x, d.y]),
        itemStyle: {
          color: primary,
          borderColor: theme.background,
          borderWidth: 1.5,
        },
      },
      {
        name: 'Regresión',
        type: 'line',
        showSymbol: false,
        smooth: true,
        data: data.line.map((d) => [d.x, d.y]),
        lineStyle: { color: secondary, width: 3, type: 'solid' },
      },
    ],
  };
}

export interface RadarIndicator {
  name: string;
  max: number;
}
export interface RadarChartData {
  indicators: RadarIndicator[];
  series: Array<{
    name: string;
    value: number[];
  }>;
}

export function buildRadarOption(
  data: RadarChartData,
  title?: string,
  theme: ChartThemeTokens = DEFAULT_DARK_THEME,
): EChartsOption {
  return {
    backgroundColor: 'transparent',
    color: theme.chartColors,
    title: title
      ? {
          text: title,
          left: 'center',
          top: 0,
          textStyle: { color: theme.foreground },
        }
      : undefined,
    tooltip: {
      trigger: 'item',
      backgroundColor: theme.alpha(theme.background, 0.8),
      textStyle: { color: theme.foreground },
    },
    legend: {
      bottom: 0,
      textStyle: { color: theme.foreground },
    },
    radar: {
      indicator: data.indicators,
      splitArea: { show: false },
      splitLine: {
        lineStyle: { color: theme.alpha(theme.chartColors[0], 0.2) },
      },
      axisLine: {
        lineStyle: { color: theme.alpha(theme.chartColors[0], 0.2) },
      },
      axisName: { color: theme.mutedForeground },
    },
    series: [
      {
        type: 'radar',
        data: data.series.map((s) => ({
          name: s.name,
          value: s.value,
          areaStyle: { opacity: 0.2 },
          lineStyle: { width: 2 },
        })),
      },
    ],
  };
}

export interface HeatmapChartData {
  xAxisLabels: string[];
  yAxisLabels: string[];
  data: Array<[number, number, number]>;
  min?: number;
  max?: number;
}

export function buildHeatmapOption(
  data: HeatmapChartData,
  title?: string,
  theme: ChartThemeTokens = DEFAULT_DARK_THEME,
): EChartsOption {
  const ramp = theme.sequentialColors?.length
    ? theme.sequentialColors
    : isDarkColor(theme.background)
      ? DARK_SEQUENTIAL_COLORS
      : LIGHT_SEQUENTIAL_COLORS;
  return {
    backgroundColor: 'transparent',
    title: title
      ? {
          text: title,
          left: 'center',
          top: 0,
          textStyle: { color: theme.foreground },
        }
      : undefined,
    tooltip: {
      position: 'top',
      backgroundColor: theme.alpha(theme.background, 0.8),
      textStyle: { color: theme.foreground },
    },
    grid: {
      left: '5%',
      // The colour ramp sits in this right gutter, clear of the axis labels.
      right: 88,
      bottom: 16,
      top: title ? 60 : 20,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data.xAxisLabels,
      splitArea: { show: true, areaStyle: { color: ['transparent'] } },
      axisLabel: {
        color: theme.mutedForeground,
        hideOverlap: true,
        overflow: 'truncate',
        width: 90,
      },
      axisLine: {
        lineStyle: { color: theme.alpha(theme.chartColors[0], 0.2) },
      },
    },
    yAxis: {
      type: 'category',
      data: data.yAxisLabels,
      splitArea: { show: true, areaStyle: { color: ['transparent'] } },
      axisLabel: {
        color: theme.mutedForeground,
        hideOverlap: true,
        overflow: 'truncate',
        width: 90,
      },
      axisLine: {
        lineStyle: { color: theme.alpha(theme.chartColors[0], 0.2) },
      },
    },
    visualMap: {
      min: data.min ?? 0,
      max: data.max ?? 100,
      // Vertical ramp in the right gutter: a horizontal ramp under the plot
      // collided with the category labels of the x-axis.
      calculable: false,
      orient: 'vertical',
      right: 8,
      top: 'middle',
      itemWidth: 12,
      itemHeight: 140,
      // Without drag handles a continuous ramp shows no end labels on its own.
      text: [String(data.max ?? 100), String(data.min ?? 0)],
      textStyle: { color: theme.mutedForeground },
      // Magnitude is a one-hue ramp, never a red/amber/green traffic light:
      // that pair collapses under red-green colour blindness.
      inRange: { color: ramp },
    },
    series: [
      {
        name: 'Valor',
        type: 'heatmap',
        // Each cell picks the label ink that contrasts with its own ramp step,
        // so values stay readable on both the pale and the deep end.
        data: data.data.map((cell) => {
          const value = cell[2];
          const min = data.min ?? 0;
          const max = data.max ?? 100;
          const t = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;
          const fill = ramp[Math.round(t * (ramp.length - 1))];
          return {
            value: cell,
            label: { color: fill ? labelInkFor(fill) : theme.foreground },
          };
        }),
        label: {
          show: true,
          color: theme.foreground,
        },
        itemStyle: {
          borderColor: theme.background,
          borderWidth: 2,
        },
      },
    ],
  };
}

export interface SunburstNode {
  name: string;
  value?: number;
  children?: SunburstNode[];
}

export function buildSunburstOption(
  data: SunburstNode[],
  title?: string,
  theme: ChartThemeTokens = DEFAULT_DARK_THEME,
): EChartsOption {
  return {
    backgroundColor: 'transparent',
    color: theme.chartColors,
    title: title
      ? {
          text: title,
          left: 'center',
          top: 0,
          textStyle: { color: theme.foreground },
        }
      : undefined,
    tooltip: {
      trigger: 'item',
      backgroundColor: theme.alpha(theme.background, 0.8),
      textStyle: { color: theme.foreground },
    },
    series: {
      type: 'sunburst',
      data: data,
      // Leave the title band free; a full-height ring drew across the title.
      center: ['50%', title ? '54%' : '50%'],
      radius: [0, title ? '82%' : '92%'],
      itemStyle: {
        borderRadius: 4,
        borderWidth: 3,
        borderColor: theme.background,
      },
      label: {
        rotate: 'radial',
        color: theme.foreground,
        // A surface-coloured halo keeps the text legible on any fill.
        textBorderColor: theme.background,
        textBorderWidth: 2,
        // Thin slices drop their label (the tooltip still names them) instead
        // of piling unreadable text on top of each other.
        minAngle: 22,
        overflow: 'truncate',
        width: 72,
      },
      // Radial labels near the centre still meet each other: drop the ones
      // that collide rather than stacking them.
      labelLayout: { hideOverlap: true },
    },
  };
}

export interface SankeyNode {
  name: string;
}
export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}
export interface SankeyChartData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

export function buildSankeyOption(
  data: SankeyChartData,
  title?: string,
  theme: ChartThemeTokens = DEFAULT_DARK_THEME,
): EChartsOption {
  return {
    backgroundColor: 'transparent',
    color: theme.chartColors,
    title: title
      ? {
          text: title,
          left: 'center',
          top: 0,
          textStyle: { color: theme.foreground },
        }
      : undefined,
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      backgroundColor: theme.alpha(theme.background, 0.8),
      textStyle: { color: theme.foreground },
    },
    series: [
      {
        type: 'sankey',
        data: data.nodes,
        links: data.links,
        emphasis: {
          focus: 'adjacency',
        },
        lineStyle: {
          color: 'gradient',
          curveness: 0.5,
          opacity: 0.4,
        },
        itemStyle: {
          borderColor: theme.background,
          borderWidth: 1,
        },
        label: {
          color: theme.foreground,
          fontSize: 12,
        },
      },
    ],
  };
}
