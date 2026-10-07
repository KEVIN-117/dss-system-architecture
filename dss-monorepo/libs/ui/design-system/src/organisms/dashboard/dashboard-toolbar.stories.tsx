import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { DashboardToolbar } from './dashboard-toolbar';

const meta: Meta<typeof DashboardToolbar> = {
  title: 'Organisms/Dashboard/DashboardToolbar',
  component: DashboardToolbar,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    title: 'Resumen académico',
    description:
      'Indicadores y tendencias de matrícula para orientar la gestión.',
    context: 'Decanato',
    periodLabel: 'Gestión 2026',
    onFilters: fn(),
    onExport: fn(),
    onEditModeChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof DashboardToolbar>;

export const Default: Story = {};

export const EditAndSave: Story = {
  args: { editMode: true, onSave: fn(), saving: false },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Guardar diseño' }),
    );
    await expect(args.onSave).toHaveBeenCalledOnce();
  },
};

export const Refreshing: Story = {
  args: { actions: [{ label: 'Actualizando', onClick: fn(), loading: true }] },
};
