import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './sheet';

const meta: Meta<typeof Sheet> = {
  title: 'Atoms/Sheet',
  component: Sheet,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof Sheet>;

function SheetExample({ side }: { side: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Abrir desde {side}</Button>
      </SheetTrigger>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>Panel de configuración</SheetTitle>
          <SheetDescription>
            Ajusta las preferencias de tu sesión. Los cambios se aplicarán al guardar.
          </SheetDescription>
        </SheetHeader>
        <div className="mx-4 rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
          Aquí puedes colocar controles, filtros o contenido contextual.
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Cerrar</Button>
          </SheetClose>
          <SheetClose asChild>
            <Button>Guardar cambios</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export const Right: Story = { render: () => <SheetExample side="right" /> };
export const Left: Story = { render: () => <SheetExample side="left" /> };
export const Top: Story = { render: () => <SheetExample side="top" /> };
export const Bottom: Story = { render: () => <SheetExample side="bottom" /> };
