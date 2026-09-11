import type { Meta, StoryObj } from '@storybook/react-vite';
import { TrendLineChart } from './trend-line-chart';

const meta: Meta<typeof TrendLineChart> = {
  title: 'Charts/TrendLineChart',
  component: TrendLineChart,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    loading: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof TrendLineChart>;

const mockData = [
  { label: 'Semestre 1', value: 85 },
  { label: 'Semestre 2', value: 80 },
  { label: 'Semestre 3', value: 72 },
  { label: 'Semestre 4', value: 75 },
  { label: 'Semestre 5', value: 90 },
  { label: 'Semestre 6', value: 88 },
];

export const Default: Story = {
  args: {
    title: 'Evolución de Aprobación por Semestre',
    data: mockData,
  },
};

export const Loading: Story = {
  args: {
    title: 'Evolución de Aprobación por Semestre',
    data: mockData,
    loading: true,
  },
};
