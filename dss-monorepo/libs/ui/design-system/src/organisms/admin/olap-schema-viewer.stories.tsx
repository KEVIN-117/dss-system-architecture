import type { Meta, StoryObj } from '@storybook/react-vite';
import { OlapSchemaViewer } from './olap-schema-viewer';

const schema = {
  schemaName: 'UATF_DW',
  cubeName: 'Rendimiento académico',
  tables: [
    {
      id: 'fact_cursado',
      name: 'fact_cursado',
      role: 'fact' as const,
      columns: [
        { name: 'fact_cursado_id' },
        { name: 'programa_sk', keyType: 'foreign' as const },
        { name: 'periodo_academico_sk', keyType: 'foreign' as const },
        { name: 'conteo_intento' },
        { name: 'nota_final' },
      ],
    },
    {
      id: 'dim_programa',
      name: 'dim_programa',
      role: 'dimension' as const,
      columns: [
        { name: 'programa_sk', keyType: 'primary' as const },
        { name: 'id_facultad' },
        { name: 'facultad' },
        { name: 'id_programa' },
        { name: 'programa' },
      ],
    },
    {
      id: 'dim_periodo_academico',
      name: 'dim_periodo_academico',
      role: 'dimension' as const,
      columns: [
        { name: 'periodo_academico_sk', keyType: 'primary' as const },
        { name: 'gestion' },
        { name: 'periodo' },
      ],
    },
  ],
  relationships: [
    {
      id: 'programa-fact',
      source: 'dim_programa',
      target: 'fact_cursado',
      sourceColumn: 'programa_sk',
      targetColumn: 'programa_sk',
    },
    {
      id: 'periodo-fact',
      source: 'dim_periodo_academico',
      target: 'fact_cursado',
      sourceColumn: 'periodo_academico_sk',
      targetColumn: 'periodo_academico_sk',
    },
  ],
  dimensions: [
    {
      name: 'Programa',
      hierarchy: 'Program',
      levels: ['Faculty', 'Career'],
    },
    {
      name: 'Periodo',
      hierarchy: 'Periodo',
      levels: ['Gestión', 'Periodo'],
    },
  ],
  measures: [
    {
      name: 'Inscripciones en materias',
      column: 'conteo_intento',
      aggregator: 'sum',
    },
    { name: 'Nota promedio', column: 'nota_final', aggregator: 'avg' },
  ],
};

const xml = `<?xml version="1.0"?>
<Schema name="UATF_DW">
  <Cube name="Rendimiento académico" defaultMeasure="Inscripciones en materias" />
</Schema>`;

const meta: Meta<typeof OlapSchemaViewer> = {
  title: 'Organisms/Admin/OLAP Schema Viewer',
  component: OlapSchemaViewer,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { schema, xml },
};
export default meta;
type Story = StoryObj<typeof OlapSchemaViewer>;

export const AcademicPerformance: Story = {};
