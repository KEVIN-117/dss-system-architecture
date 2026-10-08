import type { Meta, StoryObj } from '@storybook/react-vite';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../atoms/button';
import { DropdownMenuSeparator, MenuItem } from '../atoms/dropdown';
import { DropdownMenu } from './dropdown-menu';

const meta: Meta<typeof DropdownMenu> = {
  title: 'Molecules/DropdownMenu',
  component: DropdownMenu,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof DropdownMenu>;

export const Actions: Story = {
  args: {
    trigger: (
      <Button aria-label="Acciones" variant="outline" size="icon">
        <MoreHorizontal />
      </Button>
    ),
    children: (
      <>
        <MenuItem icon={<Pencil />} shortcut="⌘E">
          Editar
        </MenuItem>
        <DropdownMenuSeparator />
        <MenuItem icon={<Trash2 />} variant="destructive">
          Eliminar
        </MenuItem>
      </>
    ),
  },
};
