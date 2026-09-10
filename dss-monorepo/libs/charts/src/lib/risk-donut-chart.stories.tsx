import type { Meta, StoryObj } from '@storybook/react-vite';
import { RiskDonutChart } from './risk-donut-chart';

const meta: Meta<typeof RiskDonutChart> = {
  title: 'Charts/RiskDonutChart',
  component: RiskDonutChart,
  argTypes: {
    loading: { control: 'boolean' },
    title: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof RiskDonutChart>;

const mockData = [
  { label: 'Estables', value: 85 },
  { label: 'Riesgo Moderado', value: 10 },
  { label: 'Riesgo de Deserción', value: 5 }
];

export const Default: Story = {
  args: {
    title: 'Análisis de Riesgo Estudiantil',
    data: mockData,
  },
};
