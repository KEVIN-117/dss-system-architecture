import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
import { Button } from './button';
import { TerminalIcon } from 'lucide-react';

const meta: Meta<typeof Tooltip> = {
  title: 'Atoms/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">Pasa el cursor</Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Información contextual complementaria</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};

export const Positions: Story = {
  render: () => (
    <TooltipProvider>
      <div className="flex gap-4 items-center justify-center p-12">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm">Arriba</Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Tooltip en la parte superior</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm">Derecha</Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Tooltip a la derecha</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm">Abajo</Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Tooltip en la parte inferior</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm">Izquierda</Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Tooltip a la izquierda</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
};

export const Cyberpunk: Story = {
  render: () => (
    <TooltipProvider>
      <div className="flex items-center justify-center p-10 bg-black/50 border border-primary/20 rounded-lg max-w-md">
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded bg-primary/10 border border-primary/40 text-primary font-mono text-xs hover:bg-primary/20 transition-colors cursor-pointer">
              <TerminalIcon className="size-3.5" />
              <span>NODE://UATF_GATEWAY</span>
              <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="font-mono text-xs bg-black/90 border border-primary/50 text-foreground shadow-[0_0_15px_rgba(0,255,200,0.2)]"
          >
            <div className="flex flex-col gap-1">
              <span className="text-primary font-bold">{'// SECURE_TUNNEL_DETAILS'}</span>
              <span className="text-[11px] text-muted-foreground">LATENCY: 14ms | TLS 1.3 AES-256</span>
              <span className="text-[10px] text-emerald-400">STATUS: 0 PACKET LOSS</span>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
};
