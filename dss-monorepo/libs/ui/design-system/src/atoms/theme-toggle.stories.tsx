import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThemeToggle } from './theme-toggle';

const meta = {
  title: 'Atoms/ThemeToggle',
  component: ThemeToggle,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const IconOnly: Story = {
  render: () => (
    <div className="flex min-h-24 items-center gap-4 rounded-xl border border-border bg-background p-8 text-foreground">
      <span className="text-sm">Cambiar tema</span>
      <ThemeToggle />
    </div>
  ),
};
