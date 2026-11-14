'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Loader,
} from '@dss-monorepo/design-system';
import { TrendLineChart } from '@dss-monorepo/charts';
import {
  readDimensionSeries,
  readMetric,
  readPublishedMembers,
  resolveAcademicCubePaths,
  sortAcademicPeriods,
  type CubeAxisPath,
  type PublishedMember,
} from './analytics-data';

type Cube = { cubeId: string; cubeName: string };
type Result = { analyticQuery: { data: unknown[]; totalRows: number } };
type Metric =
  | 'Inscripciones en materias'
  | 'Inscripciones con resultado'
  | 'Materias aprobadas'
  | 'Materias reprobadas'
  | 'Nota promedio';
const metrics: Metric[] = [
  'Inscripciones en materias',
  'Inscripciones con resultado',
  'Materias aprobadas',
  'Materias reprobadas',
  'Nota promedio',
];
const careerAxis: CubeAxisPath = {
  dimension: 'Programa',
  hierarchy: 'Facultad y carrera',
  level: 'Carrera',
};
const facultyFilterAxis: CubeAxisPath = {
  dimension: 'Ámbito de facultad',
  hierarchy: 'Facultad',
  level: 'Facultad',
};
const CUBES = `query PerformanceCubes { olapCubes { cubeId cubeName } }`;
const SCHEMA = `query PerformanceSchema($cubeId: ID!) { olapCubeSchema(cubeId: $cubeId) }`;
const MEMBERS = `query PerformanceMembers($cubeId: ID!, $dimension: String!, $hierarchy: String!, $level: String!, $limit: Int) { olapCubeMembers(cubeId: $cubeId, dimension: $dimension, hierarchy: $hierarchy, level: $level, limit: $limit) { name caption uniqueName } }`;
const QUERY = `query PerformanceAnalysis($input: AnalyticQueryInput!) { analyticQuery(input: $input) { data totalRows } }`;

async function request<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_BFF_URL?.replace(/\/$/, '');
  if (!base) throw new Error('No se ha configurado la conexión del portal.');
  let response: Response;
  try {
    response = await fetch(`${base}/api/graphql`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error('No se pudo conectar con el servicio de analítica.');
  }
  const result = (await response.json().catch(() => null)) as {
    data?: T;
    errors?: { message?: string; extensions?: { code?: string } }[];
  } | null;
  if (
    response.status === 401 ||
    result?.errors?.[0]?.extensions?.code === 'UNAUTHENTICATED'
  )
    throw new Error('La sesión expiró. Inicia sesión nuevamente.');
  if (!response.ok || result?.errors?.length || !result?.data)
    throw new Error(
      result?.errors?.[0]?.message ??
        'No se pudo consultar el cubo de rendimiento.',
    );
  return result.data;
}
const number = (value: number | null, decimals = 0) =>
  value === null
    ? '—'
    : new Intl.NumberFormat('es-BO', {
        maximumFractionDigits: decimals,
      }).format(value);
const pct = (passed: number | null, failed: number | null) =>
  passed === null || failed === null || passed + failed <= 0
    ? null
    : (failed * 100) / (passed + failed);
const caption = (member: PublishedMember) => {
  const value = member.caption ?? member.name;
  return value === '#null' ? 'Sin dato' : value;
};
type Detail = {
  label: string;
  attempts: number | null;
  graded: number | null;
  average: number | null;
  passed: number | null;
  failed: number | null;
};
const readValues = (row: unknown): Omit<Detail, 'label'> => ({
  attempts: readMetric([row], metrics[0]),
  graded: readMetric([row], metrics[1]),
  passed: readMetric([row], metrics[2]),
  failed: readMetric([row], metrics[3]),
  average: readMetric([row], metrics[4]),
});
const emptyValues: Omit<Detail, 'label'> = {
  attempts: null,
  graded: null,
  passed: null,
  failed: null,
  average: null,
};

export function RectorPerformanceReport() {
  const [setup, setSetup] = useState<{
    cube: string;
    year: CubeAxisPath;
    faculty: CubeAxisPath;
    years: PublishedMember[];
    faculties: PublishedMember[];
  } | null>(null);
  const [year, setYear] = useState('');
  const [faculty, setFaculty] = useState('');
  const [breakdown, setBreakdown] = useState<'faculty' | 'career'>('faculty');
  const [sort, setSort] = useState<'attempts' | 'average' | 'name'>('attempts');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(emptyValues);
  const [rows, setRows] = useState<Detail[]>([]);
  const [trend, setTrend] = useState<{ label: string; value: number }[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState(false);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      setSetup(null);
      try {
        const cubes = await request<{ olapCubes: Cube[] }>(CUBES);
        const cube = cubes.olapCubes.find(
          (item) => item.cubeName.toLowerCase() === 'rendimiento académico',
        );
        if (!cube)
          throw new Error(
            'El cubo de rendimiento académico no está disponible.',
          );
        const response = await request<{ olapCubeSchema: unknown }>(SCHEMA, {
          cubeId: cube.cubeId,
        });
        const paths = resolveAcademicCubePaths(response.olapCubeSchema);
        if (!paths)
          throw new Error(
            'El cubo no contiene las dimensiones necesarias para el reporte.',
          );
        const loadMembers = (axis: CubeAxisPath) =>
          request<{ olapCubeMembers: unknown }>(MEMBERS, {
            cubeId: cube.cubeId,
            ...axis,
            limit: 500,
          });
        const [years, faculties] = await Promise.all([
          loadMembers(paths.academicYear),
          loadMembers(facultyFilterAxis),
        ]);
        if (!active) return;
        const yearMembers = readPublishedMembers(years.olapCubeMembers).sort(
          (a, b) =>
            caption(a).localeCompare(caption(b), undefined, { numeric: true }),
        );
        setSetup({
          cube: cube.cubeId,
          year: paths.academicYear,
          faculty: paths.faculty,
          years: yearMembers,
          faculties: readPublishedMembers(faculties.olapCubeMembers).sort(
            (a, b) => caption(a).localeCompare(caption(b)),
          ),
        });
        setYear((current) =>
          yearMembers.some((m) => m.uniqueName === current)
            ? current
            : (yearMembers.at(-1)?.uniqueName ?? ''),
        );
        setFaculty('');
      } catch (reason) {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'No se pudo cargar el cubo.',
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [reload]);

  useEffect(() => {
    if (!setup || loading) return;
    let active = true;
    async function load() {
      if (!setup) return;
      setQuerying(true);
      setError('');
      const selectedFilters = [
        year && { ...setup.year, op: 'IN', members: [year] },
        faculty && { ...facultyFilterAxis, op: 'IN', members: [faculty] },
      ].filter(Boolean);
      const measures = metrics.map((name) => ({ name }));
      const axis = breakdown === 'faculty' ? setup.faculty : careerAxis;
      const query = (input: Record<string, unknown>) =>
        request<Result>(QUERY, {
          input: { cubeId: setup.cube, limit: 500, ...input },
        });
      try {
        const [total, details] = await Promise.all([
          query({ measures, filters: selectedFilters }),
          query({ measures, rows: [axis], filters: selectedFilters }),
        ]);
        if (!active) return;
        setSummary(readValues(total.analyticQuery.data?.[0]));
        setRows(
          (details.analyticQuery.data ?? []).flatMap((row) => {
            const item = readDimensionSeries(
              [row],
              axis.level,
              'Inscripciones en materias',
            )[0];
            return item ? [{ label: item.label, ...readValues(row) }] : [];
          }),
        );
        setTruncated(details.analyticQuery.totalRows >= 500);
      } catch (reason) {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'No se pudo cargar el reporte.',
          );
          setSummary(emptyValues);
          setRows([]);
        }
      } finally {
        if (active) setQuerying(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [setup, year, faculty, breakdown, loading]);

  useEffect(() => {
    if (!setup || loading) return;
    let active = true;
    setTrendLoading(true);
    setTrendError(false);
    setTrend([]);
    const filters = faculty
      ? [{ ...facultyFilterAxis, op: 'IN', members: [faculty] }]
      : [];
    void request<Result>(QUERY, {
      input: {
        cubeId: setup.cube,
        limit: 500,
        measures: [{ name: 'Nota promedio' }],
        rows: [setup.year],
        filters,
      },
    })
      .then((result) => {
        if (active)
          setTrend(
            sortAcademicPeriods(
              readDimensionSeries(
                result.analyticQuery.data,
                setup.year.level,
                'Nota promedio',
              ),
            ),
          );
      })
      .catch(() => {
        if (active) setTrendError(true);
      })
      .finally(() => {
        if (active) setTrendLoading(false);
      });
    return () => {
      active = false;
    };
  }, [setup, faculty, loading]);

  const busy = loading || querying;
  const filtered = useMemo(
    () =>
      rows
        .filter((row) =>
          row.label
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase().trim()),
        )
        .sort((a, b) =>
          sort === 'name'
            ? a.label.localeCompare(b.label)
            : (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity) ||
              a.label.localeCompare(b.label),
        ),
    [rows, search, sort],
  );
  const rate = pct(summary.passed, summary.failed);
  const exportRows = () => {
    const safe = (value: string | number | null) => {
      const text = value === null ? '' : String(value);
      return (
        '"' +
        (/^[\s]*[=+@\-\t\r]/.test(text) ? "'" + text : text).replace(
          /"/g,
          '""',
        ) +
        '"'
      );
    };
    const csv = [
      [
        'Ámbito',
        'Cursados',
        'Con nota',
        'Nota final promedio',
        'Aprobados',
        'Reprobados',
        'Tasa de reprobación (%)',
      ],
      ...filtered.map((row) => [
        row.label,
        row.attempts,
        row.graded,
        row.average,
        pct(row.passed, row.failed) === null ? null : row.passed,
        pct(row.passed, row.failed) === null ? null : row.failed,
        pct(row.passed, row.failed),
      ]),
    ]
      .map((row) => row.map(safe).join(';'))
      .join('\r\n');
    const url = URL.createObjectURL(
      new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rendimiento-academico.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-6">
      <section
        aria-label="Filtros de rendimiento"
        className="rounded-xl border border-border bg-card p-5 space-y-4"
      >
        <div className="flex flex-wrap items-end gap-4">
          <label className="grid gap-1 text-sm font-medium">
            Gestión académica
            <select
              value={year}
              disabled={loading}
              onChange={(e) => {
                setYear(e.target.value);
                setPage(0);
              }}
              className="min-h-10 min-w-40 rounded-md border border-input bg-background px-3"
            >
              <option value="">Todas las gestiones</option>
              {setup?.years.map((m) => (
                <option key={m.uniqueName} value={m.uniqueName}>
                  {caption(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Facultad
            <select
              value={faculty}
              disabled={loading}
              onChange={(e) => {
                setFaculty(e.target.value);
                setPage(0);
              }}
              className="min-h-10 max-w-80 rounded-md border border-input bg-background px-3"
            >
              <option value="">Todas las facultades</option>
              {setup?.faculties.map((m) => (
                <option key={m.uniqueName} value={m.uniqueName}>
                  {caption(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Comparar por
            <select
              value={breakdown}
              onChange={(e) => {
                setBreakdown(e.target.value as 'faculty' | 'career');
                setPage(0);
              }}
              className="min-h-10 rounded-md border border-input bg-background px-3"
            >
              <option value="faculty">Facultad</option>
              <option value="career">Carrera</option>
            </select>
          </label>
          <Button
            variant="outline"
            onClick={() => setReload((v) => v + 1)}
            disabled={busy}
          >
            Actualizar datos
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setYear('');
              setFaculty('');
              setSearch('');
              setPage(0);
            }}
            disabled={busy}
          >
            Limpiar filtros
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Los indicadores y la tabla corresponden a los filtros seleccionados.
          La evolución muestra todas las gestiones para la facultad elegida.
        </p>
      </section>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 p-4 text-sm"
        >
          {error}{' '}
          <Button variant="outline" onClick={() => setReload((v) => v + 1)}>
            Reintentar
          </Button>
        </div>
      )}
      {busy ? (
        <Loader text="Cargando rendimiento académico…" fullScreen={false} />
      ) : (
        <>
          <section
            aria-label="Indicadores de rendimiento"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {[
              [
                'Cursados registrados',
                number(summary.attempts),
                'Registros de cursado, no estudiantes únicos',
              ],
              [
                'Cursados con nota',
                number(summary.graded),
                'Registros con nota final disponible',
              ],
              [
                'Nota final promedio',
                number(summary.average, 2),
                'Promedio calculado por el cubo',
              ],
              [
                'Tasa de reprobación',
                rate === null ? '—' : number(rate, 1) + ' %',
                'Reprobados entre resultados clasificados',
              ],
            ].map(([title, value, description]) => (
              <Card key={title}>
                <CardContent className="space-y-2 p-5">
                  <p className="text-sm font-medium text-muted-foreground">
                    {title}
                  </p>
                  <p className="text-3xl font-semibold tabular-nums">{value}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            ))}
          </section>
          {rate === null && summary.graded !== null && (
            <p
              role="status"
              className="rounded-lg border border-border bg-muted/30 p-4 text-sm"
            >
              No hay resultados de aprobación o reprobación clasificados para
              calcular la tasa en esta selección.
            </p>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Evolución de la nota final promedio</CardTitle>
              <CardDescription>
                Comparación por gestión para la facultad seleccionada. Cada
                punto es el promedio calculado para esa gestión.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trendLoading ? (
                <Loader text="Cargando evolución…" fullScreen={false} />
              ) : trendError ? (
                <p role="status" className="text-sm text-muted-foreground">
                  No se pudo cargar la evolución por gestión. Puedes actualizar
                  los datos para volver a intentarlo.
                </p>
              ) : (
                <TrendLineChart
                  data={trend}
                  title="Nota final promedio por gestión"
                  ariaLabel="Evolución de la nota final promedio por gestión"
                  height={280}
                  emptyMessage="No hay notas disponibles para graficar."
                />
              )}
            </CardContent>
          </Card>
          <section className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  Rendimiento por{' '}
                  {breakdown === 'faculty' ? 'facultad' : 'carrera'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Compara los resultados del periodo y ámbito seleccionados.
                </p>
              </div>
              <Button
                variant="outline"
                disabled={!filtered.length}
                onClick={exportRows}
              >
                Descargar CSV
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <label className="grid gap-1 text-sm">
                Buscar
                <input
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Buscar en los resultados"
                  className="min-h-10 rounded-md border border-input bg-background px-3"
                />
              </label>
              <label className="grid gap-1 text-sm">
                Ordenar por
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value as typeof sort);
                    setPage(0);
                  }}
                  className="min-h-10 rounded-md border border-input bg-background px-3"
                >
                  <option value="attempts">Mayor cantidad de cursados</option>
                  <option value="average">Mayor nota promedio</option>
                  <option value="name">Nombre</option>
                </select>
              </label>
            </div>
            {truncated && (
              <p role="status" className="text-sm text-muted-foreground">
                La consulta alcanzó el límite de 500 resultados; selecciona una
                facultad para acotar el análisis.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[50rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-3">
                      {breakdown === 'faculty' ? 'Facultad' : 'Carrera'}
                    </th>
                    <th className="p-3 text-right">Cursados</th>
                    <th className="p-3 text-right">Con nota</th>
                    <th className="p-3 text-right">Promedio final</th>
                    <th className="p-3 text-right">Aprobados</th>
                    <th className="p-3 text-right">Reprobados</th>
                    <th className="p-3 text-right">Tasa de reprobación</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered
                    .slice(page * 10, page * 10 + 10)
                    .map((row, index) => {
                      const value = pct(row.passed, row.failed);
                      return (
                        <tr
                          className="border-b border-border"
                          key={row.label + index}
                        >
                          <td className="p-3">{row.label}</td>
                          <td className="p-3 text-right">
                            {number(row.attempts)}
                          </td>
                          <td className="p-3 text-right">
                            {number(row.graded)}
                          </td>
                          <td className="p-3 text-right">
                            {number(row.average, 2)}
                          </td>
                          <td className="p-3 text-right">
                            {value === null ? '—' : number(row.passed)}
                          </td>
                          <td className="p-3 text-right">
                            {value === null ? '—' : number(row.failed)}
                          </td>
                          <td className="p-3 text-right">
                            {value === null ? '—' : number(value, 1) + ' %'}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {!filtered.length && (
              <p className="text-sm text-muted-foreground">
                No hay resultados para esta selección.
              </p>
            )}
            <div className="flex items-center justify-between gap-2 text-sm">
              <span>
                {filtered.length} resultados · página{' '}
                {filtered.length ? page + 1 : 0} de{' '}
                {Math.ceil(filtered.length / 10)}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage((v) => v - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  disabled={(page + 1) * 10 >= filtered.length}
                  onClick={() => setPage((v) => v + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </section>
        </>
      )}
      <p className="text-sm text-muted-foreground">
        La tasa usa únicamente resultados clasificados como aprobados o
        reprobados. Los cursados no representan estudiantes únicos.
      </p>
    </div>
  );
}
