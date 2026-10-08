import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowRightIcon, SparklesIcon } from 'lucide-react';
import { expect, fn } from 'storybook/test';
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
        'primary',
        'destructive',
        'outline',
        'secondary',
        'ghost',
        'link',
        'text',
      ],
    },
    size: {
      control: 'select',
      options: [
        'default',
        'xs',
        'sm',
        'lg',
        'icon',
        'icon-xs',
        'icon-sm',
        'icon-lg',
        'none',
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: 'Botón Primario',
    variant: 'default',
    onClick: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Botón Primario' }));
    await expect(args.onClick).toHaveBeenCalledOnce();
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

export const TextAction: Story = {
  args: {
    children: 'Skip for now',
    variant: 'text',
    size: 'none',
  },
};

export const WithIcons: Story = {
  args: {
    children: 'View report',
    iconLeft: <SparklesIcon />,
    iconRight: <ArrowRightIcon />,
  },
};

export const Loading: Story = {
  args: {
    children: 'Saving report',
    loading: true,
  },
};

export const FullWidth: Story = {
  args: {
    children: 'Continue',
    fullWidth: true,
  },
};
