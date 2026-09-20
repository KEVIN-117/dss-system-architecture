import type { Meta, StoryObj } from '@storybook/react-vite';
import { Alert, AlertTitle, AlertDescription } from './alert';
import { Terminal, AlertTriangle, Info, ShieldAlert, Cpu } from 'lucide-react';

const meta: Meta<typeof Alert> = {
  title: 'Molecules/Alert',
  component: Alert,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'system', 'destructive'],
      description: 'Visual style variant of the alert banner.',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Default: Story = {
  render: () => (
    <Alert className="max-w-xl">
      <AlertTitle>Notificación del Sistema</AlertTitle>
      <AlertDescription>
        El pipeline de sincronización del Data Warehouse se ha completado
        exitosamente.
      </AlertDescription>
    </Alert>
  ),
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-4 max-w-xl">
      <Alert variant="default">
        <AlertTitle>Default Notice</AlertTitle>
        <AlertDescription>
          Sesión activa iniciada para la Facultad de Ingeniería de Sistemas.
        </AlertDescription>
      </Alert>

      <Alert variant="system">
        <AlertTitle>System Telemetry</AlertTitle>
        <AlertDescription>
          Nodo Load Manager operando a capacidad nominal con 12 workers
          concurrentes.
        </AlertDescription>
      </Alert>

      <Alert variant="destructive">
        <AlertTitle>Critical Warning</AlertTitle>
        <AlertDescription>
          Fallo de conexión en réplica de base de datos secundaria. Iniciando
          failover automático.
        </AlertDescription>
      </Alert>
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-col gap-4 max-w-xl">
      <Alert variant="default">
        <Info className="size-4" />
        <AlertTitle>Actualización de Esquema</AlertTitle>
        <AlertDescription>
          Se han aplicado nuevas migraciones dimensionales para el semestre
          2026-I.
        </AlertDescription>
      </Alert>

      <Alert variant="system">
        <Terminal className="size-4" />
        <AlertTitle>Terminal Protocol</AlertTitle>
        <AlertDescription>
          Túnel seguro gRPC establecido entre Query Manager y microservicios
          analíticos.
        </AlertDescription>
      </Alert>

      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertTitle>Alerta de Riesgo Académico</AlertTitle>
        <AlertDescription>
          Modelo predictivo detectó 48 estudiantes en umbral crítico de
          deserción.
        </AlertDescription>
      </Alert>
    </div>
  ),
};

export const CyberpunkTerminal: Story = {
  render: () => (
    <div className="p-6 bg-black/90 rounded-xl border border-primary/30 space-y-4 font-mono max-w-2xl shadow-[0_0_30px_rgba(0,0,0,0.8)]">
      <div className="flex items-center justify-between border-b border-primary/20 pb-2 text-xs text-primary/70">
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-400 animate-ping inline-block" />
          // DSS KERNEL INTERRUPT LOG
        </span>
        <span>SECURITY_CLEARANCE: LEVEL_4</span>
      </div>

      <Alert
        variant="system"
        className="border-primary/50 shadow-[0_0_20px_theme(colors.primary.DEFAULT/20%)]"
      >
        <Cpu className="size-4 text-primary animate-pulse" />
        <AlertTitle className="tracking-widest uppercase font-mono text-xs">
          [SYS_NODE_01]: NEURAL CORE ONLINE
        </AlertTitle>
        <AlertDescription className="text-xs font-mono text-primary/80">
          UATF Academic DSS engine running CRISP-DM v2 inference model.
          Accuracy: 94.8% | Latency: 12ms.
        </AlertDescription>
      </Alert>

      <Alert
        variant="destructive"
        className="border-destructive/60 shadow-[0_0_25px_theme(colors.destructive.DEFAULT/25%)]"
      >
        <ShieldAlert className="size-4 text-destructive animate-pulse" />
        <AlertTitle className="tracking-widest uppercase font-mono text-xs">
          [SEC_BREACH_ALERT]: ANOMALY INTERCEPTED
        </AlertTitle>
        <AlertDescription className="text-xs font-mono text-destructive/90">
          Cross-faculty unauthorized token probe intercepted on port 8443.
          Target node segregated.
        </AlertDescription>
      </Alert>
    </div>
  ),
};
