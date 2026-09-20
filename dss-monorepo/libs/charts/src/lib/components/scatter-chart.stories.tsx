import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScatterChart } from './scatter-chart';
import { ScatterDataPoint } from '../core/builders';

const meta: Meta<typeof ScatterChart> = {
  title: 'Charts/ScatterChart',
  component: ScatterChart,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    loading: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof ScatterChart>;

const mockData: ScatterDataPoint[] = [
  { x: 55, y: 48, name: 'Estudiante 101', size: 10 },
  { x: 62, y: 54, name: 'Estudiante 102', size: 12 },
  { x: 70, y: 65, name: 'Estudiante 103', size: 14 },
  { x: 75, y: 72, name: 'Estudiante 104', size: 11 },
  { x: 80, y: 78, name: 'Estudiante 105', size: 15 },
  { x: 85, y: 82, name: 'Estudiante 106', size: 13 },
  { x: 90, y: 88, name: 'Estudiante 107', size: 16 },
  { x: 95, y: 94, name: 'Estudiante 108', size: 18 },
  { x: 50, y: 35, name: 'Estudiante 109', size: 9 },
  { x: 68, y: 59, name: 'Estudiante 110', size: 12 },
  { x: 73, y: 68, name: 'Estudiante 111', size: 14 },
  { x: 88, y: 85, name: 'Estudiante 112', size: 15 },
  { x: 92, y: 91, name: 'Estudiante 113', size: 17 },
  { x: 60, y: 51, name: 'Estudiante 114', size: 10 },
  { x: 78, y: 74, name: 'Estudiante 115', size: 13 },
  { x: 82, y: 79, name: 'Estudiante 116', size: 14 },
  { x: 65, y: 62, name: 'Estudiante 117', size: 11 },
  { x: 98, y: 96, name: 'Estudiante 118', size: 20 },
  { x: 58, y: 45, name: 'Estudiante 119', size: 10 },
  { x: 84, y: 80, name: 'Estudiante 120', size: 14 },
];

export const Default: Story = {
  args: {
    title: 'Correlación: Porcentaje de Asistencia vs. Calificación Final',
    data: mockData,
  },
};

export const Loading: Story = {
  args: {
    title: 'Correlación: Porcentaje de Asistencia vs. Calificación Final',
    data: mockData,
    loading: true,
  },
};
