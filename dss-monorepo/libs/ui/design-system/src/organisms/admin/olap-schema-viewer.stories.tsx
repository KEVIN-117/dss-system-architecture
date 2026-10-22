import type { Meta, StoryObj } from '@storybook/react-vite';
import { OlapSchemaViewer } from './olap-schema-viewer';

const schema = {
  schemaName: 'UATF_DW',
  cubeName: 'Academic Performance',
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
      name: 'Academic Program',
      hierarchy: 'Program',
      levels: ['Faculty', 'Career'],
    },
    {
      name: 'Academic Period',
      hierarchy: 'Academic Period',
      levels: ['Academic Year', 'Period Number'],
    },
  ],
  measures: [
    {
      name: 'Enrollment Attempts',
      column: 'conteo_intento',
      aggregator: 'sum',
    },
    { name: 'Average Final Grade', column: 'nota_final', aggregator: 'avg' },
  ],
};

const xml = `<?xml version="1.0"?>
<Schema name="UATF_DW">
  <Cube name="Academic Performance" defaultMeasure="Enrollment Attempts" />
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
