import type { Meta, StoryObj } from '@storybook/react-vite';
import { StackedAreaChart } from './stacked-area-chart';

const meta: Meta<typeof StackedAreaChart> = {
  title: 'Charts/StackedAreaChart',
  component: StackedAreaChart,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    loading: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof StackedAreaChart>;

const mockData = {
  categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  series: [
    { name: 'Line 1', data: [140, 232, 101, 264, 90, 340, 250] },
    { name: 'Line 2', data: [120, 282, 111, 234, 220, 340, 310] },
    { name: 'Line 3', data: [320, 132, 201, 334, 190, 130, 220] },
    { name: 'Line 4', data: [220, 402, 231, 134, 190, 230, 120] },
    { name: 'Line 5', data: [220, 302, 181, 234, 210, 290, 150] },
  ],
};

export const Default: Story = {
  args: {
    title: 'Gradient Stacked Area Chart',
    data: mockData,
  },
};

export const Loading: Story = {
  args: {
    title: 'Gradient Stacked Area Chart',
    data: mockData,
    loading: true,
  },
};
