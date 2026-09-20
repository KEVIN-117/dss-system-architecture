import type { Meta, StoryObj } from '@storybook/react-vite';
import { AcademicHeatmapChart } from './heatmap-chart';

const meta: Meta<typeof AcademicHeatmapChart> = {
  title: 'Charts/AcademicHeatmapChart',
  component: AcademicHeatmapChart,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AcademicHeatmapChart>;

export const Default: Story = {
  args: {
    title: 'Tasa de Reprobación por Asignatura y Semestre',
    data: {
      xAxisLabels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
      yAxisLabels: ['Cálculo I', 'Física I', 'Álgebra', 'Programación'],
      data: [
        [0, 0, 45],
        [1, 0, 30],
        [2, 0, 15],
        [3, 0, 5],
        [0, 1, 60],
        [1, 1, 55],
        [2, 1, 20],
        [3, 1, 10],
        [0, 2, 25],
        [1, 2, 40],
        [2, 2, 35],
        [3, 2, 12],
        [0, 3, 15],
        [1, 3, 20],
        [2, 3, 10],
        [3, 3, 8],
      ],
    },
  },
};
