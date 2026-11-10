'use client';

import { AcademicBarChart, TrendLineChart } from '@dss-monorepo/charts';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@dss-monorepo/design-system';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CalendarDays,
  GraduationCap,
  UsersRound,
} from 'lucide-react';
import {
  readMetric,
  readPeriodSeries,
  readPublishedMembers,
  resolveDirectorCubePaths,
  type AcademicContextSummary,
  type ChartPoint,
  type DirectorCubePaths,
  type PublishedMember,
} from './analytics-data';

interface CubeSummary {
  cubeId: string;
  cubeName: string;
  cubeCaption?: string | null;
}

interface AnalyticsState {
  enrollmentAttempts: number | null;
  averageGrade: number | null;
  gradedAttempts: number | null;
  attemptsByPeriod: ChartPoint[];
  gradeByPeriod: ChartPoint[];
  cutLabel: string;
}

const EMPTY_ANALYTICS: AnalyticsState = {
  enrollmentAttempts: null,
  averageGrade: null,
  gradedAttempts: null,
  attemptsByPeriod: [],
  gradeByPeriod: [],
  cutLabel: 'Consultando periodo académico',
};

const VIEWER_QUERY = `query DirectorViewer {
  viewer { academicScope { kind facultyIds careerIds } }
}`;
const CUBES_QUERY = `query DirectorCubes {
  olapCubes { cubeId cubeName cubeCaption }
}`;
const SCHEMA_QUERY = `query DirectorCubeSchema($cubeId: ID!) {
  olapCubeSchema(cubeId: $cubeId)
}`;
const MEMBERS_QUERY = `query DirectorCubeMembers($cubeId: ID!, $dimension: String!, $hierarchy: String!, $level: String!, $limit: Int) {
  olapCubeMembers(cubeId: $cubeId, dimension: $dimension, hierarchy: $hierarchy, level: $level, limit: $limit) { name uniqueName caption }
}`;
const ANALYTIC_QUERY = `query DirectorAnalyticQuery($input: AnalyticQueryInput!) {
  analyticQuery(input: $input) { status data totalRows runtimeMs }
}`;
const CARD_CLASS =
  'border border-border bg-card shadow-none ring-0 backdrop-blur-none';

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
    errors?: Array<{
      message?: string;
      extensions?: {
        code?: string;
        field?: string;
        http?: { status?: number };
      };
    }>;
  } | null;
  if (!response.ok || payload?.errors?.length) {
    const graphQLError = payload?.errors?.[0];
    const code = graphQLError?.extensions?.code;
    const status = graphQLError?.extensions?.http?.status;
    const field = graphQLError?.extensions?.field;
    if (response.status === 401 || code === 'UNAUTHENTICATED') {
      throw new Error(
        'La sesión expiró. Inicia sesión nuevamente para consultar la analítica.',
      );
    }
    if (response.status === 403 || code === 'FORBIDDEN') {
      throw new Error(
        'La cuenta no tiene permiso para consultar esta analítica.',
      );
    }
    if (code === 'ACADEMIC_CONTEXT_REQUIRED') {
      throw new Error(
        'Tu cuenta no tiene una carrera académica asignada. Solicita al administrador que revise tu contexto.',
      );
    }
    const olapErrorMessages: Record<string, string> = {
      OLAP_FORBIDDEN:
        'OLAP rechazó esta consulta por permisos. Revisa el rol y el acceso al cubo.',
      OLAP_INVALID_QUERY:
        'OLAP rechazó las medidas o filtros enviados para esta consulta.',
      OLAP_QUERY_FAILED: 'OLAP no pudo ejecutar la consulta analítica.',
      OLAP_UNAVAILABLE: 'No se pudo conectar con el servicio OLAP.',
      OLAP_TIMEOUT: 'El servicio OLAP tardó demasiado en responder.',
    };
    const message =
      code === 'OLAP_INVALID_QUERY' && field === 'members'
        ? 'El cubo OLAP no reconoce la carrera asignada a tu cuenta. Solicita sincronizar el catálogo y los datos de esa carrera en el DW.'
        : ((code && olapErrorMessages[code]) ??
          graphQLError?.message ??
          'No se pudo consultar la analítica académica.');
    const diagnostic = code?.startsWith('OLAP_')
      ? ` (${code}${status ? ` · HTTP ${status}` : ''}${field ? ` · campo ${field}` : ''})`
      : '';
    throw new Error(`${message}${diagnostic}`);
  }
  if (!payload?.data) throw new Error('El BFF devolvió una respuesta vacía.');
  return payload.data;
}

function selectedPeriodFilter(
  paths: DirectorCubePaths,
  member: PublishedMember | null,
) {
  if (!member) return [];
  return [
    { ...paths.academicYear, op: 'IN' as const, members: [member.uniqueName] },
  ];
}

export function DirectorAnalyticsDashboard() {
  const [academicContext, setAcademicContext] =
    useState<AcademicContextSummary | null>(null);
  const [cubeId, setCubeId] = useState('');
  const [paths, setPaths] = useState<DirectorCubePaths | null>(null);
  const [periodMembers, setPeriodMembers] = useState<PublishedMember[]>([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [tablePage, setTablePage] = useState(0);
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
    setEmptyMessage('');
    setFilterReady(false);
    setAcademicContext(null);
    setCubeId('');
    setPaths(null);
    setPeriodMembers([]);
    setAnalytics(EMPTY_ANALYTICS);
    try {
      const viewerResponse = await graphql<{
        viewer: { academicScope: AcademicContextSummary };
      }>(VIEWER_QUERY);
      const scope = viewerResponse.viewer?.academicScope;
      if (
        scope?.kind !== 'career' ||
        scope.careerIds.length === 0 ||
        scope.facultyIds.length === 0
      ) {
        throw new Error(
          'El BFF no confirmó un contexto de carrera para esta cuenta. Solicita al administrador que revise la asignación.',
        );
      }

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
      const resolvedPaths = resolveDirectorCubePaths(
        schemaResponse.olapCubeSchema,
      );
      if (!resolvedPaths) {
        throw new Error(
          'El esquema OLAP no contiene las medidas y periodos requeridos para el tablero del Director.',
        );
      }

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
      setAcademicContext(scope);
      setCubeId(cube.cubeId);
      setPaths(resolvedPaths);
      setPeriodMembers(members);
      setSelectedYear(urlMember?.caption ?? '');
      setFilterReady(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo validar el contexto académico.',
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
      // The browser sends only the time filter. The BFF derives career scope
      // from the verified session and appends that restriction server-side.
      const filters = selectedPeriodFilter(paths, selectedMember);
      const baseInput = { cubeId, limit: 100 };
      const summaryRequest = graphql<{ analyticQuery: { data: unknown[] } }>(
        ANALYTIC_QUERY,
        {
          input: {
            ...baseInput,
            filters,
            measures: [
              { name: paths.enrollmentAttempts },
              { name: paths.averageFinalGrade },
              { name: paths.gradedAttempts },
            ],
          },
        },
      );
      const periodsRequest = graphql<{ analyticQuery: { data: unknown[] } }>(
        ANALYTIC_QUERY,
        {
          input: {
            ...baseInput,
            measures: [
              { name: paths.enrollmentAttempts },
              { name: paths.averageFinalGrade },
            ],
            rows: [{ ...paths.academicYear }, { ...paths.academicPeriod }],
          },
        },
      );
      const [summary, periods] = await Promise.all([
        summaryRequest,
        periodsRequest,
      ]);
      const rows = summary.analyticQuery.data ?? [];
      const periodRows = periods.analyticQuery.data ?? [];
      // Academic Year is also on the rows axis for this trend query. Filtering
      // that same hierarchy in the OLAP slicer makes Saiku reject the query;
      // query all rows within the server-enforced career scope, then select
      // the requested year from the already-scoped aggregate response.
      const selectedYear = selectedMember?.caption;
      const attemptsByPeriod = readPeriodSeries(
        periodRows,
        paths.academicYear.level,
        paths.academicPeriod.level,
        paths.enrollmentAttempts,
        selectedYear,
      );
      const gradeByPeriod = readPeriodSeries(
        periodRows,
        paths.academicYear.level,
        paths.academicPeriod.level,
        paths.averageFinalGrade,
        selectedYear,
      );
      const enrollmentAttempts = readMetric(rows, paths.enrollmentAttempts);
      const averageGrade = readMetric(rows, paths.averageFinalGrade);
      const gradedAttempts = readMetric(rows, paths.gradedAttempts);
      const hasData =
        enrollmentAttempts !== null ||
        averageGrade !== null ||
        gradedAttempts !== null ||
        attemptsByPeriod.length > 0;
      const label = selectedMember
        ? `Gestión ${selectedMember.caption} · periodos académicos disponibles`
        : attemptsByPeriod.at(-1)?.label
          ? `Histórico · último periodo con actividad: ${attemptsByPeriod.at(-1)?.label}`
          : 'Histórico · sin periodos con actividad';
      setAnalytics({
        enrollmentAttempts,
        averageGrade,
        gradedAttempts,
        attemptsByPeriod,
        gradeByPeriod,
        cutLabel: label,
      });
      setEmptyMessage(
        hasData
          ? ''
          : 'La carrera asignada no tiene indicadores para el periodo seleccionado.',
      );
      const url = new URL(window.location.href);
      if (selectedMember)
        url.searchParams.set('gestion', selectedMember.caption);
      else url.searchParams.delete('gestion');
      window.history.replaceState({}, '', url);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudieron cargar los indicadores de tu carrera.',
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
  const careerLabels = academicContext?.careerIds
    .map((id) => `Carrera ${id}`)
    .join(', ');
  const facultyLabels = academicContext?.facultyIds
    .map((id) => `Facultad ${id}`)
    .join(', ');

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <header className="flex flex-col gap-4 pb-1 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Resumen de carrera
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Intentos de cursado y calificaciones agregados. El BFF limita cada
            consulta al contexto académico asignado a tu sesión.
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
        <section
          aria-label="Filtro de periodo académico"
          className="flex flex-wrap items-center gap-3"
        >
          <div className="space-y-1">
            <label
              htmlFor="director-academic-year"
              className="text-sm font-medium text-foreground"
            >
              Gestión académica
            </label>
          </div>
          <select
            id="director-academic-year"
            className="min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-xs"
            value={selectedYear}
            onChange={(event) => {
              setSelectedYear(event.target.value);
              setTablePage(0);
            }}
            disabled={initialLoading || periodMembers.length === 0}
          >
            <option value="">Todas las gestiones</option>
            {periodMembers.map((member) => (
              <option value={member.caption} key={member.uniqueName}>
                {member.caption}
              </option>
            ))}
          </select>
        </section>
      </header>

      {academicContext && !initialLoading && (
        <section
          aria-label="Contexto académico autorizado"
          className="rounded-xl border border-border bg-card p-4"
        >
          <h2 className="text-sm font-semibold text-foreground">
            Contexto asignado por Auth Service
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {careerLabels} · {facultyLabels}. La consulta se restringe en el
            servidor y estos identificadores no se envían como filtros.
          </p>
        </section>
      )}

      {initialLoading && (
        <p role="status" className="text-sm text-muted-foreground">
          Validando el contexto y consultando el cubo OLAP…
        </p>
      )}
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
        aria-label="Indicadores de carrera"
        aria-busy={initialLoading || queryLoading}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          icon={<UsersRound aria-hidden="true" className="size-6" />}
          label={
            selectedMember
              ? `Intentos de cursado · gestión ${selectedMember.caption}`
              : 'Intentos de cursado · histórico'
          }
          value={formatInteger(analytics.enrollmentAttempts)}
          unit={paths?.enrollmentUnit ?? 'intentos de cursado'}
          loading={initialLoading || queryLoading}
        />
        <MetricCard
          icon={<GraduationCap aria-hidden="true" className="size-6" />}
          label={
            selectedMember
              ? `Nota final promedio · gestión ${selectedMember.caption}`
              : 'Nota final promedio · histórico'
          }
          value={formatGrade(analytics.averageGrade)}
          unit={paths?.gradeUnit ?? 'escala institucional'}
          loading={initialLoading || queryLoading}
        />
        <MetricCard
          icon={<BookOpenCheck aria-hidden="true" className="size-6" />}
          label="Intentos con calificación"
          value={formatInteger(analytics.gradedAttempts)}
          unit="cursados con nota final registrada"
          loading={initialLoading || queryLoading}
        />
        <MetricCard
          icon={<CalendarDays aria-hidden="true" className="size-6" />}
          label="Periodos con actividad"
          value={formatInteger(
            initialLoading || queryLoading
              ? null
              : analytics.attemptsByPeriod.length,
          )}
          unit="periodos consultados"
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
        aria-label="Evolución académica de la carrera"
        className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
      >
        <Card className={`min-w-0 ${CARD_CLASS}`}>
          <CardHeader className="px-6 pt-2">
            <CardTitle>Intentos por periodo</CardTitle>
            <CardDescription>
              Suma de conteos de intento en los registros de cursado, agrupada
              por gestión y periodo académico.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-80 px-6 pb-4">
            <AcademicBarChart
              data={analytics.attemptsByPeriod}
              title="Intentos de cursado por periodo"
              ariaLabel={`Intentos de cursado por periodo académico en el contexto asignado. ${analytics.attemptsByPeriod.length} periodos.`}
              loading={initialLoading || queryLoading}
              emptyMessage="No hay intentos de cursado para esta gestión."
              height={320}
            />
          </CardContent>
        </Card>
        <Card className={`min-w-0 ${CARD_CLASS}`}>
          <CardHeader>
            <CardTitle>Nota final promedio por periodo</CardTitle>
            <CardDescription>
              Promedio de nota final de los registros con calificación, sin
              sumar calificaciones entre periodos.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-80">
            <TrendLineChart
              data={analytics.gradeByPeriod}
              title="Nota final promedio por periodo"
              ariaLabel={`Nota final promedio por periodo académico en el contexto asignado. ${analytics.gradeByPeriod.length} periodos.`}
              loading={initialLoading || queryLoading}
              emptyMessage="El cubo no devolvió calificaciones para esta gestión."
              height={320}
            />
          </CardContent>
        </Card>
      </section>

      <section
        aria-labelledby="overview-table-title"
        className="rounded-xl border border-border bg-card px-5 py-5 sm:px-6"
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="overview-table-title" className="text-lg font-semibold">
              Actividad por periodo
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Detalle de los intentos disponibles para la selección actual.
            </p>
          </div>
          <label className="grid gap-1 text-sm">
            <span className="sr-only">Buscar periodo académico</span>
            <input
              type="search"
              value={tableFilter}
              onChange={(event) => {
                setTableFilter(event.target.value);
                setTablePage(0);
              }}
              placeholder="Buscar periodo académico…"
              className="min-h-10 w-full rounded-md border border-input bg-background px-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-64"
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[24rem] text-left text-sm">
            <caption className="sr-only">
              Periodo académico e intentos de cursado
            </caption>
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Periodo académico
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Intentos de cursado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {analytics.attemptsByPeriod
                .filter((row) =>
                  row.label
                    .toLocaleLowerCase()
                    .includes(tableFilter.toLocaleLowerCase().trim()),
                )
                .slice(tablePage * 5, tablePage * 5 + 5)
                .map((row, index) => (
                  <tr key={`${tablePage * 5 + index}-${row.label}`}>
                    <td className="px-4 py-3">{row.label}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatInteger(row.value)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {analytics.attemptsByPeriod.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No hay datos disponibles para esta selección.
          </p>
        )}
        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Resultados:{' '}
            {
              analytics.attemptsByPeriod.filter((row) =>
                row.label
                  .toLocaleLowerCase()
                  .includes(tableFilter.toLocaleLowerCase().trim()),
              ).length
            }
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={tablePage === 0}
              onClick={() => setTablePage((page) => page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              disabled={
                (tablePage + 1) * 5 >=
                analytics.attemptsByPeriod.filter((row) =>
                  row.label
                    .toLocaleLowerCase()
                    .includes(tableFilter.toLocaleLowerCase().trim()),
                ).length
              }
              onClick={() => setTablePage((page) => page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
        El grano del cubo es un registro por intento de cursado. El filtro de
        carrera proviene de Auth Service y lo aplica el BFF; la interfaz solo
        envía el filtro de gestión.
      </footer>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  unit,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  loading: boolean;
}) {
  return (
    <Card className={CARD_CLASS}>
      <CardContent className="flex items-center gap-4 px-6 py-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <div
              className="mt-3 h-9 w-28 animate-pulse rounded bg-muted"
              aria-label="Cargando indicador"
            />
          ) : (
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {value}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{unit}</p>
        </div>
      </CardContent>
    </Card>
  );
}
