import type { Meta, StoryObj } from '@storybook/react-vite';
import { Switch } from './switch';
import { Label } from './label';

const meta: Meta<typeof Switch> = {
  title: 'Atoms/Switch',
  component: Switch,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['default', 'sm'],
      description: 'The size of the switch toggle',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the switch is disabled',
    },
    defaultChecked: {
      control: 'boolean',
      description: 'Default checked state',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Default: Story = {
  args: {
    defaultChecked: true,
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center space-x-3">
      <Switch id="airplane-mode" defaultChecked />
      <Label htmlFor="airplane-mode" className="cursor-pointer">
        Airplane Mode
      </Label>
    </div>
  ),
};

export const Variations: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          Sizes
        </span>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch id="size-default" size="default" defaultChecked />
            <Label htmlFor="size-default">Default (18.4px)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="size-sm" size="sm" defaultChecked />
            <Label htmlFor="size-sm" className="text-xs">Small (14px)</Label>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          States
        </span>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch id="state-unchecked" />
            <Label htmlFor="state-unchecked">Unchecked</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="state-checked" defaultChecked />
            <Label htmlFor="state-checked">Checked</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="state-disabled" disabled />
            <Label htmlFor="state-disabled" className="opacity-50">Disabled</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="state-disabled-checked" disabled defaultChecked />
            <Label htmlFor="state-disabled-checked" className="opacity-50">Disabled Checked</Label>
          </div>
        </div>
      </div>
    </div>
  ),
};

export const Cyberpunk: Story = {
  render: () => (
    <div className="w-[380px] p-5 rounded-lg border border-primary/30 bg-black/60 shadow-[0_0_15px_rgba(0,255,200,0.1)] font-mono text-xs">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-primary/20">
        <span className="font-bold text-primary tracking-widest">{'// MAINFRAME_SUBSYSTEMS'}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">ONLINE</span>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-foreground">OVERCLOCK_QUANTUM_CORE</div>
            <div className="text-[11px] text-muted-foreground">Force-cycle predictive compute nodes</div>
          </div>
          <Switch defaultChecked />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-foreground">STEALTH_PROXY_TUNNEL</div>
            <div className="text-[11px] text-muted-foreground">Route through encrypted UATF gateway</div>
          </div>
          <Switch />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-foreground">AUTO_PURGE_TELEMETRY</div>
            <div className="text-[11px] text-muted-foreground">Zero out query buffer every 60s</div>
          </div>
          <Switch size="sm" defaultChecked />
        </div>
      </div>
    </div>
  ),
};
