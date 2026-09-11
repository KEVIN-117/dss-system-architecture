import type { Meta, StoryObj } from '@storybook/react';
import { RegressionScatterChart } from './regression-scatter-chart';
import { RegressionChartData } from '../core/builders';

const meta: Meta<typeof RegressionScatterChart> = {
  title: 'Charts/RegressionScatterChart',
  component: RegressionScatterChart,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    loading: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof RegressionScatterChart>;

const mockData: RegressionChartData = {
  points: [
    { x: 4, y: 42, name: 'Est. 301' },
    { x: 6, y: 48, name: 'Est. 302' },
    { x: 8, y: 55, name: 'Est. 303' },
    { x: 9, y: 52, name: 'Est. 304' },
    { x: 10, y: 64, name: 'Est. 305' },
    { x: 12, y: 68, name: 'Est. 306' },
    { x: 13, y: 62, name: 'Est. 307' },
    { x: 14, y: 74, name: 'Est. 308' },
    { x: 15, y: 71, name: 'Est. 309' },
    { x: 16, y: 80, name: 'Est. 310' },
    { x: 18, y: 84, name: 'Est. 311' },
    { x: 19, y: 79, name: 'Est. 312' },
    { x: 20, y: 88, name: 'Est. 313' },
    { x: 22, y: 92, name: 'Est. 314' },
    { x: 24, y: 96, name: 'Est. 315' },
  ],
  line: [
    { x: 2, y: 38 },
    { x: 6, y: 50 },
    { x: 10, y: 62 },
    { x: 14, y: 74 },
    { x: 18, y: 86 },
    { x: 22, y: 94 },
    { x: 25, y: 99 },
  ],
};

export const Default: Story = {
  args: {
    title: 'Regresión Lineal: Horas de Estudio Semanales vs. Calificación',
    data: mockData,
  },
};

export const Loading: Story = {
  args: {
    title: 'Regresión Lineal: Horas de Estudio Semanales vs. Calificación',
    data: mockData,
    loading: true,
  },
};
