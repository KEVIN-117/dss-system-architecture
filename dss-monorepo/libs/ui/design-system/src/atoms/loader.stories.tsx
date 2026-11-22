import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Card } from '../molecules/card';
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

/** Session check before the portal shell exists: frosted panel over the backdrop. */
export const FullScreen: Story = {
  args: { fullScreen: true },
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole('status');
    await expect(status).toHaveAttribute('data-fullscreen', 'true');
    await expect(status).toHaveTextContent('Verificando sesión…');
  },
};

/** Inline loaders are transparent so they sit on glass cards and tables. */
export const InsideCard: Story = {
  args: { text: 'Cargando indicadores…', className: 'min-h-40' },
  render: (args) => (
    <Card className="max-w-md px-5">
      <Loader {...args} />
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole('status');
    await expect(status).toHaveAttribute('data-fullscreen', 'false');
    await expect(status).toHaveTextContent('Cargando indicadores…');
  },
};
