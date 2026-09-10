import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from './skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'Atoms/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  render: () => (
    <div className="space-y-2 w-[300px]">
      <Skeleton className="h-4 w-[250px]" />
      <Skeleton className="h-4 w-[200px]" />
    </div>
  ),
};

export const CardSkeleton: Story = {
  render: () => (
    <div className="flex items-center space-x-4 p-4 border rounded-xl max-w-sm">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  ),
};

export const TableSkeleton: Story = {
  render: () => (
    <div className="space-y-3 max-w-md">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-3/4" />
    </div>
  ),
};

export const Cyberpunk: Story = {
  render: () => (
    <div className="p-6 bg-black rounded-lg border border-primary/30 max-w-md space-y-4 font-mono">
      <div className="flex items-center justify-between">
        <div className="text-xs text-primary animate-pulse tracking-wider">
          {'// ACQUIRING TELEMETRY STREAM...'}
        </div>
        <Skeleton className="h-3 w-12 bg-primary/20" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-24 w-full bg-primary/10 border border-primary/20 rounded-sm" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-8 bg-primary/15 rounded-sm" />
        <Skeleton className="h-8 bg-primary/15 rounded-sm" />
        <Skeleton className="h-8 bg-primary/15 rounded-sm" />
      </div>
      <div className="flex justify-between items-center pt-2">
        <Skeleton className="h-3 w-28 bg-muted/40" />
        <Skeleton className="h-3 w-16 bg-muted/40" />
      </div>
    </div>
  ),
};
