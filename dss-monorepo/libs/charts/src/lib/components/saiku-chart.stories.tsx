import type { Meta, StoryObj } from '@storybook/react-vite';

import { SaikuChart, type SaikuChartProps } from './saiku-chart';
import { CHART_TYPES } from '../saiku/chart-types';
import type { ChartProjection } from '../saiku/build';

const quarterlyProjection: ChartProjection = {
  rowCategories: [
    '2024 Q1',
    '2024 Q2',
    '2024 Q3',
    '2024 Q4',
    '2025 Q1',
    '2025 Q2',
  ],
  columnCategories: ['Ventas', 'Costos', 'Margen'],
  matrix: [
    [125, 82, 43],
    [142, 91, 51],
    [138, 88, 50],
    [171, 101, 70],
    [164, 98, 66],
    [193, 112, 81],
  ],
};

const countryProjection: ChartProjection = {
  rowCategories: ['Bolivia', 'Peru', 'Argentina', 'Brazil', 'Chile'],
  columnCategories: ['Ventas'],
  matrix: [[48], [76], [95], [130], [62]],
};

const waterfallProjection: ChartProjection = {
  rowCategories: ['Base', 'Ventas', 'Costos', 'Impuestos', 'Cierre'],
  columnCategories: ['Cambio'],
  matrix: [[100], [35], [-18], [-9], [108]],
};

const donutProjection: ChartProjection = {
  rowCategories: ['Tecnología', 'Economía', 'Sociales', 'Salud', 'Derecho'],
  columnCategories: ['Participación'],
  matrix: [[32], [24], [19], [15], [10]],
};

const pieProjection: ChartProjection = {
  rowCategories: ['Tecnología', 'Economía', 'Sociales', 'Salud', 'Derecho'],
  columnCategories: ['Participación'],
  matrix: [[32], [24], [19], [15], [10]],
};

const sunburstProjection: ChartProjection = {
  rowCategories: ['Docencia', 'I+D', 'Servicios'],
  columnCategories: ['Presupuesto'],
  matrix: [[42], [28], [30]],
};

const meta: Meta<typeof SaikuChart> = {
  title: 'Charts/SaikuChart',
  component: SaikuChart,
  tags: ['autodocs'],
  argTypes: {
    chartType: {
      control: 'select',
      options: CHART_TYPES.map(({ id }) => id),
      description: 'Tipo de builder ECharts migrado de Saiku.',
    },
    projection: { control: false },
    geometry: { control: 'object' },
    options: { control: 'object' },
  },
  args: {
    chartType: 'bar',
    title: 'Indicadores trimestrales',
    projection: quarterlyProjection,
    height: 420,
  },
};

export default meta;
type Story = StoryObj<typeof SaikuChart>;

/** Usa el selector `chartType` para explorar todos los tipos soportados. */
export const Explorer: Story = {
  render: (args: SaikuChartProps) => (
    <SaikuChart
      {...args}
      projection={
        args.chartType === 'map'
          ? countryProjection
          : args.chartType === 'waterfall'
            ? waterfallProjection
            : quarterlyProjection
      }
    />
  ),
  args: {
    loading: false,
  },
};

export const Bar: Story = { args: { chartType: 'bar' } };
export const StackedBar: Story = { args: { chartType: 'stackedBar' } };
export const Line: Story = { args: { chartType: 'line' } };
export const StackedLine: Story = { args: { chartType: 'stackedLine' } };
export const Area: Story = { args: { chartType: 'area' } };
export const StackedArea: Story = { args: { chartType: 'stackedArea' } };
export const Pie: Story = {
  args: {
    chartType: 'pie',
    title: 'Participación por facultad',
    projection: pieProjection,
    height: 520,
    ariaLabel: 'Participación de estudiantes en cinco facultades',
  },
  parameters: {
    docs: {
      description: {
        story: 'Un solo gráfico permite comparar las cinco partes del total. Las etiquetas identifican cada categoría y el cursor muestra el valor exacto.',
      },
    },
  },
};
export const Donut: Story = {
  args: {
    chartType: 'donut',
    title: 'Distribución por facultad',
    projection: donutProjection,
    height: 520,
    ariaLabel: 'Participación de estudiantes por facultad',
  },
  parameters: {
    docs: {
      description: {
        story: 'Un único anillo facilita comparar la participación entre facultades. Pasa el cursor sobre un segmento para consultar su valor.',
      },
    },
  },
};
export const Treemap: Story = { args: { chartType: 'treemap' } };
export const Sunburst: Story = {
  args: {
    chartType: 'sunburst',
    title: 'Presupuesto por función',
    projection: sunburstProjection,
    height: 520,
    ariaLabel: 'Distribución presupuestaria entre tres funciones',
  },
  parameters: {
    docs: {
      description: {
        story: 'Vista de una sola medida con tres categorías para facilitar la comparación de proporciones. El cursor muestra el valor exacto de cada segmento.',
      },
    },
  },
};
export const Radar: Story = { args: { chartType: 'radar' } };
export const Bubble: Story = { args: { chartType: 'bubble' } };

export const ComboChart: Story = {
  args: {
    chartType: 'bar',
    title: 'Ventas y margen',
    options: {
      dualAxis: false,
      seriesType: { Margen: 'line' },
      showLegend: true,
      legendPosition: 'bottom',
    },
  },
};

export const Heatmap: Story = {
  args: {
    chartType: 'heatmap',
    title: 'Intensidad por trimestre',
    options: { showLegend: false, colorRamp: 'theme' },
  },
};

export const ScatterMeasures: Story = {
  args: {
    chartType: 'scatter',
    title: 'Costos frente a ventas',
    options: { xAxisLabel: 'Ventas', yAxisLabel: 'Costos', showLegend: false },
  },
};

export const Map: Story = {
  args: {
    chartType: 'map',
    title: 'Ventas por país',
    height: 520,
    projection: countryProjection,
    options: { colorRamp: 'theme', mapMissing: 'blank', showLegend: false },
  },
};

export const Waterfall: Story = {
  args: {
    chartType: 'waterfall',
    title: 'Variación trimestral',
    projection: waterfallProjection,
  },
};

export const ColourBlindSafe: Story = {
  args: {
    chartType: 'stackedBar',
    colorBlindSafe: true,
    title: 'Paleta accesible',
  },
};

export const Empty: Story = {
  args: {
    chartType: 'bar',
    title: 'Sin resultados',
    projection: { rowCategories: [], columnCategories: [], matrix: [] },
  },
};
