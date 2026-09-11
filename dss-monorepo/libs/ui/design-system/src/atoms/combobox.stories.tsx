import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxEmpty,
  ComboboxSeparator,
} from './combobox';
import { TerminalIcon, DatabaseIcon, CpuIcon } from 'lucide-react';

const meta: Meta<typeof Combobox> = {
  title: 'Atoms/Combobox',
  component: Combobox,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Combobox>;

const academicCareers = [
  { value: 'sis', label: 'Ingeniería de Sistemas' },
  { value: 'inf', label: 'Ingeniería Informática' },
  { value: 'civ', label: 'Ingeniería Civil' },
  { value: 'min', label: 'Ingeniería Minera' },
  { value: 'med', label: 'Medicina' },
  { value: 'enf', label: 'Enfermería' },
  { value: 'der', label: 'Derecho' },
  { value: 'eco', label: 'Economía' },
];

export const Default: Story = {
  render: () => (
    <div className="w-80">
      <Combobox items={academicCareers}>
        <ComboboxInput placeholder="Buscar carrera académica..." showClear />
        <ComboboxContent>
          <ComboboxList>
            {academicCareers.map((career) => (
              <ComboboxItem key={career.value} value={career.value}>
                {career.label}
              </ComboboxItem>
            ))}
            <ComboboxEmpty>No se encontraron carreras.</ComboboxEmpty>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  ),
};

export const WithGroups: Story = {
  render: () => (
    <div className="w-80">
      <Combobox>
        <ComboboxInput placeholder="Filtrar por facultad y carrera..." />
        <ComboboxContent>
          <ComboboxList>
            <ComboboxGroup>
              <ComboboxLabel>Facultad de Ingeniería</ComboboxLabel>
              <ComboboxItem value="sis">Ingeniería de Sistemas</ComboboxItem>
              <ComboboxItem value="inf">Ingeniería Informática</ComboboxItem>
              <ComboboxItem value="civ">Ingeniería Civil</ComboboxItem>
            </ComboboxGroup>
            <ComboboxSeparator />
            <ComboboxGroup>
              <ComboboxLabel>Ciencias de la Salud</ComboboxLabel>
              <ComboboxItem value="med">Medicina</ComboboxItem>
              <ComboboxItem value="enf">Enfermería</ComboboxItem>
            </ComboboxGroup>
            <ComboboxSeparator />
            <ComboboxGroup>
              <ComboboxLabel>Ciencias Sociales</ComboboxLabel>
              <ComboboxItem value="der">Derecho</ComboboxItem>
              <ComboboxItem value="eco">Economía</ComboboxItem>
            </ComboboxGroup>
            <ComboboxEmpty>No hay resultados.</ComboboxEmpty>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-80">
      <Combobox items={academicCareers}>
        <ComboboxInput placeholder="Acceso restringido..." disabled />
      </Combobox>
    </div>
  ),
};

export const Cyberpunk: Story = {
  render: () => {
    const nodeEndpoints = [
      { value: 'node-postgres-01', label: 'POSTGRES_STAR_SCHEMA (Port 5432)' },
      { value: 'node-neo4j-graph', label: 'NEO4J_KNOWLEDGE_GRAPH (Port 7687)' },
      { value: 'node-ml-inference', label: 'ML_INFERENCE_ENGINE (Port 8000)' },
      { value: 'node-superset-bi', label: 'APACHE_SUPERSET_EMBED (Port 8088)' },
    ];

    return (
      <div className="p-6 bg-black rounded-lg border border-primary/40 font-mono w-96 space-y-4 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
        <div className="flex items-center justify-between border-b border-primary/20 pb-2">
          <div className="flex items-center gap-2 text-xs text-primary font-bold tracking-wider">
            <CpuIcon className="size-4 text-cyan-400" />
            <span>NODE_TARGET_SELECTOR</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono">
            // READY
          </span>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <TerminalIcon className="size-3 text-cyan-400" />
            Target Cluster Node
          </label>
          <Combobox items={nodeEndpoints}>
            <ComboboxInput
              placeholder="Select neural cluster..."
              className="border-primary/40 bg-card/30 focus-within:border-cyan-400"
            />
            <ComboboxContent className="border-primary/30 bg-card/90 backdrop-blur-md shadow-[0_0_15px_rgba(59,130,246,0.2)]">
              <ComboboxList>
                {nodeEndpoints.map((node) => (
                  <ComboboxItem
                    key={node.value}
                    value={node.value}
                    className="hover:bg-primary/20 hover:text-cyan-300 font-mono text-xs"
                  >
                    <DatabaseIcon className="size-3.5 text-primary mr-1" />
                    {node.label}
                  </ComboboxItem>
                ))}
                <ComboboxEmpty className="text-destructive font-mono text-xs">
                  NO_MATCHING_ENDPOINT
                </ComboboxEmpty>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
      </div>
    );
  },
};
