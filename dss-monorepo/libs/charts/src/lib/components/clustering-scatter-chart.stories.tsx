import type { Meta, StoryObj } from '@storybook/react';
import { ClusteringScatterChart } from './clustering-scatter-chart';
import { ClusteringChartData } from '../core/builders';

const meta: Meta<typeof ClusteringScatterChart> = {
  title: 'Charts/ClusteringScatterChart',
  component: ClusteringScatterChart,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    loading: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof ClusteringScatterChart>;

const mockData: ClusteringChartData = {
  clusters: [
    {
      name: 'Alto Rendimiento',
      data: [
        { x: 88, y: 85, name: 'Est. 201' },
        { x: 92, y: 90, name: 'Est. 202' },
        { x: 95, y: 94, name: 'Est. 203' },
        { x: 86, y: 82, name: 'Est. 204' },
        { x: 90, y: 88, name: 'Est. 205' },
        { x: 94, y: 92, name: 'Est. 206' },
        { x: 98, y: 97, name: 'Est. 207' },
      ],
    },
    {
      name: 'Rendimiento Regular',
      data: [
        { x: 68, y: 62, name: 'Est. 208' },
        { x: 72, y: 65, name: 'Est. 209' },
        { x: 75, y: 70, name: 'Est. 210' },
        { x: 65, y: 58, name: 'Est. 211' },
        { x: 78, y: 72, name: 'Est. 212' },
        { x: 70, y: 64, name: 'Est. 213' },
        { x: 74, y: 68, name: 'Est. 214' },
      ],
    },
    {
      name: 'En Riesgo de Deserción',
      data: [
        { x: 42, y: 35, name: 'Est. 215' },
        { x: 48, y: 40, name: 'Est. 216' },
        { x: 52, y: 45, name: 'Est. 217' },
        { x: 38, y: 30, name: 'Est. 218' },
        { x: 55, y: 46, name: 'Est. 219' },
        { x: 45, y: 38, name: 'Est. 220' },
        { x: 50, y: 42, name: 'Est. 221' },
      ],
    },
  ],
};

export const Default: Story = {
  args: {
    title: 'Segmentación de Estudiantes: Asistencia vs. Rendimiento (K-Means)',
    data: mockData,
  },
};

export const Loading: Story = {
  args: {
    title: 'Segmentación de Estudiantes: Asistencia vs. Rendimiento (K-Means)',
    data: mockData,
    loading: true,
  },
};
