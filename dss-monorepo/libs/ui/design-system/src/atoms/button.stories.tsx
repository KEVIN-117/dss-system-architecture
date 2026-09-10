import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button';

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'destructive',
        'outline',
        'secondary',
        'ghost',
        'link',
      ],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: 'Botón Primario',
    variant: 'default',
  },
};

export const Outline: Story = {
  args: {
    children: 'Botón Secundario',
    variant: 'outline',
  },
};

export const Destructive: Story = {
  args: {
    children: 'Acción Peligrosa',
    variant: 'destructive',
    asChild: false,
  },
};
