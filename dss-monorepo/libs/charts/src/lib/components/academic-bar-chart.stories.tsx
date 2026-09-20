import type { Meta, StoryObj } from '@storybook/react-vite';
import { AcademicBarChart } from './academic-bar-chart';

const meta: Meta<typeof AcademicBarChart> = {
  title: 'Charts/AcademicBarChart',
  component: AcademicBarChart,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    loading: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof AcademicBarChart>;

const mockData = [
  { label: 'Cálculo I', value: 45 },
  { label: 'Física', value: 52 },
  { label: 'Programación', value: 85 },
  { label: 'Álgebra', value: 60 },
  { label: 'Química', value: 30 },
];

export const Default: Story = {
  args: {
    title: 'Rendimiento Promedio por Materia',
    data: mockData,
  },
};

export const Loading: Story = {
  args: {
    title: 'Rendimiento Promedio por Materia',
    data: mockData,
    loading: true,
  },
};
