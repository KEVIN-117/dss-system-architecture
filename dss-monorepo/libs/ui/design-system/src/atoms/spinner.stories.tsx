import type { Meta, StoryObj } from '@storybook/react-vite';
import { Spinner } from './spinner';
import { Button } from './button';

const meta: Meta<typeof Spinner> = {
  title: 'Atoms/Spinner',
  component: Spinner,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Spinner>;

export const Default: Story = {
  args: {},
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <Spinner className="size-3" />
        <span className="text-xs text-muted-foreground">size-3</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner className="size-4" />
        <span className="text-xs text-muted-foreground">size-4 (default)</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner className="size-6" />
        <span className="text-xs text-muted-foreground">size-6</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner className="size-8" />
        <span className="text-xs text-muted-foreground">size-8</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner className="size-12" />
        <span className="text-xs text-muted-foreground">size-12</span>
      </div>
    </div>
  ),
};

export const Variations: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-6">
      <div className="flex items-center gap-2 text-primary">
        <Spinner className="text-primary size-5" />
        <span className="text-sm">Primary</span>
      </div>
      <div className="flex items-center gap-2 text-secondary-foreground">
        <Spinner className="text-secondary-foreground size-5" />
        <span className="text-sm">Secondary</span>
      </div>
      <div className="flex items-center gap-2 text-destructive">
        <Spinner className="text-destructive size-5" />
        <span className="text-sm">Destructive</span>
      </div>
      <div className="flex items-center gap-2 text-success">
        <Spinner className="text-success size-5" />
        <span className="text-sm">Success</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Spinner className="text-muted-foreground size-5" />
        <span className="text-sm">Muted</span>
      </div>
      <Button disabled>
        <Spinner className="size-4 mr-2" />
        Processing...
      </Button>
    </div>
  ),
};

export const Cyberpunk: Story = {
  render: () => (
    <div className="p-6 bg-background rounded-lg border border-primary/30 max-w-sm space-y-4 font-mono text-center">
      <div className="flex flex-col items-center justify-center gap-3 py-4">
        <div className="relative flex items-center justify-center">
          <Spinner className="size-10 text-primary drop-shadow-md" />
          <span className="absolute size-2 rounded-full bg-primary animate-ping" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold text-primary tracking-widest uppercase">
            {'// NEURAL SYNCHRONIZATION'}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Bypassing mainframe gateway: 74%
          </p>
        </div>
      </div>
    </div>
  ),
};
