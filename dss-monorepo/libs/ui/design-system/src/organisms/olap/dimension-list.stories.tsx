import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import type { SaikuDimension, SaikuMeasure } from '@dss-monorepo/olap-models';
import { DimensionList } from './dimension-list';

const dimensions: SaikuDimension[] = [
  {
    name: 'Location',
    caption: 'Ubicación',
    uniqueName: '[Location]',
    hierarchies: [
      {
        name: 'Geography',
        caption: 'Geografía',
        uniqueName: '[Location].[Geography]',
        levels: [
          {
            name: 'Country',
            caption: 'País',
            uniqueName: '[Location].[Geography].[Country]',
          },
          {
            name: 'City',
            caption: 'Ciudad',
            uniqueName: '[Location].[Geography].[City]',
          },
        ],
      },
    ],
  },
  {
    name: 'Time',
    caption: 'Tiempo',
    uniqueName: '[Time]',
    hierarchies: [
      {
        name: 'Calendar',
        caption: 'Calendario',
        uniqueName: '[Time].[Calendar]',
        levels: [
          {
            name: 'Year',
            caption: 'Año',
            uniqueName: '[Time].[Calendar].[Year]',
          },
        ],
      },
    ],
  },
];

const measures: SaikuMeasure[] = [
  { name: 'Sales', caption: 'Ventas netas', uniqueName: '[Measures].[Sales]' },
  { name: 'Orders', caption: 'Pedidos', uniqueName: '[Measures].[Orders]' },
];

const meta: Meta<typeof DimensionList> = {
  title: 'Organisms/OLAP/DimensionList',
  component: DimensionList,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { dimensions, measures, onAddItem: fn() },
};

export default meta;
type Story = StoryObj<typeof DimensionList>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Agregar Ciudad a filas' }),
    );
    await expect(args.onAddItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '[Location].[Geography].[City]',
        kind: 'level',
      }),
      'ROWS',
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Agregar Ventas netas a columnas' }),
    );
    await expect(args.onAddItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: '[Measures].[Sales]', kind: 'measure' }),
      'COLUMNS',
    );
  },
};

export const Search: Story = {
  play: async ({ canvas, userEvent }) => {
    const search = canvas.getByRole('textbox', {
      name: 'Buscar dimensiones y medidas',
    });
    await userEvent.type(search, 'pedido');
    await expect(canvas.getByText('Pedidos')).toBeInTheDocument();
    await expect(canvas.queryByText('Ventas netas')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Ubicación')).not.toBeInTheDocument();
  },
};

export const Loading: Story = { args: { loading: true } };
export const ErrorState: Story = {
  args: { error: 'No se pudieron cargar los metadatos.' },
};
export const Empty: Story = { args: { dimensions: [], measures: [] } };
