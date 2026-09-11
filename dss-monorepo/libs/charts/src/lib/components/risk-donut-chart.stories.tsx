import type { Meta, StoryObj } from '@storybook/react';
import { RiskDonutChart } from './risk-donut-chart';

const meta: Meta<typeof RiskDonutChart> = {
  title: 'Charts/RiskDonutChart',
  component: RiskDonutChart,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    loading: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof RiskDonutChart>;

const mockData = [
  { label: 'Riesgo Alto', value: 120 },
  { label: 'Riesgo Medio', value: 250 },
  { label: 'Sin Riesgo', value: 850 },
];

export const Default: Story = {
  args: {
    title: 'Distribución de Riesgo de Deserción',
    data: mockData,
  },
};

export const Loading: Story = {
  args: {
    title: 'Distribución de Riesgo de Deserción',
    data: mockData,
    loading: true,
  },
};
