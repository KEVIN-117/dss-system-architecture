import type { Meta, StoryObj } from '@storybook/react-vite';
import { Separator } from './separator';

const meta: Meta<typeof Separator> = {
  title: 'Atoms/Separator',
  component: Separator,
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: 'The orientation of the separator.',
    },
    decorative: {
      control: 'boolean',
      description: 'Whether the separator is purely decorative.',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Separator>;

export const Default: Story = {
  args: {
    orientation: 'horizontal',
  },
  render: (args: React.ComponentProps<typeof Separator>) => (
    <div className="w-[320px] space-y-4">
      <div>
        <h4 className="text-sm font-semibold leading-none">DSS System Architecture</h4>
        <p className="text-xs text-muted-foreground mt-1">Academic decision support & analytics platform.</p>
      </div>
      <Separator {...args} />
      <div className="flex h-5 items-center space-x-4 text-xs text-muted-foreground">
        <span>PostgreSQL</span>
        <Separator orientation="vertical" />
        <span>Neo4j</span>
        <Separator orientation="vertical" />
        <span>Superset</span>
      </div>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-6 items-center space-x-4 text-sm font-medium">
      <a href="#overview" className="hover:text-primary transition-colors">Overview</a>
      <Separator orientation="vertical" />
      <a href="#metrics" className="hover:text-primary transition-colors">Metrics</a>
      <Separator orientation="vertical" />
      <a href="#settings" className="hover:text-primary transition-colors">Settings</a>
    </div>
  ),
};

export const Cyberpunk: Story = {
  render: () => (
    <div className="p-6 bg-black rounded-lg border border-primary/30 font-mono text-sm max-w-md space-y-4">
      <div className="flex justify-between items-center text-xs text-primary">
        <span>SECURITY SUBSYSTEM</span>
        <span className="text-emerald-400">ONLINE</span>
      </div>
      <Separator className="bg-primary/40 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
      <div className="flex h-5 items-center space-x-4 text-xs text-muted-foreground">
        <span className="text-foreground">AUTH: JWT</span>
        <Separator orientation="vertical" className="bg-primary/30" />
        <span className="text-foreground">RBAC: ACTIVE</span>
        <Separator orientation="vertical" className="bg-primary/30" />
        <span className="text-foreground">PORT: 8080</span>
      </div>
      <Separator className="bg-primary/40 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
      <div className="text-xs text-muted-foreground">
        BUFFER: 1024 KB // STATUS: HEALTHY
      </div>
    </div>
  ),
};
