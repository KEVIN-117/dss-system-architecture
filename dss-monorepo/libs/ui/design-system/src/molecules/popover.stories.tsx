import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../atoms/button';
import { Popover } from './popover';

const meta: Meta<typeof Popover> = {
  title: 'Molecules/Popover',
  component: Popover,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof Popover>;

export const Basic: Story = {
  args: {
    trigger: <Button variant="outline">Abrir detalles</Button>,
    children: <div className="space-y-1"><h3 className="font-medium">Panel contextual</h3><p className="text-sm text-muted-foreground">Contenido relacionado con el control activador.</p></div>,
  },
};
