import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from '@storybook/test';
import { AuthLanding } from './auth-landing';

const meta: Meta<typeof AuthLanding> = {
  title: 'Organisms/AuthLanding',
  component: AuthLanding,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    onLogin: fn(),
    onRegister: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof AuthLanding>;

export const Default: Story = {};

export const CustomText: Story = {
  args: {
    title: 'Portal de Análisis',
    description: 'Ingresa con tu cuenta de analista de datos.',
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
  },
};

export const WithError: Story = {
  args: {
    error:
      'Tus credenciales han expirado. Por favor, inicia sesión nuevamente.',
  },
};

export const NoRegisterOption: Story = {
  args: {
    onRegister: undefined,
  },
};
