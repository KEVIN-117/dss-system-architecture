import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { Select } from './select';

const meta: Meta<typeof Select> = {
  title: 'Atoms/Select',
  component: Select,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    disabled: {
      control: 'boolean',
    },
    multiple: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  args: {
    name: 'datasource-type',
    'aria-label': 'Tipo de origen de datos',
    defaultValue: 'OLAP',
    onChange: fn(),
    children: (
      <>
        <option value="OLAP">Semantic Layer (Mondrian)</option>
        <option value="RELATIONAL">Relational</option>
        <option value="OSSIE">Ossie (SQL semantic model)</option>
      </>
    ),
  },
  play: async ({ args, canvas, userEvent }) => {
    const select = canvas.getByRole('combobox', { name: 'Tipo de origen de datos' });
    await userEvent.selectOptions(select, 'OSSIE');
    await expect(select).toHaveValue('OSSIE');
    await expect(args.onChange).toHaveBeenCalledOnce();
  },
};

export const Disabled: Story = {
  args: {
    name: 'disabled-select',
    defaultValue: 'saiku',
    disabled: true,
    children: (
      <>
        <option value="saiku">saiku</option>
        <option value="audit">saiku-audit</option>
      </>
    ),
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="grid max-w-sm gap-3">
      <Select size="sm" defaultValue="small" aria-label="Small select">
        <option value="small">Small</option>
        <option value="medium">Medium</option>
      </Select>
      <Select size="md" defaultValue="medium" aria-label="Medium select">
        <option value="small">Small</option>
        <option value="medium">Medium</option>
      </Select>
      <Select size="lg" defaultValue="large" aria-label="Large select">
        <option value="large">Large</option>
        <option value="medium">Medium</option>
      </Select>
    </div>
  ),
};

export const Multiple: Story = {
  args: {
    name: 'multiple-logs',
    multiple: true,
    defaultValue: ['saiku', 'saiku-audit'],
    children: (
      <>
        <option value="saiku">saiku</option>
        <option value="saiku-audit">saiku-audit</option>
        <option value="mondrian_sql">mondrian_sql</option>
        <option value="mondrian">mondrian</option>
      </>
    ),
  },
};
