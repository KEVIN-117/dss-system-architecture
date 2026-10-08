import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Radio } from './radio';

const meta: Meta<typeof Radio> = {
  title: 'Atoms/Radio',
  component: Radio,
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: 'text',
      description: 'Value represented by this radio option.',
    },
    group: {
      control: 'text',
      description: 'Selected value when the radio is controlled.',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether this option is disabled.',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Radio>;

export const Default: Story = {
  args: {
    value: 'grid',
    name: 'visualization-default',
    label: 'Grid layout',
    description: 'Show results in a grid of cards.',
    defaultChecked: true,
  },
};

export const ControlledGroup: Story = {
  render: () => {
    const ControlledRadioGroup = () => {
      const [selectedView, setSelectedView] = useState('table');

      return (
        <div className="flex flex-col gap-4">
          <Radio
            name="visualization-controlled"
            value="grid"
            group={selectedView}
            onGroupChange={setSelectedView}
            label="Grid layout"
            description="Compare summaries across cards."
          />
          <Radio
            name="visualization-controlled"
            value="table"
            group={selectedView}
            onGroupChange={setSelectedView}
            label="Table layout"
            description="Inspect detailed rows and columns."
          />
          <Radio
            name="visualization-controlled"
            value="chart"
            group={selectedView}
            onGroupChange={setSelectedView}
            label="Chart layout"
            description="Explore trends visually."
          />
          <p className="text-sm text-muted-foreground">
            Selected value: <code>{selectedView}</code>
          </p>
        </div>
      );
    };

    return <ControlledRadioGroup />;
  },
};

export const Disabled: Story = {
  args: {
    value: 'unavailable',
    name: 'availability',
    label: 'Unavailable option',
    description: 'This option cannot be selected.',
    disabled: true,
  },
};
