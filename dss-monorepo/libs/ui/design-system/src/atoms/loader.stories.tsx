import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Loader } from './loader';

const meta: Meta<typeof Loader> = {
  title: 'Atoms/Loader',
  component: Loader,
  tags: ['autodocs'],
  args: { fullScreen: false },
};
export default meta;
type Story = StoryObj<typeof Loader>;

export const Session: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(
      'Verificando sesión…',
    );
  },
};
export const Report: Story = { args: { text: 'Cargando reporte…' } };
