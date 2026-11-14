'use client';

import Link from 'next/link';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@dss-monorepo/design-system';
import { TrendLineChart } from '@dss-monorepo/charts';
import { AcademicSparkline } from '@dss-monorepo/academic-analytics';
import { useEffect, useState } from 'react';
import {
  BookOpenCheck,
  CalendarDays,
  GraduationCap,
  UsersRound,
} from 'lucide-react';
import {
  readDimensionSeries,
  readMetric,
  readPublishedMembers,
  resolveAdmissionPaths,
  resolveRetentionPaths,
  sortAcademicPeriods,
  type ChartPoint,
  type PublishedMember,
} from './analytics-data';

interface CubeSummary {
  cubeId: string;
  cubeName: string;
  cubeCaption?: string | null;
}

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

type AdmissionPaths = NonNullable<ReturnType<typeof resolveAdmissionPaths>>;
type RetentionPaths = NonNullable<ReturnType<typeof resolveRetentionPaths>>;
type FacultyRow = {
  label: string;
  applications: number;
  admitted: number | null;
  admittedApplications: number | null;
  known: number | null;
};
type QueryResponse = { analyticQuery: { data: unknown[]; totalRows: number } };

function yearFilter(
  axis: AdmissionPaths['year'],
  member: PublishedMember | undefined,
) {
  return member ? [{ ...axis, op: 'IN', members: [member.uniqueName] }] : [];
}

const count = (value: number | null) =>
  value === null
    ? '—'
    : new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(
        value,
      );
const percent = (numerator: number | null, denominator: number | null) =>
  numerator === null || denominator === null || denominator <= 0
    ? '—'
    : new Intl.NumberFormat('es-BO', { maximumFractionDigits: 1 }).format(
        (numerator / denominator) * 100,
      ) + ' %';

export function RectorAnalyticsDashboard() {
  const [admission, setAdmission] = useState<{
    id: string;
    paths: AdmissionPaths;
    members: PublishedMember[];
  } | null>(null);
  const [retention, setRetention] = useState<{
    id: string;
    paths: RetentionPaths;
    members: PublishedMember[];
  } | null>(null);
  const [selectedYear, setSelectedYear] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [queryLoading, setQueryLoading] = useState(false);
  const [error, setError] = useState('');
  const [retentionError, setRetentionError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<{
    applications: number | null;
    admitted: number | null;
    admittedApplications: number | null;
    known: number | null;
    retained: number | null;
    evaluable: number | null;
    faculty: FacultyRow[];
    trend: ChartPoint[];
  }>({
    applications: null,
    admitted: null,
    admittedApplications: null,
    known: null,
    retained: null,
    evaluable: null,
    faculty: [],
    trend: [],
  });

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      setAdmission(null);
      setRetention(null);
      setRetentionError(false);
      try {
        const { olapCubes } = await graphql<{ olapCubes: CubeSummary[] }>(
          CUBES_QUERY,
        );
        const findCube = (name: string) =>
          olapCubes.find((cube) => cube.cubeName.toLowerCase() === name);
        const admissionCube = findCube('admisión');
        if (!admissionCube)
          throw new Error('El cubo de admisión no está disponible.');
        const admissionSchema = await graphql<{ olapCubeSchema: unknown }>(
          SCHEMA_QUERY,
          { cubeId: admissionCube.cubeId },
        );
        const paths = resolveAdmissionPaths(admissionSchema.olapCubeSchema);
        if (!paths)
          throw new Error(
            'El cubo de admisión no contiene las medidas y dimensiones necesarias.',
          );
        const result = await graphql<{ olapCubeMembers: unknown }>(
          MEMBERS_QUERY,
          { cubeId: admissionCube.cubeId, ...paths.year, limit: 100 },
        );
        const members = readPublishedMembers(result.olapCubeMembers).sort(
          (a, b) =>
            (a.caption ?? a.name).localeCompare(
              b.caption ?? b.name,
              undefined,
              { numeric: true },
            ),
        );
        if (!active) return;
        const requested = new URL(window.location.href).searchParams.get(
          'gestion',
        );
        const selected =
          requested === 'todas'
            ? ''
            : (members.find((m) => (m.caption ?? m.name) === requested)
                ?.caption ??
              members.at(-1)?.caption ??
              members.at(-1)?.name ??
              '');
        setSelectedYear(selected);
        setAdmission({ id: admissionCube.cubeId, paths, members });
        const retentionCube = findCube('permanencia y deserción');
        if (!retentionCube) {
          setRetentionError(true);
          return;
        }
        try {
          const schema = await graphql<{ olapCubeSchema: unknown }>(
            SCHEMA_QUERY,
            { cubeId: retentionCube.cubeId },
          );
          const retentionPaths = resolveRetentionPaths(schema.olapCubeSchema);
          if (!retentionPaths)
            throw new Error('Esquema de permanencia incompleto');
          const retentionMembers = await graphql<{ olapCubeMembers: unknown }>(
            MEMBERS_QUERY,
            {
              cubeId: retentionCube.cubeId,
              ...retentionPaths.year,
              limit: 100,
            },
          );
          if (active)
            setRetention({
              id: retentionCube.cubeId,
              paths: retentionPaths,
              members: readPublishedMembers(retentionMembers.olapCubeMembers),
            });
        } catch {
          if (active) setRetentionError(true);
        }
      } catch (reason) {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'No se pudo cargar la analítica institucional.',
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!admission || loading) return;
    let active = true;
    async function load() {
      if (!admission) return;
      setQueryLoading(true);
      setError('');
      try {
        const { paths, id, members } = admission;
        const member = members.find(
          (m) => (m.caption ?? m.name) === selectedYear,
        );
        const filters = yearFilter(paths.year, member);
        const query = (input: Record<string, unknown>) =>
          graphql<QueryResponse>(ANALYTIC_QUERY, { input });
        const measures = [
          paths.applications,
          paths.admitted,
          paths.admittedApplications,
          paths.knownApplications,
        ]
          .filter((name): name is string => name !== null)
          .map((name) => ({ name }));
        const [overall, facultyResult, trendResult] = await Promise.all([
          query({ cubeId: id, filters, measures, limit: 100 }),
          query({
            cubeId: id,
            filters,
            measures,
            rows: [paths.faculty],
            order: [{ by: paths.applications, direction: 'DESC' }],
            limit: 100,
          }),
          query({
            cubeId: id,
            measures: [{ name: paths.applicants }],
            rows: [paths.year],
            limit: 100,
          }),
        ]);
        let retained: number | null = null;
        let evaluable: number | null = null;
        let failedRetention = !retention;
        if (retention) {
          const retentionMember = retention.members.find(
            (m) => (m.caption ?? m.name) === selectedYear,
          );
          if (!selectedYear || retentionMember) {
            try {
              const result = await query({
                cubeId: retention.id,
                filters: yearFilter(retention.paths.year, retentionMember),
                measures: [
                  { name: retention.paths.retained },
                  { name: retention.paths.evaluable },
                ],
                limit: 100,
              });
              retained = readMetric(
                result.analyticQuery.data,
                retention.paths.retained,
              );
              evaluable = readMetric(
                result.analyticQuery.data,
                retention.paths.evaluable,
              );
            } catch {
              failedRetention = true;
            }
          }
        }
        if (!active) return;
        const faculty = (facultyResult.analyticQuery.data ?? [])
          .flatMap((row) => {
            const point = readDimensionSeries(
              [row],
              paths.faculty.level,
              paths.applications,
            )[0];
            return point
              ? [
                  {
                    label: point.label,
                    applications: point.value,
                    admitted: readMetric([row], paths.admitted),
                    admittedApplications: paths.admittedApplications
                      ? readMetric([row], paths.admittedApplications)
                      : null,
                    known: paths.knownApplications
                      ? readMetric([row], paths.knownApplications)
                      : null,
                  },
                ]
              : [];
          })
          .sort((a, b) => b.applications - a.applications);
        setData({
          applications: readMetric(
            overall.analyticQuery.data,
            paths.applications,
          ),
          admitted: readMetric(overall.analyticQuery.data, paths.admitted),
          admittedApplications: paths.admittedApplications
            ? readMetric(overall.analyticQuery.data, paths.admittedApplications)
            : null,
          known: paths.knownApplications
            ? readMetric(overall.analyticQuery.data, paths.knownApplications)
            : null,
          retained,
          evaluable,
          faculty,
          trend: sortAcademicPeriods(
            readDimensionSeries(
              trendResult.analyticQuery.data,
              paths.year.level,
              paths.applicants,
            ),
          ),
        });
        setRetentionError(failedRetention);
        const url = new URL(window.location.href);
        url.searchParams.set('gestion', selectedYear || 'todas');
        window.history.replaceState({}, '', url);
      } catch (reason) {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'No se pudieron cargar los indicadores.',
          );
          setData({
            applications: null,
            admitted: null,
            admittedApplications: null,
            known: null,
            retained: null,
            evaluable: null,
            faculty: [],
            trend: [],
          });
        }
      } finally {
        if (active) setQueryLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [admission, retention, selectedYear, loading]);

  const busy = loading || queryLoading;
  const filtered = (busy ? [] : data.faculty).filter((row) =>
    row.label.toLocaleLowerCase().includes(filter.toLocaleLowerCase().trim()),
  );
  const currentLabel = selectedYear
    ? 'Gestión ' + selectedYear
    : 'Todas las gestiones';
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <header className="flex flex-col gap-4 pb-1 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Resumen institucional
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Demanda de ingreso, admisión y permanencia en el ámbito
            institucional autorizado para Rectoría.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setRefresh((value) => value + 1)}
          disabled={busy}
        >
          {busy ? 'Actualizando…' : 'Actualizar datos'}
        </Button>
        <Link
          className="text-sm font-medium text-primary underline underline-offset-4"
          href="/predictions"
        >
          Consultar predicciones de abandono
        </Link>
        <label className="grid gap-1 text-sm">
          Gestión académica
          <select
            className="min-h-10 rounded-md border border-input bg-background px-3"
            value={selectedYear}
            disabled={loading || !admission?.members.length}
            onChange={(event) => {
              setSelectedYear(event.target.value);
              setPage(0);
            }}
          >
            <option value="">Todas las gestiones</option>
            {admission?.members.map((member) => (
              <option
                key={member.uniqueName}
                value={member.caption ?? member.name}
              >
                {member.caption ?? member.name}
              </option>
            ))}
          </select>
        </label>
      </header>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 p-4 text-sm"
        >
          {error}{' '}
          <Button
            variant="outline"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Reintentar
          </Button>
        </div>
      )}
      {retentionError && !loading && (
        <p role="status" className="text-sm text-muted-foreground">
          No se pudo consultar la permanencia. Los indicadores de admisión
          permanecen disponibles.
        </p>
      )}
      {admission &&
        (!admission.paths.admittedApplications ||
          !admission.paths.knownApplications) && (
          <p role="status" className="text-sm text-muted-foreground">
            La tasa de admisión no está disponible: el catálogo OLAP debe
            actualizarse con las medidas de postulaciones admitidas y resultados
            conocidos.
          </p>
        )}
      <section
        aria-label="Indicadores institucionales"
        aria-busy={busy}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          icon={<UsersRound aria-hidden="true" />}
          label="Postulaciones"
          formattedValue={count(data.applications)}
          unit="registros de postulación"
          loading={busy}
        />
        <MetricCard
          icon={<GraduationCap aria-hidden="true" />}
          label="Personas admitidas"
          formattedValue={count(data.admitted)}
          unit="personas identificadas"
          loading={busy}
        />
        <MetricCard
          icon={<BookOpenCheck aria-hidden="true" />}
          label="Tasa de admisión"
          formattedValue={percent(data.admittedApplications, data.known)}
          unit="postulaciones admitidas entre postulaciones con resultado conocido"
          loading={busy}
        />
        <MetricCard
          icon={<CalendarDays aria-hidden="true" />}
          label="Permanencia observada"
          formattedValue={percent(data.retained, data.evaluable)}
          unit="registros retenidos entre resultados evaluables"
          loading={busy}
        />
      </section>
      <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
        <span>
          Corte visible:{' '}
          <strong className="text-foreground">{currentLabel}</strong>
        </span>
        <span>Fuente: cubos de admisión y permanencia</span>
      </div>
      <section
        aria-label="Visualizaciones institucionales"
        className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(21rem,1fr)]"
      >
        <Card className={CARD_CLASS}>
          <CardHeader>
            <CardTitle>Postulaciones por facultad</CardTitle>
            <CardDescription>
              Registros de postulación en la selección actual. Una persona puede
              presentar más de una postulación.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {busy ? (
              <ChartSkeleton />
            ) : data.faculty.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No hay postulaciones para esta selección.
              </p>
            ) : (
              <ol
                className="space-y-4"
                aria-label="Facultades ordenadas por postulaciones"
              >
                {data.faculty.slice(0, 7).map((row) => (
                  <li key={row.label}>
                    <div className="flex justify-between gap-3 text-sm">
                      <span>{row.label}</span>
                      <strong>{count(row.applications)}</strong>
                    </div>
                    <div
                      className="mt-2 h-2 rounded-full bg-muted"
                      role="img"
                      aria-label={
                        row.label +
                        ': ' +
                        count(row.applications) +
                        ' postulaciones'
                      }
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width:
                            (data.faculty[0].applications > 0
                              ? (row.applications /
                                  data.faculty[0].applications) *
                                100
                              : 0) + '%',
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
        <Card className={CARD_CLASS}>
          <CardHeader>
            <CardTitle>Postulaciones por gestión</CardTitle>
            <CardDescription>
              Personas identificadas que postularon en cada gestión; la
              tendencia muestra todo el histórico disponible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {busy ? (
              <ChartSkeleton />
            ) : (
              <TrendLineChart
                data={data.trend}
                title="Evolución de postulaciones"
                ariaLabel="Postulaciones registradas por gestión"
                emptyMessage="No hay postulaciones disponibles para graficar."
                height={320}
              />
            )}
          </CardContent>
        </Card>
      </section>
      <section className="rounded-xl border border-border bg-card px-5 py-5">
        <h2 className="text-lg font-semibold">
          Resumen de admisión por facultad
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Postulaciones, personas admitidas y tasa calculada sobre postulaciones
          con resultado conocido.
        </p>
        <label className="mt-4 block text-sm">
          <span className="sr-only">Buscar facultad</span>
          <input
            type="search"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setPage(0);
            }}
            placeholder="Buscar facultad…"
            className="min-h-10 rounded-md border border-input bg-background px-3"
          />
        </label>
        <div className="overflow-x-auto">
          <table className="mt-4 w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr>
                <th className="p-3">Facultad</th>
                <th className="p-3 text-right">Postulaciones</th>
                <th className="p-3 text-right">Personas admitidas</th>
                <th className="p-3 text-right">Tasa de admisión</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(page * 5, page * 5 + 5).map((row) => (
                <tr key={row.label} className="border-t border-border">
                  <td className="p-3">{row.label}</td>
                  <td className="p-3 text-right">{count(row.applications)}</td>
                  <td className="p-3 text-right">{count(row.admitted)}</td>
                  <td className="p-3 text-right">
                    {percent(row.admittedApplications, row.known)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!busy && filtered.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">
            No hay resultados para mostrar.
          </p>
        )}
        <div className="mt-4 flex items-center justify-between text-sm">
          <span>Resultados: {filtered.length}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((value) => value - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              disabled={(page + 1) * 5 >= filtered.length}
              onClick={() => setPage((value) => value + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </section>
      <footer className="text-sm text-muted-foreground">
        Los conteos de personas son distintos dentro de cada ámbito; no deben
        sumarse entre facultades o gestiones. La permanencia se calcula sobre
        registros evaluables de periodos cerrados.
      </footer>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  formattedValue,
  unit,
  series = [],
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  formattedValue: string;
  unit: string;
  series?: ChartPoint[];
  loading: boolean;
}) {
  return (
    <Card className={CARD_CLASS}>
      <CardContent className="grid min-h-40 grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 px-5 py-5 sm:px-6">
        <div className="min-w-0">
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
        </div>
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        {series.length > 0 && !loading ? (
          <div className="col-span-2 flex items-center justify-between gap-4 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">
              Tendencia · {series.length} periodos
            </span>
            <AcademicSparkline
              label={label}
              data={series}
              className="h-8 w-28 shrink-0 text-[color:var(--role-accent,var(--primary))]"
            />
          </div>
        ) : null}
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
