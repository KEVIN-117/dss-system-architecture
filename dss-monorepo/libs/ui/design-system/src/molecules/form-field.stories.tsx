import type { Meta, StoryObj } from '@storybook/react-vite';
import { FormField } from './form-field';
import { Input } from '../atoms/input';
import { Textarea } from '../atoms/textarea';
import { Button } from '../atoms/button';
import { Terminal, Shield, KeyRound } from 'lucide-react';

const meta: Meta<typeof FormField> = {
  title: 'Molecules/FormField',
  component: FormField,
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: 'text',
      description: 'The label text for the field.',
    },
    description: {
      control: 'text',
      description: 'Helper description text below the input.',
    },
    error: {
      control: 'text',
      description: 'Error message that displays above the input with pulse animation.',
    },
    required: {
      control: 'boolean',
      description: 'Displays a required asterisk next to the label.',
    },
  },
};

export default meta;
type Story = StoryObj<typeof FormField>;

export const Default: Story = {
  render: () => (
    <div className="max-w-md">
      <FormField
        label="Usuario DSS"
        htmlFor="username"
        description="Identificador único institucional del operador."
      >
        <Input id="username" placeholder="ej. krodriguez@uatf.edu.bo" />
      </FormField>
    </div>
  ),
};

export const Required: Story = {
  render: () => (
    <div className="max-w-md">
      <FormField
        label="Token de Ingesta"
        htmlFor="ingest-token"
        required
        description="Token criptográfico emitido para la ingesta del Load Manager."
      >
        <Input id="ingest-token" type="password" placeholder="••••••••••••••••" />
      </FormField>
    </div>
  ),
};

export const WithError: Story = {
  render: () => (
    <div className="max-w-md">
      <FormField
        label="Puerto del Clúster"
        htmlFor="cluster-port"
        required
        error="PORT_OUT_OF_RANGE: EXPECTED 1024-65535"
      >
        <Input id="cluster-port" defaultValue="80" aria-invalid />
      </FormField>
    </div>
  ),
};

export const WithTextarea: Story = {
  render: () => (
    <div className="max-w-md">
      <FormField
        label="Sentencia Cypher / Consulta Dimensional"
        htmlFor="query"
        description="Especifique el patrón de recorrido para el grafo académico de Neo4j."
      >
        <Textarea
          id="query"
          placeholder="MATCH (s:Estudiante)-[r:INSCRITO]->(m:Materia) RETURN s.codigo, m.sigla LIMIT 25;"
          rows={4}
        />
      </FormField>
    </div>
  ),
};

export const CyberpunkTerminal: Story = {
  render: () => (
    <div className="p-6 bg-black/95 rounded-xl border border-primary/30 max-w-lg space-y-6 font-mono shadow-[0_0_35px_rgba(0,0,0,0.85)]">
      <div className="flex items-center justify-between border-b border-primary/20 pb-3">
        <div className="flex items-center gap-2 text-xs text-primary">
          <Terminal className="size-4 animate-pulse" />
          <span className="font-bold tracking-widest">// MAINFRAME ROOT AUTH</span>
        </div>
        <span className="text-[10px] text-muted-foreground border border-primary/20 px-2 py-0.5 rounded">
          CLEARANCE: S-RANK
        </span>
      </div>

      <div className="space-y-4">
        <FormField
          label="OPERATOR_IDENTITY"
          htmlFor="operator-id"
          required
          description="Enter your cryptographic fingerprint ID."
        >
          <div className="relative">
            <Input
              id="operator-id"
              defaultValue="SEC_AGENT_095"
              className="pl-9 font-mono text-xs border-primary/40 bg-black/50 focus-visible:ring-primary"
            />
            <Shield className="size-3.5 text-primary/70 absolute left-3 top-2.5 pointer-events-none" />
          </div>
        </FormField>

        <FormField
          label="CIPHER_MATRIX_KEY"
          htmlFor="matrix-key"
          required
          description="256-bit ephemeral seed for the Decanal gateway."
        >
          <div className="relative">
            <Input
              id="matrix-key"
              type="password"
              defaultValue="0xDEADBEEF_SECRET"
              className="pl-9 font-mono text-xs border-primary/40 bg-black/50 focus-visible:ring-primary"
            />
            <KeyRound className="size-3.5 text-primary/70 absolute left-3 top-2.5 pointer-events-none" />
          </div>
        </FormField>

        <FormField
          label="SECURITY_OVERRIDE_FLAG"
          htmlFor="override-flag"
          error="RESTRICTED_ACCESS: DECANAL SIGN-OFF REQUIRED"
        >
          <Input
            id="override-flag"
            defaultValue="BYPASS_FACULTY_RESTRICTIONS=TRUE"
            aria-invalid
            className="font-mono text-xs"
          />
        </FormField>
      </div>

      <Button className="w-full font-mono uppercase tracking-wider text-xs shadow-[0_0_20px_theme(colors.primary.DEFAULT/30%)]">
        &gt; INITIATE SECURE HANDSHAKE
      </Button>
    </div>
  ),
};
