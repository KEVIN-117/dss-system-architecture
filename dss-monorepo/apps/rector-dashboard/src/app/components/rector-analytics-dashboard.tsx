'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@dss-monorepo/design-system';
import { AcademicBarChart, TrendLineChart } from '@dss-monorepo/charts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  readDimensionSeries,
  readDimensionSeriesByLevels,
  readMetric,
  readPublishedMembers,
  resolveAcademicCubePaths,
  sortAcademicPeriods,
  type AcademicCubePaths,
  type ChartPoint,
  type PublishedMember,
} from './analytics-data';

interface CubeSummary {
  cubeId: string;
  cubeName: string;
  cubeCaption?: string | null;
}

interface AnalyticsState {
  enrollment: number | null;
  averageGrade: number | null;
  facultySeries: ChartPoint[];
  periodSeries: ChartPoint[];
  facultyCount: number;
  cutLabel: string;
}

const EMPTY_ANALYTICS: AnalyticsState = {
  enrollment: null,
  averageGrade: null,
  facultySeries: [],
  periodSeries: [],
  facultyCount: 0,
  cutLabel: 'Cubo académico publicado',
};

const CUBES_QUERY = `query RectorCubes {
  olapCubes { cubeId cubeName cubeCaption }
}`;
const SCHEMA_QUERY = `query RectorCubeSchema($cubeId: ID!) {
  olapCubeSchema(cubeId: $cubeId)
}`;
const MEMBERS_QUERY = `query RectorCubeMembers($cubeId: ID!, $dimension: String!, $hierarchy: String!, $level: String!, $limit: Int) {
  olapCubeMembers(cubeId: $cubeId, dimension: $dimension, hierarchy: $hierarchy, level: $level, limit: $limit) { name uniqueName caption }
}`;
const ANALYTIC_QUERY = `query RectorAnalyticQuery($input: AnalyticQueryInput!) {
  analyticQuery(input: $input) { status data totalRows runtimeMs }
}`;
const CARD_CLASS =
  'border border-border bg-card shadow-sm ring-0 backdrop-blur-none';

async function graphql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_BFF_URL?.replace(/\/$/, '');
  if (!baseUrl)
    throw new Error('El portal no tiene configurada la URL del BFF.');
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error(
      'No se pudo conectar con el BFF. Revisa la conexión e inténtalo nuevamente.',
    );
  }
  const payload = (await response.json().catch(() => null)) as {
    data?: T;
    errors?: Array<{ message?: string; extensions?: { code?: string } }>;
  } | null;
  if (!response.ok || payload?.errors?.length) {
    const code = payload?.errors?.[0]?.extensions?.code;
    if (response.status === 401 || code === 'UNAUTHENTICATED')
      throw new Error(
        'La sesión expiró. Inicia sesión nuevamente para consultar la analítica.',
      );
    if (response.status === 403 || code === 'FORBIDDEN')
      throw new Error(
        'La cuenta no tiene permiso para consultar esta analítica.',
      );
    throw new Error(
      payload?.errors?.[0]?.message ??
        'No se pudo consultar la analítica institucional.',
    );
  }
  if (!payload?.data) throw new Error('El BFF devolvió una respuesta vacía.');
  return payload.data;
}

function makePeriodFilter(
  paths: AcademicCubePaths,
  member: PublishedMember | null,
) {
  if (!member) return [];
  return [
    {
      ...paths.academicYear,
      op: 'IN' as const,
      members: [member.uniqueName],
    },
  ];
}

export function RectorAnalyticsDashboard() {
  const [cubeId, setCubeId] = useState('');
  const [paths, setPaths] = useState<AcademicCubePaths | null>(null);
  const [periodMembers, setPeriodMembers] = useState<PublishedMember[]>([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [analytics, setAnalytics] = useState<AnalyticsState>(EMPTY_ANALYTICS);
  const [initialLoading, setInitialLoading] = useState(true);
  const [queryLoading, setQueryLoading] = useState(false);
  const [filterReady, setFilterReady] = useState(false);
  const [error, setError] = useState('');
  const [emptyMessage, setEmptyMessage] = useState('');

  const selectedMember = useMemo(
    () =>
      periodMembers.find(
        (member) =>
          member.caption === selectedYear || member.name === selectedYear,
      ) ?? null,
    [periodMembers, selectedYear],
  );

  const loadCube = useCallback(async () => {
    setInitialLoading(true);
    setError('');
    setFilterReady(false);
    setCubeId('');
    setPaths(null);
    setPeriodMembers([]);
    setAnalytics(EMPTY_ANALYTICS);
    setEmptyMessage('');
    try {
      const cubesResponse = await graphql<{ olapCubes: CubeSummary[] }>(
        CUBES_QUERY,
      );
      const cube = (cubesResponse.olapCubes ?? []).find(
        (candidate) =>
          candidate.cubeName.toLocaleLowerCase() === 'academic performance' ||
          candidate.cubeCaption?.toLocaleLowerCase() === 'academic performance',
      );
      if (!cube) {
        setEmptyMessage(
          'El cubo Academic Performance no está publicado para esta conexión.',
        );
        return;
      }
      const schemaResponse = await graphql<{ olapCubeSchema: unknown }>(
        SCHEMA_QUERY,
        { cubeId: cube.cubeId },
      );
      const resolvedPaths = resolveAcademicCubePaths(
        schemaResponse.olapCubeSchema,
      );
      if (!resolvedPaths)
        throw new Error(
          'El esquema publicado no contiene las medidas y dimensiones requeridas para el tablero del Rector.',
        );
      const membersResponse = await graphql<{ olapCubeMembers: unknown }>(
        MEMBERS_QUERY,
        {
          cubeId: cube.cubeId,
          ...resolvedPaths.academicYear,
          limit: 100,
        },
      );
      const members = readPublishedMembers(membersResponse.olapCubeMembers);
      const url = new URL(window.location.href);
      const requestedYear = url.searchParams.get('gestion') ?? '';
      const urlMember = members.find(
        (member) =>
          member.caption === requestedYear || member.name === requestedYear,
      );
      setCubeId(cube.cubeId);
      setPaths(resolvedPaths);
      setPeriodMembers(members);
      setSelectedYear(urlMember?.caption ?? '');
      setFilterReady(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo cargar el esquema académico.',
      );
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCube();
  }, [loadCube]);

  const loadAnalytics = useCallback(async () => {
    if (!cubeId || !paths || !filterReady) return;
    setQueryLoading(true);
    setError('');
    setEmptyMessage('');
    try {
      const filters = makePeriodFilter(paths, selectedMember);
      const baseInput = { cubeId, filters, limit: 100 };
      const overviewRequest = graphql<{
        analyticQuery: { data: unknown[]; totalRows: number };
      }>(ANALYTIC_QUERY, {
        input: {
          ...baseInput,
          measures: [
            { name: paths.enrollmentAttempts },
            { name: paths.averageFinalGrade },
          ],
        },
      });
      const facultyRequest = graphql<{
        analyticQuery: { data: unknown[]; totalRows: number };
      }>(ANALYTIC_QUERY, {
        input: {
          ...baseInput,
          measures: [{ name: paths.enrollmentAttempts }],
          rows: [{ ...paths.faculty }],
          order: [{ by: paths.enrollmentAttempts, direction: 'DESC' }],
        },
      });
      const periodRequest = selectedMember
        ? Promise.resolve(null)
        : graphql<{ analyticQuery: { data: unknown[]; totalRows: number } }>(
            ANALYTIC_QUERY,
            {
              input: {
                ...baseInput,
                measures: [{ name: paths.enrollmentAttempts }],
                rows: [{ ...paths.academicYear }, { ...paths.academicPeriod }],
              },
            },
          );
      const [overview, faculty, period] = await Promise.all([
        overviewRequest,
        facultyRequest,
        periodRequest,
      ]);
      const overviewRows = overview.analyticQuery.data ?? [];
      const facultySeries = readDimensionSeries(
        faculty.analyticQuery.data,
        paths.faculty.level,
        paths.enrollmentAttempts,
      ).sort((left, right) => right.value - left.value);
      const periodSeries = period
        ? sortAcademicPeriods(
            readDimensionSeriesByLevels(
              period.analyticQuery.data,
              [paths.academicYear.level, paths.academicPeriod.level],
              paths.enrollmentAttempts,
            ),
          )
        : [];
      const enrollment = readMetric(overviewRows, paths.enrollmentAttempts);
      const averageGrade = readMetric(overviewRows, paths.averageFinalGrade);
      const hasAnyValues =
        enrollment !== null ||
        averageGrade !== null ||
        facultySeries.length > 0 ||
        periodSeries.length > 0;
      const cutLabel = selectedMember
        ? `Filtro temporal: gestión ${selectedMember.caption ?? selectedMember.name}`
        : periodSeries.at(-1)?.label
          ? `Histórico completo · última gestión con actividad: ${periodSeries.at(-1)?.label}`
          : 'Histórico completo · sin periodos con actividad';
      setAnalytics({
        enrollment,
        averageGrade,
        facultySeries: facultySeries.slice(0, 12),
        facultyCount: faculty.analyticQuery.totalRows ?? facultySeries.length,
        periodSeries,
        cutLabel,
      });
      setEmptyMessage(
        hasAnyValues
          ? ''
          : 'El cubo está disponible, pero no tiene indicadores para los filtros seleccionados.',
      );
      const url = new URL(window.location.href);
      if (selectedMember)
        url.searchParams.set(
          'gestion',
          String(selectedMember.caption ?? selectedMember.name),
        );
      else url.searchParams.delete('gestion');
      window.history.replaceState({}, '', url);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudieron cargar los indicadores del cubo.',
      );
    } finally {
      setQueryLoading(false);
    }
  }, [cubeId, filterReady, paths, selectedMember]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const formatInteger = (value: number | null) =>
    value === null
      ? '—'
      : new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(
          value,
        );
  const formatGrade = (value: number | null) =>
    value === null
      ? '—'
      : new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 }).format(
          value,
        );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-5 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Analítica institucional</Badge>
            <Badge variant="secondary">Alcance global</Badge>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Rendimiento académico
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Indicadores agregados del cubo institucional de rendimiento
            académico. Los datos siguen el alcance global autorizado para
            Rectoría.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void loadCube()}
          disabled={initialLoading || queryLoading}
        >
          {initialLoading || queryLoading
            ? 'Actualizando…'
            : 'Actualizar datos'}
        </Button>
        <a
          className="w-fit text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href="/predictions"
        >
          Consultar predicciones de abandono
        </a>
      </header>

      <section
        aria-label="Filtros de analítica"
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="space-y-1">
          <label
            htmlFor="academic-year"
            className="text-sm font-medium text-foreground"
          >
            Gestión académica
          </label>
          <p id="academic-year-help" className="text-xs text-muted-foreground">
            Filtra los indicadores por una gestión publicada en el cubo.
          </p>
        </div>
        <select
          id="academic-year"
          aria-describedby="academic-year-help"
          className="min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-xs"
          value={selectedYear}
          onChange={(event) => setSelectedYear(event.target.value)}
          disabled={initialLoading || periodMembers.length === 0}
        >
          <option value="">Todas las gestiones</option>
          {periodMembers.map((member) => {
            const label = member.caption ?? member.name;
            return (
              <option value={label} key={member.uniqueName}>
                {label}
              </option>
            );
          })}
        </select>
      </section>

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-foreground">{error}</p>
          <Button
            variant="outline"
            onClick={() => void (cubeId ? loadAnalytics() : loadCube())}
          >
            Reintentar
          </Button>
        </div>
      )}

      {emptyMessage && !initialLoading && !queryLoading && !error && (
        <div
          role="status"
          className="rounded-lg border border-border bg-muted/30 p-6 text-sm text-muted-foreground"
        >
          {emptyMessage}
        </div>
      )}

      <section
        aria-label="Indicadores institucionales"
        aria-busy={initialLoading || queryLoading}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <MetricCard
          label={
            selectedMember
              ? `Intentos acumulados · gestión ${selectedMember.caption ?? selectedMember.name}`
              : 'Intentos acumulados · histórico'
          }
          formattedValue={formatInteger(analytics.enrollment)}
          unit={paths?.enrollmentUnit ?? 'intentos'}
          loading={initialLoading || queryLoading}
        />
        <MetricCard
          label={
            selectedMember
              ? `Nota final promedio · gestión ${selectedMember.caption ?? selectedMember.name}`
              : 'Nota final promedio · histórico'
          }
          formattedValue={formatGrade(analytics.averageGrade)}
          unit={paths?.gradeUnit ?? 'escala de calificación institucional'}
          loading={initialLoading || queryLoading}
        />
        <MetricCard
          label="Facultades con actividad"
          formattedValue={formatInteger(
            initialLoading || queryLoading ? null : analytics.facultyCount,
          )}
          unit="facultades"
          loading={initialLoading || queryLoading}
        />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Corte visible:{' '}
          <span className="font-medium text-foreground">
            {initialLoading ? 'consultando…' : analytics.cutLabel}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          Fuente: cubo OLAP Academic Performance
        </p>
      </div>

      <section
        aria-label="Visualizaciones institucionales"
        className="grid gap-5 xl:grid-cols-2"
      >
        <Card className={`min-w-0 ${CARD_CLASS}`}>
          <CardHeader>
            <CardTitle>Intentos por facultad</CardTitle>
            <CardDescription>
              Suma de intentos de inscripción agrupada por facultad para la
              cobertura seleccionada.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-80">
            {initialLoading ? (
              <ChartSkeleton />
            ) : (
              <AcademicBarChart
                data={analytics.facultySeries}
                title="Intentos de inscripción por facultad"
                ariaLabel={`Intentos de inscripción por facultad, ${analytics.facultySeries.length} facultades. ${analytics.cutLabel}.`}
                loading={queryLoading}
                emptyMessage="No hay actividad de inscripción para esta gestión."
                height={320}
              />
            )}
          </CardContent>
        </Card>

        <Card className={`min-w-0 ${CARD_CLASS}`}>
          <CardHeader>
            <CardTitle>Tendencia por periodo académico</CardTitle>
            <CardDescription>
              {selectedMember
                ? 'La serie histórica se omite al seleccionar una gestión para evitar mezclar periodos.'
                : 'Intentos agregados por gestión y periodo del cubo publicado.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-80">
            {initialLoading ? (
              <ChartSkeleton />
            ) : selectedMember ? (
              <div
                role="status"
                className="grid min-h-80 place-items-center rounded-md bg-muted/20 p-6 text-center text-sm text-muted-foreground"
              >
                Selecciona “Todas las gestiones” para consultar la tendencia
                histórica completa.
              </div>
            ) : (
              <TrendLineChart
                data={analytics.periodSeries}
                title="Intentos por gestión y periodo"
                ariaLabel={`Tendencia de intentos de inscripción por periodo académico. ${analytics.periodSeries.length} periodos.`}
                loading={queryLoading}
                emptyMessage="El cubo no devolvió periodos con actividad."
                height={320}
              />
            )}
          </CardContent>
        </Card>
      </section>

      <footer className="border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
        Las cifras corresponden a agregados disponibles en el cubo OLAP. Los
        filtros refinan la consulta; el BFF conserva la autorización y el
        alcance global de Rectoría.
      </footer>
    </div>
  );
}

function MetricCard({
  label,
  formattedValue,
  unit,
  loading,
}: {
  label: string;
  formattedValue: string;
  unit: string;
  loading: boolean;
}) {
  return (
    <Card className={CARD_CLASS}>
      <CardContent className="p-5">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {loading ? (
          <div
            className="mt-3 h-9 w-28 animate-pulse rounded bg-muted"
            aria-label="Cargando indicador"
          />
        ) : (
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
            {formattedValue}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{unit}</p>
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <div
      className="grid h-80 animate-pulse place-items-center rounded-md bg-muted/30"
      role="status"
      aria-label="Cargando visualización"
    >
      <div
        className="flex h-40 w-3/4 items-end justify-center gap-4"
        aria-hidden="true"
      >
        <span className="h-16 w-8 rounded-t bg-muted" />
        <span className="h-28 w-8 rounded-t bg-muted" />
        <span className="h-24 w-8 rounded-t bg-muted" />
        <span className="h-36 w-8 rounded-t bg-muted" />
      </div>
    </div>
  );
}
