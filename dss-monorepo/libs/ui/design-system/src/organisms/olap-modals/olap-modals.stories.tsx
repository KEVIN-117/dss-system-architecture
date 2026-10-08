import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConfirmModal } from './common-modals';
import { DateFilterModal, type DateFilterConfig } from './date-filter-modal';
import { ChartEditorModal, CalculatedMemberModal } from './editor-modals';
import { FilterModal, MDXModal } from './filter-modals';
import { MeasuresModal } from './measure-modals';
import { SaveQueryModal } from './repository-modals';

const meta: Meta = {
  title: 'Organisms/OLAP Modals/Workflows',
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj;

export const Confirm: Story = {
  render: () => (
    <ConfirmModal
      open
      title="Eliminar consulta"
      message="Esta acción eliminará la consulta guardada. ¿Quieres continuar?"
      confirmLabel="Eliminar"
      destructive
      onConfirm={() => undefined}
      onCancel={() => undefined}
    />
  ),
};

export const MDXQuery: Story = {
  render: () => (
    <MDXModal
      open
      mdx="SELECT {[Measures].[Sales]} ON COLUMNS FROM [Sales]"
      onRun={() => undefined}
      onCancel={() => undefined}
    />
  ),
};

export const AxisFilter: Story = {
  render: () => (
    <FilterModal
      open
      axis="ROWS"
      expression="[Measures].[Unit Sales] > 100000"
      onSave={() => undefined}
      onCancel={() => undefined}
    />
  ),
};

export const SaveQuery: Story = {
  render: () => (
    <SaveQueryModal
      open
      defaultName="Sales by region"
      defaultFolder="reports/monthly"
      folders={['', 'reports', 'reports/monthly', 'shared']}
      onSave={() => undefined}
      onCancel={() => undefined}
    />
  ),
};

export const Measures: Story = {
  render: () => (
    <MeasuresModal
      open
      available={[
        { uniqueName: '[Measures].[Sales]', name: 'Sales', caption: 'Net Sales' },
        { uniqueName: '[Measures].[Orders]', name: 'Orders', calculated: true },
        { uniqueName: '[Measures].[Margin]', name: 'Margin', visible: false },
      ]}
      selectedUniqueNames={['[Measures].[Sales]']}
      isAdmin
      onSave={() => undefined}
      onCancel={() => undefined}
    />
  ),
};

const initialDateConfig: DateFilterConfig = {
  mode: 'relative',
  preset: 'LAST_N_DAYS',
  count: 7,
  from: '',
  to: '',
  compare: 'NONE',
  shiftUnit: 'year',
  shiftCount: 1,
};

export const DateFilter: Story = {
  render: () => (
    <DateFilterModal
      open
      hierarchyCaption="Order Date"
      defaultConfig={initialDateConfig}
      previewMdx={() => '{[Date].[Calendar].[Date].Members}'}
      onApply={() => undefined}
      onCancel={() => undefined}
    />
  ),
};

export const ChartEditor: Story = {
  render: () => (
    <ChartEditorModal
      open
      fields={[
        { name: 'title', label: 'Título', type: 'text' },
        { name: 'type', label: 'Tipo de gráfico', type: 'select', options: [{ value: 'bar', label: 'Barras' }, { value: 'line', label: 'Líneas' }] },
        { name: 'legend', label: 'Mostrar leyenda', type: 'checkbox' },
      ]}
      initialValues={{ title: 'Ventas por región', type: 'bar', legend: true }}
      onSave={() => undefined}
      onCancel={() => undefined}
    >
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Vista previa del gráfico</div>
    </ChartEditorModal>
  ),
};

export const CalculatedMember: Story = {
  render: () => (
    <CalculatedMemberModal
      open
      hierarchies={['[Measures]', '[Date].[Calendar]']}
      measures={[{ caption: 'Net Sales', uniqueName: '[Measures].[Net Sales]' }]}
      initial={{ name: 'Average Sales', parent: '[Measures]', formula: '[Measures].[Net Sales] / [Measures].[Orders]', formatString: '#,##0.00' }}
      onSave={() => undefined}
      onCancel={() => undefined}
    />
  ),
};
