import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import {
  ArrowDownToLine,
  ChartNoAxesCombined,
  Grip,
  Plus,
  RotateCcw,
  Save,
} from 'lucide-react';
import { Button } from '../../atoms/button';
import { Badge } from '../../atoms/badge';
import { DashboardGrid, type DashboardGridTile } from './dashboard-grid';
import { DashboardToolbar } from './dashboard-toolbar';
import { Tile } from './tile';

function ChartPreview({
  variant = 'bars',
}: {
  variant?: 'bars' | 'line' | 'donut';
}) {
  if (variant === 'donut') {
    return (
      <div className="flex h-full min-h-36 items-center justify-center gap-6">
        <div className="grid size-28 place-items-center rounded-full border-[14px] border-primary/25 border-t-primary border-r-primary/70">
          <span className="text-xl font-semibold tabular-nums">82%</span>
        </div>
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li>
            Continúa: <strong className="text-foreground">82%</strong>
          </li>
          <li>
            Interrupción: <strong className="text-foreground">12%</strong>
          </li>
          <li>
            Egreso: <strong className="text-foreground">6%</strong>
          </li>
        </ul>
      </div>
    );
  }
  return (
    <div
      className="flex h-full min-h-36 items-end gap-3 border-b border-border px-4 pb-2"
      aria-label={
        variant === 'line'
          ? 'Tendencia de matrícula'
          : 'Comparación por gestión'
      }
    >
      {[38, 54, 49, 69, 63, 84, 93].map((height, index) => (
        <div
          key={index}
          className="relative flex-1 rounded-t-md bg-primary/70"
          style={{ height: `${height}%` }}
        >
          <span className="sr-only">
            Periodo {index + 1}: {height}
          </span>
        </div>
      ))}
    </div>
  );
}

function makeTiles(onRemove?: (id: string) => void): DashboardGridTile[] {
  return [
    {
      id: 'enrollment',
      defaultLayout: {
        id: 'enrollment',
        x: 0,
        y: 0,
        w: 6,
        h: 5,
        minW: 3,
        minH: 3,
      },
      content: (
        <Tile
          id="enrollment"
          title="Matrícula por gestión"
          subtitle="Evolución de estudiantes inscritos"
          statusLabel="Actualizado"
          actions={
            onRemove
              ? [
                  {
                    label: 'Quitar del tablero',
                    onClick: () => onRemove('enrollment'),
                  },
                ]
              : []
          }
        >
          <ChartPreview />
        </Tile>
      ),
    },
    {
      id: 'retention',
      defaultLayout: {
        id: 'retention',
        x: 6,
        y: 0,
        w: 6,
        h: 5,
        minW: 3,
        minH: 3,
      },
      content: (
        <Tile
          id="retention"
          title="Permanencia estudiantil"
          subtitle="Cohorte de ingreso · Gestión 2026"
          statusLabel="82%"
        >
          <ChartPreview variant="donut" />
        </Tile>
      ),
    },
    {
      id: 'faculty-growth',
      defaultLayout: {
        id: 'faculty-growth',
        x: 0,
        y: 5,
        w: 8,
        h: 4,
        minW: 4,
        minH: 3,
      },
      content: (
        <Tile
          id="faculty-growth"
          title="Crecimiento por facultad"
          subtitle="Cambio frente a la gestión anterior"
          actions={
            onRemove
              ? [
                  {
                    label: 'Quitar del tablero',
                    onClick: () => onRemove('faculty-growth'),
                  },
                ]
              : []
          }
        >
          <ul className="grid gap-3 text-sm sm:grid-cols-3">
            <li className="rounded-lg bg-muted p-3">
              Ciencias de la Salud{' '}
              <strong className="ml-2 tabular-nums">+8.2%</strong>
            </li>
            <li className="rounded-lg bg-muted p-3">
              Ciencias Puras{' '}
              <strong className="ml-2 tabular-nums">+5.6%</strong>
            </li>
            <li className="rounded-lg bg-muted p-3">
              Tecnología <strong className="ml-2 tabular-nums">+3.1%</strong>
            </li>
          </ul>
        </Tile>
      ),
    },
  ];
}

const baseTiles = makeTiles();
const meta: Meta<typeof DashboardGrid> = {
  title: 'Organisms/Dashboard/DashboardGrid',
  component: DashboardGrid,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { tiles: baseTiles, className: 'w-full' },
};

export default meta;
type Story = StoryObj<typeof DashboardGrid>;

export const Overview: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(
      canvas.getByRole('region', { name: 'Distribución del dashboard' }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('heading', { name: 'Matrícula por gestión' }),
    ).toBeInTheDocument();
  },
};

function DashboardShowcase() {
  const [tiles, setTiles] = React.useState<DashboardGridTile[]>(() =>
    makeTiles((id) =>
      setTiles((current) => current.filter((tile) => tile.id !== id)),
    ),
  );
  const [layouts, setLayouts] = React.useState<
    Record<string, { id: string; x: number; y: number; w: number; h: number }[]>
  >({});
  const [editing, setEditing] = React.useState(false);
  const [saved, setSaved] = React.useState(true);
  const [nextId, setNextId] = React.useState(1);

  const addWidget = React.useCallback(() => {
    const id = `custom-${nextId}`;
    setNextId((current) => current + 1);
    setTiles((current) => [
      ...current,
      {
        id,
        defaultLayout: { id, x: 0, y: Infinity, w: 4, h: 4, minW: 3, minH: 3 },
        content: (
          <Tile
            id={id}
            title="Indicador personalizado"
            subtitle="Widget añadido al tablero"
            actions={[
              {
                label: 'Quitar del tablero',
                onClick: () =>
                  setTiles((items) => items.filter((tile) => tile.id !== id)),
              },
            ]}
          >
            <div className="flex h-32 flex-col justify-center gap-2">
              <p className="text-3xl font-semibold tabular-nums">1,284</p>
              <p className="text-sm text-muted-foreground">
                Registros del periodo seleccionado
              </p>
            </div>
          </Tile>
        ),
      },
    ]);
    setSaved(false);
  }, [nextId]);

  const removeWidget = React.useCallback((id: string) => {
    setTiles((current) => current.filter((tile) => tile.id !== id));
    setSaved(false);
  }, []);
  const gridTiles = React.useMemo(
    () =>
      makeTiles(removeWidget)
        .filter((tile) => tiles.some((current) => current.id === tile.id))
        .concat(tiles.filter((tile) => tile.id.startsWith('custom-'))),
    [tiles, removeWidget],
  );
  const saveLayout = () => {
    setSaved(true);
    setEditing(false);
  };

  return (
    <div className="space-y-6">
      <DashboardToolbar
        title="Resumen académico"
        description="Organiza tus indicadores para dar seguimiento a los objetivos de tu unidad."
        context="Decanato"
        periodLabel="Gestión 2026"
        lastUpdated="hace unos minutos"
        editMode={editing}
        onEditModeChange={setEditing}
        onSave={saveLayout}
        onExport={fn()}
        onFilters={fn()}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant={saved ? 'secondary' : 'outline'}>
            {saved ? 'Diseño guardado' : 'Cambios sin guardar'}
          </Badge>
          <span>{gridTiles.length} visualizaciones</span>
          {editing && (
            <span>
              Arrastra desde el encabezado o usa el tirador de esquina para
              ajustar el tamaño.
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={addWidget}>
            <Plus aria-hidden="true" />
            Añadir visualización
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setTiles(makeTiles(removeWidget));
              setLayouts({});
              setSaved(false);
            }}
          >
            <RotateCcw aria-hidden="true" />
            Restablecer
          </Button>
        </div>
      </div>
      <DashboardGrid
        tiles={gridTiles}
        layouts={layouts}
        editable={editing}
        onLayoutChange={(breakpoint, layout) => {
          setLayouts((current) => ({ ...current, [breakpoint]: layout }));
          setSaved(false);
        }}
      />
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Save aria-hidden="true" className="size-3.5" />
        Los cambios de distribución se guardan solo al pulsar “Guardar diseño”.
      </p>
    </div>
  );
}

export const InteractiveShowcase: Story = {
  render: () => <DashboardShowcase />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Personalizar' }));
    await userEvent.click(
      canvas.getByRole('button', { name: 'Añadir visualización' }),
    );
    await expect(
      canvas.getByRole('heading', { name: 'Indicador personalizado' }),
    ).toBeInTheDocument();
    await expect(canvas.getByText('4 visualizaciones')).toBeInTheDocument();
  },
};

export const DragAndDrop: Story = {
  args: { tiles: baseTiles, editable: true, onLayoutChange: fn() },
  play: async ({ args, canvas, userEvent }) => {
    await expect(
      canvas.getByRole('img', { name: 'Mover Matrícula por gestión' }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('region', { name: 'Distribución del dashboard' }),
    ).toBeInTheDocument();
    await userEvent.click(
      canvas.getByLabelText('Más acciones para Matrícula por gestión'),
    );
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Mover Matrícula por gestión hacia derecha',
      }),
    );
    await expect(args.onLayoutChange).toHaveBeenCalled();
  },
};

export const ResizeOnly: Story = {
  args: { tiles: baseTiles, resizable: true, draggable: false },
  parameters: {
    docs: {
      description: {
        story:
          'Permite ajustar el tamaño desde la esquina inferior derecha sin mover las tarjetas.',
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(
      canvas
        .getByRole('region', { name: 'Distribución del dashboard' })
        .querySelector('.react-resizable-handle'),
    ).not.toBeNull();
  },
};

export const StaticWidget: Story = {
  args: {
    tiles: [
      {
        ...baseTiles[0],
        defaultLayout: { ...baseTiles[0].defaultLayout!, static: true },
      },
      ...baseTiles.slice(1),
    ],
    editable: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Las tarjetas estáticas mantienen su posición y tamaño mientras el resto del tablero puede personalizarse.',
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.queryByRole('img', { name: 'Mover Matrícula por gestión' }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole('img', { name: 'Mover Permanencia estudiantil' }),
    ).toBeInTheDocument();
  },
};

export const SizeConstraints: Story = {
  args: {
    tiles: [
      {
        ...baseTiles[0],
        defaultLayout: {
          ...baseTiles[0].defaultLayout!,
          minW: 4,
          maxW: 7,
          minH: 4,
          maxH: 7,
        },
      },
      ...baseTiles.slice(1),
    ],
    editable: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Define límites mínimos y máximos por visualización para conservar legibilidad.',
      },
    },
  },
};

export const ResponsiveLayouts: Story = {
  args: {
    tiles: baseTiles,
    editable: true,
    layouts: {
      lg: [
        { id: 'enrollment', x: 0, y: 0, w: 8, h: 5 },
        { id: 'retention', x: 8, y: 0, w: 4, h: 5 },
        { id: 'faculty-growth', x: 0, y: 5, w: 12, h: 4 },
      ],
      sm: [
        { id: 'enrollment', x: 0, y: 0, w: 3, h: 4 },
        { id: 'retention', x: 3, y: 0, w: 3, h: 4 },
        { id: 'faculty-growth', x: 0, y: 4, w: 6, h: 4 },
      ],
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Cada breakpoint puede guardar su propia distribución; cambia el ancho del canvas para revisar la adaptación.',
      },
    },
  },
};

export const ExternalWidgetDrop: Story = {
  args: { tiles: baseTiles, editable: true, externalDrop: true },
  render: () => <ExternalDropDemo />,
  play: async ({ canvas, userEvent }) => {
    await expect(
      canvas.getByRole('heading', { name: 'Caja de herramientas' }),
    ).toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole('button', { name: 'Añadir visualización' }),
    );
    await expect(
      canvas.getByRole('heading', { name: 'Gráfico de comparación' }),
    ).toBeInTheDocument();
  },
};

function ExternalDropDemo() {
  const [tiles, setTiles] = React.useState(baseTiles);
  const addWidget = React.useCallback(
    (position?: { x: number; y: number; w: number; h: number }) => {
      const id = `toolbox-${tiles.length + 1}`;
      setTiles((current) => [
        ...current,
        {
          id,
          defaultLayout: {
            id,
            x: position?.x ?? 0,
            y: position?.y ?? Infinity,
            w: position?.w ?? 4,
            h: position?.h ?? 4,
            minW: 3,
            minH: 3,
          },
          content: (
            <Tile
              id={id}
              title="Gráfico de comparación"
              subtitle="Agregado desde la caja de herramientas"
            >
              <ChartPreview variant="line" />
            </Tile>
          ),
        },
      ]);
    },
    [tiles.length],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 p-4">
        <div className="mr-auto">
          <h2 className="text-sm font-semibold">Caja de herramientas</h2>
          <p className="text-xs text-muted-foreground">
            Arrastra el elemento al tablero o usa el botón para añadirlo.
          </p>
        </div>
        <button
          type="button"
          draggable
          onDragStart={(event) =>
            event.dataTransfer.setData('text/plain', 'chart')
          }
          className="flex cursor-grab items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm active:cursor-grabbing"
          data-rgl-draggable="true"
        >
          <Grip aria-hidden="true" className="size-4 text-muted-foreground" />
          <ChartNoAxesCombined
            aria-hidden="true"
            className="size-4 text-primary"
          />
          Gráfico de comparación
        </button>
        <Button type="button" variant="outline" onClick={() => addWidget()}>
          <ArrowDownToLine aria-hidden="true" />
          Añadir visualización
        </Button>
      </div>
      <DashboardGrid
        tiles={tiles}
        editable
        externalDrop
        onDrop={(position) => addWidget(position)}
      />
    </div>
  );
}
