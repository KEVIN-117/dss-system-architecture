import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toaster } from './sonner';
import { Button } from './button';
import { toast } from 'sonner';
import {
  BellIcon,
  CheckCircle2Icon,
  InfoIcon,
  AlertTriangleIcon,
  AlertOctagonIcon,
  TerminalIcon,
  SparklesIcon,
  FlameIcon,
} from 'lucide-react';

const meta: Meta<typeof Toaster> = {
  title: 'Atoms/Sonner',
  component: Toaster,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Toaster>;

export const Default: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-4 p-6">
      <Toaster />
      <Button
        variant="outline"
        className="gap-2"
        onClick={() =>
          toast('Evento Registrado', {
            description: 'La sesión del usuario ha sido renovada exitosamente.',
          })
        }
      >
        <BellIcon className="size-4" />
        <span>Lanzar Toast Default</span>
      </Button>
    </div>
  ),
};

export const Variations: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-6 p-6">
      <Toaster />
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Tipos de Notificaciones (Sonner)
      </span>
      <div className="flex flex-wrap gap-3 justify-center">
        <Button
          variant="outline"
          className="text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
          onClick={() =>
            toast.success('Operación completada', {
              description:
                'El modelo predictivo CRISP-DM ha finalizado el entrenamiento.',
            })
          }
        >
          <CheckCircle2Icon className="size-4" />
          Success
        </Button>

        <Button
          variant="outline"
          className="text-blue-500 border-blue-500/30 hover:bg-blue-500/10"
          onClick={() =>
            toast.info('Actualización disponible', {
              description:
                'Nuevos datos de matrículas detectados en el Load Manager.',
            })
          }
        >
          <InfoIcon className="size-4" />
          Info
        </Button>

        <Button
          variant="outline"
          className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
          onClick={() =>
            toast.warning('Advertencia de carga', {
              description:
                'El pool de conexiones PostgreSQL está al 85% de capacidad.',
            })
          }
        >
          <AlertTriangleIcon className="size-4" />
          Warning
        </Button>

        <Button
          variant="destructive"
          onClick={() =>
            toast.error('Fallo de autenticación', {
              description: 'Token JWT expirado o inválido para el rol Decano.',
            })
          }
        >
          <AlertOctagonIcon className="size-4" />
          Error
        </Button>

        <Button
          variant="secondary"
          onClick={() => {
            const promise = new Promise((resolve) =>
              setTimeout(() => resolve({ name: 'Matrículas 2026' }), 2000),
            );

            toast.promise(promise, {
              loading: 'Sincronizando con Neo4j...',
              success: () => 'Sincronización de grafo completada exitosamente',
              error: 'Error al conectar con la base de datos de grafos',
            });
          }}
        >
          <SparklesIcon className="size-4" />
          Promise / Loading
        </Button>
      </div>
    </div>
  ),
};

export const Cyberpunk: Story = {
  render: () => (
    <div className="p-8 bg-black rounded-lg border border-primary/40 font-mono space-y-4 shadow-[0_0_20px_rgba(59,130,246,0.15)] flex flex-col items-center text-center">
      <Toaster />
      <div className="text-xs text-primary tracking-widest uppercase">
        TELEMETRY UPLINK PROTOCOL
      </div>
      <p className="text-muted-foreground text-xs max-w-sm">
        Dispara alertas HUD simuladas directamente a la consola del operador de
        mainframe.
      </p>

      <div className="flex flex-wrap gap-3 justify-center pt-2">
        <Button
          variant="outline"
          className="border-primary/50 text-cyan-400 hover:text-cyan-300 hover:bg-primary/20 font-mono text-xs shadow-[0_0_12px_rgba(59,130,246,0.25)]"
          onClick={() =>
            toast.success('NEURAL_CORE: CONNECTED', {
              description:
                'Quantum node 0x9F authenticated. 10Gbps stream active.',
            })
          }
        >
          <TerminalIcon className="size-3.5" />
          ESTABLISH UPLINK
        </Button>

        <Button
          variant="destructive"
          className="font-mono text-xs shadow-[0_0_12px_rgba(239,68,68,0.3)]"
          onClick={() =>
            toast.error('INTRUSION_ALERT', {
              description: 'Unauthorized cypher injection attempt on node #04.',
            })
          }
        >
          <FlameIcon className="size-3.5" />
          TRIGGER ALERT
        </Button>
      </div>
    </div>
  ),
};
