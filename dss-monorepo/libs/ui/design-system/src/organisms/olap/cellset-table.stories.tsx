import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import type { QueryResult } from '@dss-monorepo/olap-models';
import { CellsetTable } from './cellset-table';

const result: QueryResult = {
  query: {
    name: 'Matrícula por gestión',
    queryType: 'OLAP',
    type: 'MDX',
    mdx: '',
    cube: {
      connection: 'UATF Analytics',
      catalog: 'Academic',
      schema: 'public',
      name: 'Enrollment',
      caption: 'Matrícula',
      uniqueName: '[Enrollment]',
      visible: true,
    },
  },
  cellset: [
    [
      { type: 'ROW_HEADER_HEADER', value: 'Sede' },
      { type: 'COLUMN_HEADER', value: 'Estudiantes' },
    ],
    [
      { type: 'ROW_HEADER', value: 'Potosí' },
      { type: 'DATA_CELL', value: '1.248' },
    ],
    [
      { type: 'ROW_HEADER', value: 'Tupiza' },
      { type: 'DATA_CELL', value: '386' },
    ],
  ],
};

const meta: Meta<typeof CellsetTable> = {
  title: 'Organisms/OLAP/CellsetTable',
  component: CellsetTable,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { result },
};

export default meta;
type Story = StoryObj<typeof CellsetTable>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('table', {
        name: 'Resultado OLAP: Matrícula por gestión',
      }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('rowheader', { name: 'Potosí' }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('cell', { name: '1.248' }),
    ).toBeInTheDocument();
  },
};

export const Loading: Story = { args: { result: undefined, loading: true } };
export const ErrorState: Story = {
  args: {
    result: undefined,
    error: 'La consulta excedió el tiempo disponible.',
  },
};
export const Empty: Story = { args: { result: { cellset: [] } } };
