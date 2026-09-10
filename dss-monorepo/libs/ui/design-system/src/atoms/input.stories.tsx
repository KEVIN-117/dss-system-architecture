import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './input';

const meta: Meta<typeof Input> = {
  title: 'Atoms/Input',
  component: Input,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    type: 'text',
    placeholder: 'Enter secure terminal command...',
  },
};

export const Disabled: Story = {
  args: {
    type: 'text',
    placeholder: 'Access Denied',
    disabled: true,
  },
};
