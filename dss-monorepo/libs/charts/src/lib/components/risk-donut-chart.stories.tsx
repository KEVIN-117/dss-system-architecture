import type { Meta, StoryObj } from '@storybook/react-vite';
import { RiskDonutChart } from './risk-donut-chart';
import type { ChartDataPoint } from '../core/builders';

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

const mockData: ChartDataPoint[] = [
  { label: 'Riesgo Alto', value: 120, tone: 'destructive' },
  { label: 'Riesgo Medio', value: 250, tone: 'warning' },
  { label: 'Sin Riesgo', value: 850, tone: 'success' },
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
