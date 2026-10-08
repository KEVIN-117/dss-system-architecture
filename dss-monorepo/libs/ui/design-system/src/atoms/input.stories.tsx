import type { Meta, StoryObj } from '@storybook/react-vite';
import { SearchIcon } from 'lucide-react';
import { Input } from './input';

const meta: Meta<typeof Input> = {
  title: 'Atoms/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg'],
    },
    tone: {
      control: 'select',
      options: ['default', 'destructive'],
    },
  },
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

export const WithLeadingIcon: Story = {
  args: {
    type: 'search',
    placeholder: 'Search datasets...',
    iconLeft: <SearchIcon className="size-4" />,
  },
};

export const Destructive: Story = {
  args: {
    type: 'text',
    defaultValue: 'Invalid value',
    tone: 'destructive',
    'aria-describedby': 'input-error-message',
  },
  render: (args) => (
    <div className="grid max-w-sm gap-2">
      <Input {...args} />
      <p id="input-error-message" className="text-xs text-destructive">
        Review this value before continuing.
      </p>
    </div>
  ),
};
