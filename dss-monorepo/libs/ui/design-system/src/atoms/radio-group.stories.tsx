import type { Meta, StoryObj } from '@storybook/react-vite';
import { RadioGroup, RadioGroupItem } from './radio-group';
import { Label } from './label';

const meta: Meta<typeof RadioGroup> = {
  title: 'Atoms/RadioGroup',
  component: RadioGroup,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof RadioGroup>;

export const Default: Story = {
  render: () => (
    <RadioGroup defaultValue="default">
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="default" id="r1" />
        <Label htmlFor="r1">Opción Predeterminada</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="comfortable" id="r2" />
        <Label htmlFor="r2">Cómodo</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="compact" id="r3" />
        <Label htmlFor="r3">Compacto</Label>
      </div>
    </RadioGroup>
  ),
};

export const Variations: Story = {
  render: () => (
    <div className="flex flex-col gap-8 max-w-md">
      {/* With Descriptions */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          Con Descripción
        </span>
        <RadioGroup defaultValue="card">
          <div className="flex items-start space-x-3 rounded-lg border border-border p-3">
            <RadioGroupItem value="card" id="opt-card" className="mt-0.5" />
            <div className="grid gap-1">
              <Label htmlFor="opt-card" className="font-medium cursor-pointer">
                Visualización en Tarjetas
              </Label>
              <p className="text-xs text-muted-foreground">
                Muestra métricas e indicadores de deserción en cuadrícula
                modular.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 rounded-lg border border-border p-3">
            <RadioGroupItem value="table" id="opt-table" className="mt-0.5" />
            <div className="grid gap-1">
              <Label htmlFor="opt-table" className="font-medium cursor-pointer">
                Visualización en Tablas
              </Label>
              <p className="text-xs text-muted-foreground">
                Vista densa con ordenamiento y paginación para auditorías
                detalladas.
              </p>
            </div>
          </div>
        </RadioGroup>
      </div>

      {/* Disabled Option */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          Con Opción Deshabilitada
        </span>
        <RadioGroup defaultValue="plan-a">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="plan-a" id="plan-a" />
            <Label htmlFor="plan-a">Plan Semestral (Activo)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="plan-b" id="plan-b" disabled />
            <Label htmlFor="plan-b" className="opacity-50">
              Plan Cuatrimestral (No disponible)
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  ),
};

export const Cyberpunk: Story = {
  render: () => (
    <div className="w-[420px] p-5 rounded-lg border border-primary/30 bg-black/70 shadow-[0_0_20px_rgba(0,255,200,0.12)] font-mono text-xs">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-primary/20">
        <span className="font-bold text-primary tracking-widest">
          {'// DSS_SECURITY_CLEARANCE'}
        </span>
        <span className="text-[10px] text-emerald-400 font-bold">
          RBAC: ACTIVE
        </span>
      </div>

      <RadioGroup defaultValue="director" className="gap-3">
        <div className="flex items-start space-x-3 p-2.5 rounded border border-primary/20 hover:border-primary/50 transition-colors bg-primary/5">
          <RadioGroupItem value="rector" id="role-rector" className="mt-0.5" />
          <div className="grid gap-0.5">
            <Label
              htmlFor="role-rector"
              className="text-foreground font-semibold cursor-pointer"
            >
              LEVEL_01 // RECTORADO
            </Label>
            <span className="text-[11px] text-muted-foreground">
              Institutional executive overview & macro-KPIs
            </span>
          </div>
        </div>

        <div className="flex items-start space-x-3 p-2.5 rounded border border-primary/20 hover:border-primary/50 transition-colors bg-primary/5">
          <RadioGroupItem value="decano" id="role-decano" className="mt-0.5" />
          <div className="grid gap-0.5">
            <Label
              htmlFor="role-decano"
              className="text-foreground font-semibold cursor-pointer"
            >
              LEVEL_02 // DECANATURA
            </Label>
            <span className="text-[11px] text-muted-foreground">
              Faculty analytics & comparative career trajectories
            </span>
          </div>
        </div>

        <div className="flex items-start space-x-3 p-2.5 rounded border border-primary/40 bg-primary/10 transition-colors">
          <RadioGroupItem
            value="director"
            id="role-director"
            className="mt-0.5"
          />
          <div className="grid gap-0.5">
            <Label
              htmlFor="role-director"
              className="text-primary font-bold cursor-pointer"
            >
              LEVEL_03 // DIRECCIÓN_DE_CARRERA
            </Label>
            <span className="text-[11px] text-muted-foreground">
              Student-level predictive risk scores & early intervention
            </span>
          </div>
        </div>
      </RadioGroup>
    </div>
  ),
};
