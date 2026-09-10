import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './badge';
import { ShieldCheck, AlertTriangle, Sparkles, Terminal } from 'lucide-react';

const meta: Meta<typeof Badge> = {
  title: 'Atoms/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'],
      description: 'The visual style variant of the badge.',
    },
    asChild: {
      control: 'boolean',
      description: 'Render as child element using Radix Slot.',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: {
    children: 'Badge',
    variant: 'default',
  },
};

export const Variations: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 items-center">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="ghost">Ghost</Badge>
      <Badge variant="link">Link</Badge>
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 items-center">
      <Badge variant="default">
        <ShieldCheck className="size-3" />
        Verified
      </Badge>
      <Badge variant="secondary">
        <Sparkles className="size-3" />
        Featured
      </Badge>
      <Badge variant="destructive">
        <AlertTriangle className="size-3" />
        High Alert
      </Badge>
      <Badge variant="outline">
        <Terminal className="size-3" />
        CLI Active
      </Badge>
    </div>
  ),
};

export const Cyberpunk: Story = {
  render: () => (
    <div className="p-6 bg-black rounded-lg border border-primary/20 space-y-4 font-mono">
      <div className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
        System Telemetry Flags
      </div>
      <div className="flex flex-wrap gap-3 items-center">
        <Badge variant="default" className="shadow-[0_0_8px_rgba(34,197,94,0.4)]">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-ping inline-block mr-1" />
          SYS:ONLINE
        </Badge>
        <Badge variant="outline" className="border-primary/50 text-primary shadow-[0_0_8px_rgba(59,130,246,0.3)]">
          CORE:v2.4
        </Badge>
        <Badge variant="destructive" className="shadow-[0_0_8px_rgba(239,68,68,0.4)]">
          BREACH:NULL
        </Badge>
        <Badge variant="secondary" className="border border-muted-foreground/30">
          NODE:POT-01
        </Badge>
      </div>
    </div>
  ),
};
