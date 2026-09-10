import type { Meta, StoryObj } from '@storybook/react-vite';
import { TrendLineChart } from './trend-line-chart';

const meta: Meta<typeof TrendLineChart> = {
  title: 'Charts/TrendLineChart',
  component: TrendLineChart,
  argTypes: {
    loading: { control: 'boolean' },
    title: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof TrendLineChart>;

const mockData = [
  { label: 'Semestre 1', value: 65 },
  { label: 'Semestre 2', value: 68 },
  { label: 'Semestre 3', value: 62 },
  { label: 'Semestre 4', value: 75 },
  { label: 'Semestre 5', value: 80 }
];

export const Default: Story = {
  args: {
    title: 'Tendencia Histórica de Aprobación (%)',
    data: mockData,
  },
};
