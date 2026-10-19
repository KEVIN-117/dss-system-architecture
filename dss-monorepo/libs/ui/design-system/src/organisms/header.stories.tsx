import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { Header } from './header';

const meta = {
  title: 'Organisms/Header',
  component: Header,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen', a11y: { test: 'error' } },
  args: {
    appName: 'DSS académico',
    contextLabel: 'Espacio institucional',
    onMenuClick: fn(),
    onSearch: fn(),
    onDisconnect: fn(),
    onProfileClick: fn(),
    onNotificationsClick: fn(),
  },
  decorators: [
    (Story) => (
      <div className="bg-background text-foreground">
        <Story />
        <main className="px-4 py-8 sm:px-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Resumen académico
          </h1>
          <p className="mt-2 max-w-prose text-base leading-7 text-muted-foreground">
            Consulta informes y explora los resultados de tu ámbito académico.
          </p>
        </main>
      </div>
    ),
  ],
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoggedIn: Story = {
  args: {
    user: { name: 'María Fernández', email: 'maria.fernandez@example.edu' },
    notificationCount: 3,
  },
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    const previewBody = (
      canvasElement as HTMLElement & { ownerDocument: { body: HTMLElement } }
    ).ownerDocument.body;
    const page = within(previewBody);
    await userEvent.type(
      canvas.getByRole('searchbox', { name: 'Buscar en el espacio académico' }),
      'rendimiento',
    );
    await expect(args.onSearch).toHaveBeenLastCalledWith('rendimiento');
    await userEvent.click(
      canvas.getByRole('button', { name: 'Cuenta de María Fernández' }),
    );
    await expect(page.getByText('maria.fernandez@example.edu')).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Cerrar sesión' }));
    await expect(args.onDisconnect).toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    await expect(
      canvas.getByRole('button', { name: 'Cuenta de María Fernández' }),
    ).toHaveFocus();
  },
};

export const Guest: Story = {
  args: { onSignIn: fn(), onNotificationsClick: undefined },
};

export const LongIdentity: Story = {
  args: {
    contextLabel:
      'Facultad de Ciencias Económicas, Financieras y Administrativas',
    user: {
      name: 'María Fernanda Fernández Rodríguez',
      email: 'maria.fernanda.fernandez.rodriguez@example.edu',
    },
    notificationCount: 120,
  },
};

export const DarkMode: Story = {
  ...LoggedIn,
  globals: { colorMode: 'dark' },
  play: undefined,
};
