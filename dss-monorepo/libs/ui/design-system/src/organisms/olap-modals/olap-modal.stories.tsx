import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../../atoms/button';
import { OlapModal } from './olap-modal';

const meta: Meta<typeof OlapModal> = {
  title: 'Organisms/OLAP Modals/OlapModal',
  component: OlapModal,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof OlapModal>;

export const Default: Story = {
  args: {
    open: true,
    onOpenChange: () => undefined,
    title: 'Editar consulta',
    description: 'Revisa los parámetros antes de ejecutar la consulta.',
    children: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          El contenido del modal puede incluir controles del design system o componentes específicos del flujo OLAP.
        </p>
        <div className="rounded-md border border-border bg-muted p-3 text-sm">
          Contenido desplazable y adaptable al tamaño del modal.
        </div>
      </div>
    ),
    footer: (
      <>
        <Button variant="outline">Cancelar</Button>
        <Button>Aplicar</Button>
      </>
    ),
  },
};
