import type { Meta, StoryObj } from '@storybook/react-vite';
import { Textarea } from './textarea';
import { Label } from './label';
import { Button } from './button';

const meta: Meta<typeof Textarea> = {
  title: 'Atoms/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  argTypes: {
    placeholder: {
      control: 'text',
      description: 'Placeholder text for the textarea',
    },
    disabled: {
      control: 'boolean',
      description: 'Disables user interaction',
    },
    rows: {
      control: 'number',
      description: 'Number of visible text lines',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  args: {
    placeholder: 'Escribe tu observación o reporte aquí...',
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-2">
      <Label htmlFor="academic-notes">Observaciones Académicas</Label>
      <Textarea
        id="academic-notes"
        placeholder="Ingrese detalles sobre la trayectoria del estudiante..."
      />
      <p className="text-xs text-muted-foreground">
        Los comentarios se sincronizarán con el perfil del estudiante.
      </p>
    </div>
  ),
};

export const Variations: Story = {
  render: () => (
    <div className="flex flex-col gap-6 max-w-md">
      <div className="flex flex-col gap-2">
        <Label>Default</Label>
        <Textarea placeholder="Campo estándar editable..." />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Con Valor Predefinido</Label>
        <Textarea defaultValue="Estudiante regular con 85% de materias aprobadas en el semestre 2025-II." />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Estado Inválido / Error</Label>
        <Textarea
          aria-invalid="true"
          defaultValue="Error en formato de entrada: faltan campos obligatorios."
        />
        <span className="text-xs text-destructive">
          El contenido supera el límite permitido.
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Deshabilitado</Label>
        <Textarea
          disabled
          defaultValue="Registro de auditoría bloqueado por política de retención."
        />
      </div>
    </div>
  ),
};

export const Cyberpunk: Story = {
  render: () => (
    <div className="w-[440px] p-5 rounded-lg border border-primary/30 bg-black/70 shadow-[0_0_20px_rgba(0,255,200,0.12)] font-mono text-xs">
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-primary/20">
        <span className="text-primary font-bold tracking-wider">
          {'// CIPHER_PAYLOAD_INJECTOR'}
        </span>
        <span className="text-[10px] text-emerald-400 font-semibold animate-pulse">
          TERMINAL: ACTIVE
        </span>
      </div>

      <div className="space-y-3">
        <div className="text-[11px] text-muted-foreground">
          ENTER GRAPH CYPHER / RAW SQL QUERY FOR DSS ENGINE:
        </div>
        <Textarea
          className="font-mono text-xs bg-black/50 border-primary/40 focus-visible:ring-primary/60 text-primary min-h-24 resize-none"
          defaultValue={`MATCH (s:Student)-[r:ENROLLED_IN]->(c:Course)\nWHERE s.risk_score > 0.75\nRETURN s.id, s.name, c.code, r.attendance_rate;`}
        />
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground font-mono">
            BUFFER: 128 BYTES
          </span>
          <Button size="sm" className="font-mono text-xs tracking-wider">
            EXECUTE_CYPHER
          </Button>
        </div>
      </div>
    </div>
  ),
};
