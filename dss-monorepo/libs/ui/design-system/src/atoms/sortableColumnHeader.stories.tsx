import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SortableColumnHeader } from './sortableColumnHeader';

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof SortableColumnHeader> = {
  title: 'Atoms/SortableColumnHeader',
  component: SortableColumnHeader,
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: 'text',
      description: 'The visible column header label.',
    },
    sortKey: {
      control: 'text',
      description: 'Unique key that identifies this column for sorting.',
    },
    activeKey: {
      control: 'text',
      description:
        'The key of the currently active (sorted) column. When equal to `sortKey` the directional icon is shown.',
    },
    direction: {
      control: 'select',
      options: ['asc', 'desc'],
      description:
        'Sort direction displayed when this column is the active sort column.',
    },
    testid: {
      control: 'text',
      description: 'Optional `data-testid` passed through to the button.',
    },
  },
};

export default meta;
type Story = StoryObj<typeof SortableColumnHeader>;

// ---------------------------------------------------------------------------
// Default (Playground) — inactive column
// ---------------------------------------------------------------------------

export const Default: Story = {
  args: {
    label: 'Nombre',
    sortKey: 'name',
    activeKey: 'other', // not the active column → shows the up/down icon
    direction: 'asc',
  },
};

// ---------------------------------------------------------------------------
// Active ascending
// ---------------------------------------------------------------------------

export const ActiveAscending: Story = {
  args: {
    label: 'Puntaje',
    sortKey: 'score',
    activeKey: 'score', // this column IS active
    direction: 'asc',
  },
};

// ---------------------------------------------------------------------------
// Active descending
// ---------------------------------------------------------------------------

export const ActiveDescending: Story = {
  args: {
    label: 'Fecha',
    sortKey: 'date',
    activeKey: 'date',
    direction: 'desc',
  },
};

// ---------------------------------------------------------------------------
// Inactive column (idle state)
// ---------------------------------------------------------------------------

export const Inactive: Story = {
  args: {
    label: 'Carrera',
    sortKey: 'career',
    activeKey: 'name', // different key → idle up/down arrow
    direction: 'asc',
  },
};

// ---------------------------------------------------------------------------
// Interactive — simulates toggling sort within a single column
// ---------------------------------------------------------------------------

const InteractiveUi = () => {
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');

  const handleToggle = () =>
    setDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));

  return (
    <div className="flex flex-col gap-3 items-start">
      <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
        Click the header to cycle direction
      </span>
      <SortableColumnHeader
        label="Promedio"
        sortKey="average"
        activeKey="average"
        direction={direction}
        onToggle={handleToggle}
        testid="sort-average"
      />
      <span className="text-xs text-muted-foreground">
        Current direction:{' '}
        <span className="font-semibold text-foreground">{direction}</span>
      </span>
    </div>
  );
};

export const Interactive: Story = {
  render: () => <InteractiveUi />,
};

// ---------------------------------------------------------------------------
// Multi-column table simulation
// ---------------------------------------------------------------------------

type ColKey = 'nombre' | 'carrera' | 'puntaje' | 'fecha';

const COLUMNS: { key: ColKey; label: string }[] = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'carrera', label: 'Carrera' },
  { key: 'puntaje', label: 'Puntaje' },
  { key: 'fecha', label: 'Fecha' },
];

const ROWS = [
  {
    nombre: 'Ana Torres',
    carrera: 'Ing. Sistemas',
    puntaje: 92,
    fecha: '2025-03-01',
  },
  {
    nombre: 'Carlos Méndez',
    carrera: 'Matemáticas',
    puntaje: 78,
    fecha: '2025-01-15',
  },
  {
    nombre: 'Lucía Vargas',
    carrera: 'Ing. Civil',
    puntaje: 85,
    fecha: '2025-02-10',
  },
  {
    nombre: 'Miguel Ríos',
    carrera: 'Ing. Sistemas',
    puntaje: 67,
    fecha: '2024-12-20',
  },
  {
    nombre: 'Sofía Luna',
    carrera: 'Estadística',
    puntaje: 91,
    fecha: '2025-04-05',
  },
];

const TableSimulationUi = () => {
  const [activeKey, setActiveKey] = useState<ColKey>('nombre');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');

  const handleToggle = (key: ColKey) => {
    if (key === activeKey) {
      setDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setActiveKey(key);
      setDirection('asc');
    }
  };

  const sorted = [...ROWS].sort((a, b) => {
    const av = a[activeKey];
    const bv = b[activeKey];
    const cmp = String(av).localeCompare(String(bv), undefined, {
      numeric: true,
    });
    return direction === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="w-full max-w-2xl rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {COLUMNS.map(({ key, label }) => (
              <th key={key} className="px-3 py-1 text-left font-medium">
                <SortableColumnHeader
                  label={label}
                  sortKey={key}
                  activeKey={activeKey}
                  direction={direction}
                  onToggle={handleToggle}
                  testid={`sort-${key}`}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={row.nombre}
              className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
            >
              <td className="px-4 py-2">{row.nombre}</td>
              <td className="px-4 py-2">{row.carrera}</td>
              <td className="px-4 py-2 tabular-nums">{row.puntaje}</td>
              <td className="px-4 py-2 tabular-nums font-mono text-xs">
                {row.fecha}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const TableSimulation: Story = {
  render: () => <TableSimulationUi />,
};

// ---------------------------------------------------------------------------
// All states at a glance
// ---------------------------------------------------------------------------

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
        All visual states
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {/* Inactive / idle */}
        <SortableColumnHeader
          label="Inactive"
          sortKey="a"
          activeKey="b"
          direction="asc"
          onToggle={() => undefined}
        />

        {/* Active ASC */}
        <SortableColumnHeader
          label="Active ASC"
          sortKey="b"
          activeKey="b"
          direction="asc"
          onToggle={() => undefined}
        />

        {/* Active DESC */}
        <SortableColumnHeader
          label="Active DESC"
          sortKey="c"
          activeKey="c"
          direction="desc"
          onToggle={() => undefined}
        />
      </div>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Cyberpunk / DSS themed showcase
// ---------------------------------------------------------------------------

type DssKey = 'estudiante' | 'modulo' | 'rendimiento' | 'riesgo';

const DSS_COLS: { key: DssKey; label: string }[] = [
  { key: 'estudiante', label: 'ESTUDIANTE' },
  { key: 'modulo', label: 'MÓDULO' },
  { key: 'rendimiento', label: 'RENDIMIENTO' },
  { key: 'riesgo', label: 'RIESGO' },
];

const DSS_ROWS = [
  {
    estudiante: 'A. Torres',
    modulo: 'Álgebra',
    rendimiento: 94,
    riesgo: 'BAJO',
  },
  {
    estudiante: 'C. Méndez',
    modulo: 'Cálculo',
    rendimiento: 61,
    riesgo: 'ALTO',
  },
  { estudiante: 'L. Vargas', modulo: 'POO', rendimiento: 82, riesgo: 'MEDIO' },
  { estudiante: 'M. Ríos', modulo: 'BD', rendimiento: 55, riesgo: 'ALTO' },
  {
    estudiante: 'S. Luna',
    modulo: 'Estadística',
    rendimiento: 90,
    riesgo: 'BAJO',
  },
];

const riskColor: Record<string, string> = {
  BAJO: 'text-success',
  MEDIO: 'text-warning',
  ALTO: 'text-destructive',
};

const CyberpunkUi = () => {
  const [activeKey, setActiveKey] = useState<DssKey>('rendimiento');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');

  const handleToggle = (key: DssKey) => {
    if (key === activeKey) {
      setDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setActiveKey(key);
      setDirection('asc');
    }
  };

  const sorted = [...DSS_ROWS].sort((a, b) => {
    const av = a[activeKey];
    const bv = b[activeKey];
    const cmp = String(av).localeCompare(String(bv), undefined, {
      numeric: true,
    });
    return direction === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="w-full max-w-2xl rounded-lg border border-primary/30 bg-background/80 shadow-md font-mono text-xs overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-primary/20 bg-primary/5">
        <span className="font-bold text-primary tracking-widest text-[11px]">
          {'// DSS_RENDIMIENTO_ACADÉMICO'}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary">
          LIVE
        </span>
      </div>

      {/* Table */}
      <table className="w-full">
        <thead className="bg-foreground/5">
          <tr>
            {DSS_COLS.map(({ key, label }) => (
              <th
                key={key}
                className="px-3 py-1 text-left font-medium text-muted-foreground"
              >
                <SortableColumnHeader
                  label={label}
                  sortKey={key}
                  activeKey={activeKey}
                  direction={direction}
                  onToggle={handleToggle}
                  testid={`dss-sort-${key}`}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={row.estudiante}
              className={[
                'border-t border-foreground/5 transition-colors',
                i % 2 === 0 ? 'bg-transparent' : 'bg-card/[0.02]',
              ].join(' ')}
            >
              <td className="px-4 py-2 text-foreground">{row.estudiante}</td>
              <td className="px-4 py-2 text-muted-foreground">{row.modulo}</td>
              <td className="px-4 py-2 tabular-nums text-primary font-semibold">
                {row.rendimiento}
                <span className="text-muted-foreground font-normal">%</span>
              </td>
              <td
                className={`px-4 py-2 font-bold tracking-widest ${riskColor[row.riesgo]}`}
              >
                {row.riesgo}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const Cyberpunk: Story = {
  render: () => <CyberpunkUi />,
};
