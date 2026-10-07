import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { Checkbox } from './checkbox';

const meta: Meta<typeof Checkbox> = {
  title: 'Atoms/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  args: {
    label: 'Checkbox',
    description: 'Enable this option for your account.',
    checked: false,
    onCheckedChange: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Checkbox' }));
    await expect(args.onCheckedChange).toHaveBeenCalledWith(true);
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled',
    disabled: true,
  },
};

export const Indeterminate: Story = {
  args: {
    label: 'Select all datasets',
    description: 'Some datasets in this group are selected.',
    indeterminate: true,
  },
};
