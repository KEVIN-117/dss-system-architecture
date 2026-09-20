import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toggle } from './toggle';
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  BookmarkIcon,
  ShieldAlertIcon,
  TerminalIcon,
  CpuIcon,
} from 'lucide-react';

const meta: Meta<typeof Toggle> = {
  title: 'Atoms/Toggle',
  component: Toggle,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outline'],
      description: 'Visual variant of the toggle',
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg'],
      description: 'Size of the toggle button',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether user interaction is disabled',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Toggle>;

export const Default: Story = {
  args: {
    'aria-label': 'Toggle bookmark',
    children: <BookmarkIcon className="size-4" />,
  },
};

export const WithText: Story = {
  render: () => (
    <Toggle
      aria-label="Toggle notifications"
      variant="outline"
      className="gap-2"
    >
      <BookmarkIcon className="size-4" />
      <span>Bookmark</span>
    </Toggle>
  ),
};

export const Variations: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {/* Variants */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          Variants
        </span>
        <div className="flex items-center gap-3">
          <Toggle aria-label="Default variant" variant="default">
            <BoldIcon className="size-4" />
          </Toggle>
          <Toggle aria-label="Outline variant" variant="outline">
            <BoldIcon className="size-4" />
          </Toggle>
        </div>
      </div>

      {/* Sizes */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          Sizes
        </span>
        <div className="flex items-center gap-3">
          <Toggle size="sm" aria-label="Toggle small" variant="outline">
            <ItalicIcon />
            <span>Small</span>
          </Toggle>
          <Toggle size="default" aria-label="Toggle default" variant="outline">
            <ItalicIcon />
            <span>Default</span>
          </Toggle>
          <Toggle size="lg" aria-label="Toggle large" variant="outline">
            <ItalicIcon />
            <span>Large</span>
          </Toggle>
        </div>
      </div>

      {/* Formatting Group */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          Toolbar Example
        </span>
        <div className="flex items-center gap-1 border border-border p-1 rounded-lg w-fit bg-card">
          <Toggle aria-label="Toggle bold" size="sm">
            <BoldIcon className="size-4" />
          </Toggle>
          <Toggle aria-label="Toggle italic" size="sm">
            <ItalicIcon className="size-4" />
          </Toggle>
          <Toggle aria-label="Toggle underline" size="sm">
            <UnderlineIcon className="size-4" />
          </Toggle>
        </div>
      </div>

      {/* Disabled */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          Disabled
        </span>
        <div className="flex items-center gap-3">
          <Toggle disabled aria-label="Disabled toggle" variant="outline">
            <BoldIcon className="size-4" />
          </Toggle>
        </div>
      </div>
    </div>
  ),
};

export const Cyberpunk: Story = {
  render: () => (
    <div className="w-[360px] p-5 rounded-lg border border-primary/30 bg-black/70 shadow-[0_0_15px_rgba(0,255,200,0.1)] font-mono text-xs">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-primary/20">
        <span className="font-bold text-primary tracking-widest">
          {'// TACTICAL_CONTROLS'}
        </span>
        <span className="text-[10px] text-primary">ARMED</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Toggle
          variant="outline"
          aria-label="Toggle firewall"
          className="flex flex-col h-auto py-3 gap-1.5 border-primary/40 data-[state=on]:bg-primary/20 data-[state=on]:border-primary data-[state=on]:text-primary"
          defaultPressed
        >
          <ShieldAlertIcon className="size-4" />
          <span className="text-[10px] tracking-wider">FIREWALL</span>
        </Toggle>

        <Toggle
          variant="outline"
          aria-label="Toggle terminal intercept"
          className="flex flex-col h-auto py-3 gap-1.5 border-primary/40 data-[state=on]:bg-primary/20 data-[state=on]:border-primary data-[state=on]:text-primary"
        >
          <TerminalIcon className="size-4" />
          <span className="text-[10px] tracking-wider">LOG_STREAM</span>
        </Toggle>

        <Toggle
          variant="outline"
          aria-label="Toggle quantum accelerator"
          className="flex flex-col h-auto py-3 gap-1.5 border-primary/40 data-[state=on]:bg-primary/20 data-[state=on]:border-primary data-[state=on]:text-primary"
          defaultPressed
        >
          <CpuIcon className="size-4" />
          <span className="text-[10px] tracking-wider">OVERCLOCK</span>
        </Toggle>
      </div>
    </div>
  ),
};
