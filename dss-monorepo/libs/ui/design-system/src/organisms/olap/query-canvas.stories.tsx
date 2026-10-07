import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import type { AxisLocation } from '@dss-monorepo/olap-models';
import { QueryCanvas } from './query-canvas';
import type { OlapQueryAxes, OlapQueryItem } from './types';

const sales: OlapQueryItem = {
  id: '[Measures].[Sales]',
  label: 'Ventas netas',
  kind: 'measure',
};
const city: OlapQueryItem = {
  id: '[Geography].[City]',
  label: 'Ciudad',
  kind: 'level',
  dimensionUniqueName: '[Geography]',
  hierarchyUniqueName: '[Geography].[Hierarchy]',
  levelUniqueName: '[Geography].[Hierarchy].[City]',
};
const axes: OlapQueryAxes = {
  FILTER: [],
  COLUMNS: [sales],
  ROWS: [city],
  PAGES: [],
};

const meta: Meta<typeof QueryCanvas> = {
  title: 'Organisms/OLAP/QueryCanvas',
  component: QueryCanvas,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { axes, onRemoveItem: fn(), onMoveItem: fn(), onClearAxis: fn() },
};

export default meta;
type Story = StoryObj<typeof QueryCanvas>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.selectOptions(
      canvas.getByRole('combobox', {
        name: 'Mover Ventas netas desde columnas',
      }),
      'ROWS',
    );
    await expect(args.onMoveItem).toHaveBeenCalledWith(
      sales,
      'COLUMNS',
      'ROWS',
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Quitar Ciudad de filas' }),
    );
    await expect(args.onRemoveItem).toHaveBeenCalledWith(city, 'ROWS');
    await userEvent.click(
      canvas.getByRole('button', { name: 'Vaciar eje columnas' }),
    );
    await expect(args.onClearAxis).toHaveBeenCalledWith(
      'COLUMNS' satisfies AxisLocation,
    );
  },
};

export const Empty: Story = {
  args: {
    axes: { FILTER: [], COLUMNS: [], ROWS: [], PAGES: [] },
  },
};
