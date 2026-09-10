import type { Meta, StoryObj } from '@storybook/react-vite';
import { AcademicBarChart } from './academic-bar-chart';

const meta: Meta<typeof AcademicBarChart> = {
  title: 'Charts/AcademicBarChart',
  component: AcademicBarChart,
  argTypes: {
    loading: { control: 'boolean' },
    title: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof AcademicBarChart>;

const mockData = [
  { label: 'Ingeniería', value: 1200 },
  { label: 'Derecho', value: 950 },
  { label: 'Medicina', value: 800 },
  { label: 'Economía', value: 1100 },
  { label: 'Artes', value: 450 }
];

export const Default: Story = {
  args: {
    title: 'Matriculados por Facultad (2026)',
    data: mockData,
  },
};

export const LoadingState: Story = {
  args: {
    title: 'Matriculados por Facultad (2026)',
    data: mockData,
    loading: true,
  },
};
