import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';
import { DoorOpen, Percent, CheckCircle2, Users } from 'lucide-react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '../atoms/button';
import { useAsyncResource } from '../hooks/use-async-resource';
import { AcademicContextBadge } from './academic-context-badge';
import { ChartFrame } from './chart-frame';
import { DeltaBadge } from './delta-badge';
import {
  ChartSkeleton,
  EmptyState,
  PaginationBar,
  StatusBanner,
} from './feedback';
import { FilterBar } from './filter-bar';
import { KpiCard } from './kpi-card';
import { NativeSelect } from './native-select';
import { PageContainer, PageHeader } from './page-header';

interface PrimitiveArgs {
  onRetry?: () => void;
  onPageChange?: (page: number) => void;
  onChange?: (id: string) => void;
  loader?: (signal: AbortSignal) => Promise<string>;
}

const meta: Meta<PrimitiveArgs> = {
  title: 'Page/Primitives',
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<PrimitiveArgs>;

const integer = (value: number) => new Intl.NumberFormat('es-BO').format(Math.round(value));
const percent = (value: number) =>
  `${new Intl.NumberFormat('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)} %`;

/* -------------------------------------------------------------------------- */

export const DeltaBadges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <DeltaBadge value={2.4} unit="pp" />
      <DeltaBadge value={-1.5} unit="pp" goodWhen="down" />
      <DeltaBadge value={0.8} unit="pp" goodWhen="down" />
      <DeltaBadge value={0.01} unit="%" />
      <DeltaBadge value={null} unit="%" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="delta-badge"]');
    await expect(badges[0]).toHaveAttribute('data-tone', 'good');
    // Dropout going down is good news.
    await expect(badges[1]).toHaveAttribute('data-tone', 'good');
    // Dropout going up is bad news, even though the number rises.
    await expect(badges[2]).toHaveAttribute('data-tone', 'bad');
    await expect(badges[3]).toHaveAttribute('data-direction', 'flat');
    await expect(badges[0]).toHaveTextContent(
      'Sube 2,4 puntos porcentuales frente a la gestión anterior',
    );
    await expect(canvasElement).toHaveTextContent('Sin comparación');
  },
};

/* -------------------------------------------------------------------------- */

function KpiRow({ loading = false }: { loading?: boolean }) {
  const [applications, setApplications] = React.useState(547);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Postulaciones"
          icon={<DoorOpen />}
          value={applications}
          format={integer}
          delta={{ value: 5, unit: '%' }}
          loading={loading}
        />
        <KpiCard
          label="Tasa de admisión"
          icon={<Percent />}
          value={62.4}
          format={percent}
          delta={{ value: 1.8, unit: 'pp' }}
          loading={loading}
        />
        <KpiCard
          label="Aprobación"
          icon={<CheckCircle2 />}
          value={75.9}
          format={percent}
          delta={{ value: 2.4, unit: 'pp' }}
          loading={loading}
        />
        <KpiCard
          label="Permanencia observada"
          icon={<Users />}
          value={null}
          format={percent}
          detail="El cubo de permanencia aún no publica esta gestión"
          loading={loading}
        />
      </div>
      <div>
        <Button variant="outline" onClick={() => setApplications((value) => value + 31)}>
          Simular actualización
        </Button>
      </div>
    </div>
  );
}

export const KpiCards: Story = {
  render: () => <KpiRow />,
  play: async ({ canvas }) => {
    // The animated number is hidden from readers; the final value is announced.
    await expect(canvas.getByText('547', { selector: '.sr-only' })).toBeInTheDocument();
    await expect(canvas.getByText('Sin dato', { selector: '.sr-only' })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Simular actualización' }));
    await expect(canvas.getByText('578', { selector: '.sr-only' })).toBeInTheDocument();
  },
};

export const KpiCardsLoading: Story = {
  render: () => <KpiRow loading />,
  play: async ({ canvasElement }) => {
    const cards = canvasElement.querySelectorAll('[data-slot="kpi-card"]');
    await expect(cards).toHaveLength(4);
    for (const card of cards) await expect(card).toHaveAttribute('aria-busy', 'true');
  },
};

/* -------------------------------------------------------------------------- */

export const Feedback: Story = {
  args: { onRetry: fn(), onPageChange: fn() },
  render: (args) => (
    <div className="flex max-w-3xl flex-col gap-4">
      <StatusBanner
        title="No se pudo cargar el desglose por carrera"
        description="El servicio OLAP no respondió. El resto del panel sigue disponible."
        onRetry={args.onRetry}
      />
      <StatusBanner
        tone="warning"
        title="Retención 2025 incompleta"
        description="El cubo de Permanencia aún no publica el segundo semestre."
      />
      <EmptyState
        title="No hay datos para la gestión 2024 en esta carrera"
        description="Elige otra gestión o revisa si el cierre académico ya se publicó."
      />
      <PaginationBar
        page={0}
        pageSize={5}
        total={12}
        onPageChange={(page) => args.onPageChange?.(page)}
      />
    </div>
  ),
  play: async ({ args, canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('No se pudo cargar el desglose');
    await expect(canvas.getAllByRole('status')[0]).toHaveTextContent('Retención 2025 incompleta');
    await userEvent.click(canvas.getByRole('button', { name: 'Reintentar' }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
    await expect(canvas.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    await userEvent.click(canvas.getByRole('button', { name: 'Siguiente' }));
    await expect(args.onPageChange).toHaveBeenCalledWith(1);
    await expect(canvas.getByText('Mostrando 1–5 de 12')).toBeInTheDocument();
  },
};

export const ChartFrameStates: Story = {
  render: () => (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartFrame title="Evolución por gestión" description="2019–2025" loading height={200} />
      <ChartFrame
        title="Composición por modalidad"
        height={200}
        error={{ message: 'El cubo de Admisión no está disponible.', onRetry: () => undefined }}
      />
      <ChartFrame
        title="Desglose por carrera"
        height={200}
        empty={{ title: 'Sin datos para esta selección', description: 'Prueba con otra gestión.' }}
      />
      <ChartFrame title="Postulaciones" height={200} refreshing>
        <ChartSkeleton height={200} />
      </ChartFrame>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Evolución por gestión' })).toBeInTheDocument();
    await expect(canvas.getByRole('alert')).toHaveTextContent('No se pudo cargar el gráfico');
    await expect(canvas.getByText('Actualizando datos…')).toBeInTheDocument();
  },
};

/* -------------------------------------------------------------------------- */

const DIRECTOR_CONTEXTS = [
  {
    id: 'sis',
    unit: 'Ingeniería de Sistemas',
    shortUnit: 'Sistemas',
    parent: 'Facultad de Ciencias Puras',
  },
  {
    id: 'inf',
    unit: 'Ingeniería Informática',
    shortUnit: 'Informática',
    parent: 'Facultad de Ciencias Puras',
  },
];

export const AcademicContextSingle: Story = {
  render: () => (
    <AcademicContextBadge
      roleLabel="Decano"
      contexts={[{ id: 'puras', unit: 'Facultad de Ciencias Puras', shortUnit: 'Cs. Puras' }]}
      currentId="puras"
      gestion="2025"
    />
  ),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('note', {
        name: 'Contexto académico: Decano, Facultad de Ciencias Puras, gestión 2025',
      }),
    ).toBeInTheDocument();
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  },
};

function ContextSwitcher({ onChange }: { onChange: (id: string) => void }) {
  const [current, setCurrent] = React.useState('sis');
  return (
    <AcademicContextBadge
      roleLabel="Directora de carrera"
      contexts={DIRECTOR_CONTEXTS}
      currentId={current}
      gestion="2025"
      onContextChange={(id) => {
        setCurrent(id);
        onChange(id);
      }}
    />
  );
}

export const AcademicContextSelector: Story = {
  args: { onChange: fn() },
  render: (args) => <ContextSwitcher onChange={(id) => args.onChange?.(id)} />,
  play: async ({ args, canvas, canvasElement }) => {
    const trigger = canvas.getByRole('button', { name: /Ingeniería de Sistemas.*Cambiar contexto/ });
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole('menuitemradio', { name: /Ingeniería Informática/ }));
    await expect(args.onChange).toHaveBeenCalledWith('inf');
    await waitFor(() =>
      expect(canvas.getByRole('button', { name: /Ingeniería Informática/ })).toBeInTheDocument(),
    );
  },
};

/* -------------------------------------------------------------------------- */

function AsyncDemo({
  loader = () => Promise.resolve('Datos'),
}: {
  loader?: (signal: AbortSignal) => Promise<string>;
}) {
  const [year, setYear] = React.useState('2025');
  const resource = useAsyncResource((signal) => loader(signal).then((value) => `${value} ${year}`), [year]);
  return (
    <div className="flex flex-col gap-3">
      <NativeSelect
        label="Gestión"
        value={year}
        onChange={(event) => setYear(event.currentTarget.value)}
        options={['2025', '2024'].map((value) => ({ value, label: value }))}
      />
      <p data-testid="status">{resource.status}</p>
      <p data-testid="data">{resource.data ?? '—'}</p>
    </div>
  );
}

export const AsyncResourceKeepsPreviousData: Story = {
  args: {
    loader: fn(
      (signal: AbortSignal) =>
        new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => resolve('Datos'), 80);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    ),
  },
  render: (args) => <AsyncDemo loader={args.loader} />,
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByTestId('data')).toHaveTextContent('Datos 2025'));
    await userEvent.selectOptions(canvas.getByLabelText('Gestión'), '2024');
    // While the new year loads, the previous data stays on screen.
    await expect(canvas.getByTestId('status')).toHaveTextContent('refreshing');
    await expect(canvas.getByTestId('data')).toHaveTextContent('Datos 2025');
    await waitFor(() => expect(canvas.getByTestId('data')).toHaveTextContent('Datos 2024'));
    await expect(canvas.getByTestId('status')).toHaveTextContent('success');
  },
};

/* -------------------------------------------------------------------------- */

export const DashboardPage: Story = {
  render: () => (
    <div className="relative min-h-svh p-6 lg:p-8">
      <PageContainer>
        <PageHeader
          eyebrow="Director · Ingeniería de Sistemas"
          title="Resumen de la carrera"
          description="Cómo evolucionan admisión, rendimiento y permanencia de tu carrera respecto a la gestión anterior."
          meta="Actualizado hoy, 08:42"
          actions={
            <>
              <Button variant="outline">Actualizar datos</Button>
              <Button variant="brand">Ver reportes</Button>
            </>
          }
        />
        <FilterBar sticky={false} aside="Datos limitados a tu carrera">
          <NativeSelect
            label="Carrera"
            options={DIRECTOR_CONTEXTS.map((context) => ({ value: context.id, label: context.unit }))}
          />
          <NativeSelect
            label="Gestión"
            options={['2025', '2024', '2023'].map((value) => ({ value, label: value }))}
          />
        </FilterBar>
        <KpiRow />
        <ChartFrame title="Evolución por gestión" description="2019–2025" height={240}>
          <ChartSkeleton height={240} />
        </ChartFrame>
      </PageContainer>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1, name: 'Resumen de la carrera' })).toBeInTheDocument();
    await expect(canvas.getByRole('group', { name: 'Filtros' })).toBeInTheDocument();
    await expect(canvas.getByLabelText('Carrera')).toHaveValue('sis');
  },
};
