import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { Tile } from './tile';

const meta: Meta<typeof Tile> = {
  title: 'Organisms/Dashboard/Tile',
  component: Tile,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    id: 'enrollment-summary',
    title: 'Matrícula por gestión',
    subtitle: 'Estudiantes inscritos · Gestión 2026',
    statusLabel: 'Actualizado',
    className: 'w-full max-w-xl',
  },
};

export default meta;
type Story = StoryObj<typeof Tile>;

export const Default: Story = {
  args: {
    children: (
      <div className="flex h-40 items-end gap-3 border-b border-border px-4 pb-2">
        <div className="h-2/5 flex-1 rounded-t-md bg-primary/20" />
        <div className="h-3/5 flex-1 rounded-t-md bg-primary/30" />
        <div className="h-4/5 flex-1 rounded-t-md bg-primary/50" />
        <div className="h-full flex-1 rounded-t-md bg-primary" />
      </div>
    ),
  },
};

export const Editing: Story = { args: { editMode: true } };
export const Loading: Story = { args: { loading: true } };
export const Empty: Story = {
  args: {
    empty: true,
    emptyMessage: 'No hay datos para el periodo seleccionado.',
  },
};
export const RecoverableError: Story = {
  args: { error: 'No se pudieron cargar los indicadores.', onRetry: fn() },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Reintentar' }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
};
