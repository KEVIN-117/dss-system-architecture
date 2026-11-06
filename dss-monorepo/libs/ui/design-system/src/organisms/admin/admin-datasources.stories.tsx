import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { AdminDatasources } from './admin-datasources';
import type { AdminDatasourceRecord } from './types';

const datasources: AdminDatasourceRecord[] = [
  {
    id: 'uatf-warehouse',
    name: 'UATF Warehouse',
    connectiontype: 'MONDRIAN',
    location: 'jdbc:postgresql://postgres-dw:5432/dss_dw',
    driver: 'org.postgresql.Driver',
    schemaName: 'uatf-rendimiento-academico.xml',
    username: 'olap_reader',
  },
  {
    id: 'student-success',
    name: 'Student Success XMLA',
    connectiontype: 'XMLA',
    location: 'https://analytics.example.edu/xmla',
    schemaName: 'Student Success',
  },
];

const meta: Meta<typeof AdminDatasources> = {
  title: 'Organisms/Admin/OLAP Connections',
  component: AdminDatasources,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    datasources,
    onRefresh: fn(),
    onCreate: fn(),
    onUpdate: fn(),
    onDelete: fn(),
    onReconnect: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof AdminDatasources>;

export const Connections: Story = {};
export const Loading: Story = { args: { loading: true } };
export const Empty: Story = { args: { datasources: [] } };
export const LoadError: Story = {
  args: {
    datasources: [],
    error: 'El BFF respondió con un error. Intenta nuevamente.',
  },
};
