import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../atoms/button';
import { Tooltip } from './tooltip';

const meta: Meta<typeof Tooltip> = {
  title: 'Molecules/Tooltip',
  component: Tooltip,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Basic: Story = {
  args: {
    text: 'Guardar los cambios',
    children: <Button variant="outline">Guardar</Button>,
  },
};
