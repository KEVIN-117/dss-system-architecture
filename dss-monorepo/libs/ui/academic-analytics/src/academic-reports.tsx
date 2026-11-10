'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AcademicBarChart, TrendLineChart } from '@dss-monorepo/charts';
import {
  Button,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Loader,
} from '@dss-monorepo/design-system';

type JsonRecord = Record<string, unknown>;
type Axis = { dimension: string; hierarchy: string; level: string };
type Cube = { cubeId: string; cubeName: string };

const CUBES_QUERY = `query DirectorAnalyticsCubes { olapCubes { cubeId cubeName } }`;
const VIEWER_QUERY = `query DirectorAnalyticsViewer { viewer { academicScope { kind facultyIds careerIds } } }`;
const SCHEMA_QUERY = `query DirectorAnalyticsSchema($cubeId: ID!) { olapCubeSchema(cubeId: $cubeId) }`;
const ANALYTIC_QUERY = `query DirectorAnalyticsReport($input: AnalyticQueryInput!) { analyticQuery(input: $input) { data } }`;
const TABLE_CLASS = 'w-full min-w-[34rem] border-collapse text-left text-sm';
const SECTION_CLASS =
  'min-w-0 overflow-hidden rounded-xl border border-border bg-card';

const BREAKDOWN_OPTIONS = [
  {
    id: 'gender',
    label: 'Género',
    dimension: 'Applicant Profile',
    hierarchy: 'By Gender',
    level: 'Gender',
  },
  {
    id: 'career',
    label: 'Carrera',
    dimension: 'Academic Program',
    hierarchy: 'Program',
    level: 'Career',
  },
  {
    id: 'faculty',
    label: 'Facultad',
    dimension: 'Academic Program',
    hierarchy: 'Program',
    level: 'Faculty',
  },
  {
    id: 'campus',
    label: 'Sede',
    dimension: 'Academic Campus',
    hierarchy: 'Academic Campus',
    level: 'Campus Code',
  },
  {
    id: 'schoolType',
    label: 'Tipo de colegio',
    dimension: 'Applicant Profile',
    hierarchy: 'By School Type',
    level: 'School Type',
  },
  {
    id: 'school',
    label: 'Colegio de origen',
    dimension: 'Applicant Profile',
    hierarchy: 'By School',
    level: 'School',
  },
  {
    id: 'admissionMode',
    label: 'Modalidad de ingreso',
    dimension: 'Admission Mode',
    hierarchy: 'Admission Mode',
    level: 'Admission Code',
  },
] as const;

const RETENTION_METRICS = [
  'Evaluable Retention Outcomes',
  'Retained Students',
  'Observed Dropouts',
] as const;
const PERFORMANCE_METRICS = [
  'Enrollment Attempts',
  'Graded Attempts',
  'Passed Attempts',
  'Failed Attempts',
  'Repeated Attempts',
  'Abandoned Attempts',
  'Average Final Grade',
] as const;

function record(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function namedItems(value: unknown): JsonRecord[] {
  return record(value) ? Object.values(value).filter(record) : [];
}

function findNamed(value: unknown, name: string): JsonRecord | undefined {
  return namedItems(value).find(
    (item) =>
      typeof item.name === 'string' && normalize(item.name) === normalize(name),
  );
}

function findAxis(
  schema: unknown,
  dimensionName: string,
  hierarchyName: string,
  levelName: string,
): Axis | null {
  if (!record(schema) || !record(schema.dimensions)) return null;
  const dimension = findNamed(schema.dimensions, dimensionName);
  const hierarchy =
    dimension && findNamed(dimension.hierarchies, hierarchyName);
  const level = hierarchy && findNamed(hierarchy.levels, levelName);
  if (
    typeof dimension?.name !== 'string' ||
    typeof hierarchy?.name !== 'string' ||
    typeof level?.name !== 'string'
  )
    return null;
  return {
    dimension: dimension.name,
    hierarchy: hierarchy.name,
    level: level.name,
  };
}

function findMeasure(schema: unknown, measureName: string): string | null {
  if (!record(schema)) return null;
  const measure = findNamed(schema.measures, measureName);
  return typeof measure?.name === 'string' ? measure.name : null;
}

function readCell(row: JsonRecord, target: string): unknown {
  const suffix = normalize(target);
  const entry = Object.entries(row).find(
    ([key]) => normalize(key) === suffix || normalize(key).endsWith(suffix),
  );
  const value = entry?.[1];
  return record(value) && 'value' in value ? value.value : value;
}

function asText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number')
    return String(value);
  if (record(value)) {
    for (const key of ['caption', 'name', 'value']) {
      if (typeof value[key] === 'string' || typeof value[key] === 'number')
        return String(value[key]);
    }
  }
  return 'Sin dato';
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function request<T>(query: string, variables?: JsonRecord): Promise<T> {
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
      'No se pudo conectar con el BFF. Verifica la conexión e inténtalo nuevamente.',
    );
  }
  const payload = (await response.json().catch(() => null)) as {
    data?: T;
    errors?: Array<{ message?: string; extensions?: { code?: string } }>;
  } | null;
  if (!response.ok || payload?.errors?.length) {
    const error = payload?.errors?.[0];
    const code = error?.extensions?.code;
    if (response.status === 401 || code === 'UNAUTHENTICATED')
      throw new Error('La sesión expiró. Inicia sesión nuevamente.');
    if (response.status === 403 || code === 'FORBIDDEN')
      throw new Error(
        'Tu rol no tiene permiso para consultar estos indicadores.',
      );
    if (code === 'ACADEMIC_CONTEXT_REQUIRED')
      throw new Error(
        'Auth Service no tiene un contexto académico asignado a esta cuenta.',
      );
    throw new Error(
      error?.message ?? 'No se pudieron consultar los cubos OLAP.',
    );
  }
  if (!payload?.data) throw new Error('El BFF devolvió una respuesta vacía.');
  return payload.data;
}

async function queryCube(
  cubeId: string,
  measures: string[],
  rows: Axis[],
): Promise<JsonRecord[]> {
  const result = await request<{ analyticQuery: { data: unknown } }>(
    ANALYTIC_QUERY,
    {
      input: {
        cubeId,
        measures: measures.map((name) => ({ name })),
        rows,
        limit: 500,
      },
    },
  );
  return Array.isArray(result.analyticQuery?.data)
    ? result.analyticQuery.data.filter(record)
    : [];
}

function formatCount(value: number | null): string {
  return value === null
    ? '—'
    : new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(
        value,
      );
}

export function AcademicReports({
  section,
  scope,
}: {
  section: 'performance' | 'admission' | 'retention';
  scope: 'career' | 'global';
}) {
  const [performanceCube, setPerformanceCube] = useState<Cube | null>(null);
  const [admissionCube, setAdmissionCube] = useState<Cube | null>(null);
  const [retentionCube, setRetentionCube] = useState<Cube | null>(null);
  const [yearAxis, setYearAxis] = useState<Axis | null>(null);
  const [performanceCareerAxis, setPerformanceCareerAxis] =
    useState<Axis | null>(null);
  const [retentionCareerAxis, setRetentionCareerAxis] = useState<Axis | null>(
    null,
  );
  const [admissionMeasures, setAdmissionMeasures] = useState<string[]>([]);
  const [retentionMeasures, setRetentionMeasures] = useState<string[]>([]);
  const [performanceMeasures, setPerformanceMeasures] = useState<string[]>([]);
  const [performanceRows, setPerformanceRows] = useState<JsonRecord[]>([]);
  const [admissionRows, setAdmissionRows] = useState<JsonRecord[]>([]);
  const [retentionRows, setRetentionRows] = useState<JsonRecord[]>([]);
  const [breakdownAxis, setBreakdownAxis] = useState<Axis | null>(null);
  const [breakdownRows, setBreakdownRows] = useState<JsonRecord[]>([]);
  const [breakdownId, setBreakdownId] =
    useState<(typeof BREAKDOWN_OPTIONS)[number]['id']>('gender');
  const [loading, setLoading] = useState(true);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [error, setError] = useState('');

  const loadBase = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const viewer = await request<{
        viewer: { academicScope: { kind: string; careerIds: string[] } };
      }>(VIEWER_QUERY);
      if (
        viewer.viewer?.academicScope?.kind !== scope ||
        (scope === 'career' && !viewer.viewer.academicScope.careerIds.length)
      ) {
        throw new Error(
          'El contexto académico autorizado no está disponible para esta cuenta.',
        );
      }
      const { olapCubes } = await request<{ olapCubes: Cube[] }>(CUBES_QUERY);
      const cubeName =
        section === 'admission'
          ? 'Academic Admission'
          : section === 'retention'
            ? 'Academic Retention'
            : 'Academic Performance';
      const cube = (olapCubes ?? []).find(
        (item) => normalize(item.cubeName) === normalize(cubeName),
      );
      if (!cube)
        throw new Error(
          'El cubo ' + cubeName + ' no está disponible para tu cuenta.',
        );
      const { olapCubeSchema: schema } = await request<{
        olapCubeSchema: unknown;
      }>(SCHEMA_QUERY, { cubeId: cube.cubeId });
      const year = findAxis(
        schema,
        'Academic Period',
        'Academic Period',
        'Academic Year',
      );
      const career =
        section === 'admission'
          ? null
          : findAxis(schema, 'Academic Program', 'Program', 'Career');
      const requested =
        section === 'admission'
          ? [
              'Applicants',
              'Admitted Applicants',
              'Known Admission Outcomes',
              'Applications',
            ]
          : section === 'retention'
            ? RETENTION_METRICS
            : PERFORMANCE_METRICS;
      const names = requested.map((name) => findMeasure(schema, name));
      if (
        !year ||
        (section !== 'admission' && !career) ||
        names.some((name) => !name)
      )
        throw new Error(
          'El cubo no incluye las dimensiones y medidas requeridas por este reporte.',
        );
      setYearAxis(year);
      const measures = names as string[];
      if (section === 'admission') {
        const axis = findAxis(
          schema,
          BREAKDOWN_OPTIONS[0].dimension,
          BREAKDOWN_OPTIONS[0].hierarchy,
          BREAKDOWN_OPTIONS[0].level,
        );
        const [years, breakdown] = await Promise.all([
          queryCube(cube.cubeId, measures, [year]),
          axis
            ? queryCube(cube.cubeId, measures, [year, axis])
            : Promise.resolve([]),
        ]);
        setAdmissionCube(cube);
        setAdmissionMeasures(measures);
        setYearAxis(year);
        setAdmissionRows(years);
        setBreakdownAxis(axis);
        setBreakdownRows(breakdown);
      } else if (section === 'performance') {
        const rows = await queryCube(cube.cubeId, measures, [year, career!]);
        setPerformanceCube(cube);
        setPerformanceCareerAxis(career);
        setPerformanceMeasures(measures);
        setPerformanceRows(rows);
      } else {
        const rows = await queryCube(cube.cubeId, measures, [year, career!]);
        setRetentionCube(cube);
        setRetentionCareerAxis(career);
        setRetentionMeasures(measures);
        setRetentionRows(rows);
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudieron cargar los indicadores.',
      );
    } finally {
      setLoading(false);
    }
  }, [scope, section]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  const loadBreakdown = useCallback(
    async (id: string) => {
      if (!admissionCube) return;
      const option = BREAKDOWN_OPTIONS.find((item) => item.id === id);
      if (!option) return;
      setBreakdownLoading(true);
      setError('');
      try {
        const schemaResult = await request<{ olapCubeSchema: unknown }>(
          SCHEMA_QUERY,
          { cubeId: admissionCube.cubeId },
        );
        const axis = findAxis(
          schemaResult.olapCubeSchema,
          option.dimension,
          option.hierarchy,
          option.level,
        );
        if (!axis)
          throw new Error(`El cubo no publica la dimensión “${option.label}”.`);
        const rows = await queryCube(admissionCube.cubeId, admissionMeasures, [
          yearAxis!,
          axis,
        ]);
        setBreakdownId(option.id);
        setBreakdownAxis(axis);
        setBreakdownRows(rows);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'No se pudo cargar el desglose.',
        );
      } finally {
        setBreakdownLoading(false);
      }
    },
    [admissionCube, admissionMeasures, yearAxis],
  );

  const admissionTableRows = useMemo(
    () =>
      admissionRows
        .map((row) => ({
          year: asText(readCell(row, yearAxis?.level ?? 'Academic Year')),
          applicants: asNumber(
            readCell(row, admissionMeasures[0] ?? 'Applicants'),
          ),
          admitted: asNumber(
            readCell(row, admissionMeasures[1] ?? 'Admitted Applicants'),
          ),
          known: asNumber(
            readCell(row, admissionMeasures[2] ?? 'Known Admission Outcomes'),
          ),
          applications: asNumber(
            readCell(row, admissionMeasures[3] ?? 'Applications'),
          ),
        }))
        .sort((a, b) =>
          a.year.localeCompare(b.year, undefined, { numeric: true }),
        ),
    [admissionRows, admissionMeasures, yearAxis],
  );

  const performanceTableRows = performanceRows
    .map((row) => {
      const attempts = asNumber(
        readCell(row, performanceMeasures[0] ?? 'Enrollment Attempts'),
      );
      const graded = asNumber(
        readCell(row, performanceMeasures[1] ?? 'Graded Attempts'),
      );
      const passed = asNumber(
        readCell(row, performanceMeasures[2] ?? 'Passed Attempts'),
      );
      const failed = asNumber(
        readCell(row, performanceMeasures[3] ?? 'Failed Attempts'),
      );
      const repeated = asNumber(
        readCell(row, performanceMeasures[4] ?? 'Repeated Attempts'),
      );
      const abandoned = asNumber(
        readCell(row, performanceMeasures[5] ?? 'Abandoned Attempts'),
      );
      const averageGrade = asNumber(
        readCell(row, performanceMeasures[6] ?? 'Average Final Grade'),
      );
      return {
        year: asText(readCell(row, yearAxis?.level ?? 'Academic Year')),
        career: asText(readCell(row, performanceCareerAxis?.level ?? 'Career')),
        attempts,
        graded,
        passed,
        failed,
        repeated,
        abandoned,
        averageGrade,
      };
    })
    .sort(
      (a, b) =>
        a.year.localeCompare(b.year, undefined, { numeric: true }) ||
        a.career.localeCompare(b.career),
    );

  const retentionTableRows = retentionRows
    .map((row) => {
      const year = asText(readCell(row, yearAxis?.level ?? 'Academic Year'));
      const evaluable = asNumber(
        readCell(row, retentionMeasures[0] ?? RETENTION_METRICS[0]),
      );
      const retained = asNumber(
        readCell(row, retentionMeasures[1] ?? RETENTION_METRICS[1]),
      );
      const dropouts = asNumber(
        readCell(row, retentionMeasures[2] ?? RETENTION_METRICS[2]),
      );
      return {
        year,
        career: asText(readCell(row, retentionCareerAxis?.level ?? 'Career')),
        evaluable,
        retained,
        dropouts,
        dropoutRate:
          evaluable && dropouts !== null ? (dropouts / evaluable) * 100 : null,
      };
    })
    .sort(
      (a, b) =>
        a.year.localeCompare(b.year, undefined, { numeric: true }) ||
        a.career.localeCompare(b.career),
    );
  const admissionVolumeSeries = admissionTableRows.flatMap((row) =>
    row.applicants === null ? [] : [{ label: row.year, value: row.applicants }],
  );
  const admissionRateSeries = admissionTableRows.flatMap((row) =>
    row.known && row.admitted !== null
      ? [{ label: row.year, value: (row.admitted / row.known) * 100 }]
      : [],
  );
  const dropoutRateSeries = retentionTableRows.flatMap((row) =>
    row.dropoutRate === null
      ? []
      : [{ label: `${row.year} · ${row.career}`, value: row.dropoutRate }],
  );

  const breakdownOption = BREAKDOWN_OPTIONS.find(
    (option) => option.id === breakdownId,
  );
  const breakdownTableRows = breakdownRows.map((row) => ({
    year: asText(readCell(row, yearAxis?.level ?? 'Academic Year')),
    category: asText(readCell(row, breakdownAxis?.level ?? '')),
    applicants: asNumber(readCell(row, admissionMeasures[0] ?? 'Applicants')),
    admitted: asNumber(
      readCell(row, admissionMeasures[1] ?? 'Admitted Applicants'),
    ),
    known: asNumber(
      readCell(row, admissionMeasures[2] ?? 'Known Admission Outcomes'),
    ),
    applications: asNumber(
      readCell(row, admissionMeasures[3] ?? 'Applications'),
    ),
  }));

  return (
    <div className="space-y-6">
      {section === 'performance' && (
        <section
          aria-labelledby="director-performance-detail-title"
          aria-busy={loading}
          className={SECTION_CLASS}
        >
          <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
            <CardTitle id="director-performance-detail-title">
              Rendimiento y regularidad académica
            </CardTitle>
            <CardDescription>
              Promedios y resultados de cursado por gestión en el ámbito
              autorizado. Repetición y abandono son conteos de intentos, no
              personas.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
            {loading ? (
              <Loader text="Cargando el cubo de rendimiento…" fullScreen={false} className="rounded-lg" />
            ) : performanceCube ? (
              <DataTable
                caption="Rendimiento y regularidad por gestión académica"
                headers={[
                  'Gestión',
                  'Carrera',
                  'Intentos',
                  'Intentos calificados',
                  'Promedio final',
                  'Aprobados',
                  'Reprobados',
                  'Tasa de reprobación',
                  'Repeticiones',
                  'Tasa de repetición',
                  'Abandonos',
                  'Tasa de abandono',
                ]}
                rows={performanceTableRows.map((row) => [
                  row.year,
                  row.career,
                  formatCount(row.attempts),
                  formatCount(row.graded),
                  row.averageGrade === null
                    ? '—'
                    : new Intl.NumberFormat('es-BO', {
                        maximumFractionDigits: 2,
                      }).format(row.averageGrade),
                  formatCount(row.passed),
                  formatCount(row.failed),
                  formatPercent(
                    row.graded && row.failed !== null
                      ? (row.failed / row.graded) * 100
                      : null,
                  ),
                  formatCount(row.repeated),
                  formatPercent(
                    row.attempts && row.repeated !== null
                      ? (row.repeated / row.attempts) * 100
                      : null,
                  ),
                  formatCount(row.abandoned),
                  formatPercent(
                    row.attempts && row.abandoned !== null
                      ? (row.abandoned / row.attempts) * 100
                      : null,
                  ),
                ])}
                empty="No hay intentos de cursado para las gestiones del contexto asignado."
              />
            ) : null}
          </CardContent>
        </section>
      )}

      {section === 'admission' && (
        <section
          aria-labelledby="director-admission-title"
          aria-busy={loading || breakdownLoading}
          className={SECTION_CLASS}
        >
          <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
            <CardTitle id="director-admission-title">
              Admisión estudiantil
            </CardTitle>
            <CardDescription>
              Personas identificadas, solicitudes y resultados por gestión. La
              tasa usa resultados conocidos y la variación compara con la
              gestión anterior disponible.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
            {loading ? (
              <Loader text="Cargando el cubo de admisión…" fullScreen={false} className="rounded-lg" />
            ) : (
              admissionCube && (
                <>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="min-w-0 rounded-lg border border-border p-3">
                      <AcademicBarChart
                        data={admissionVolumeSeries}
                        title="Postulantes identificados por gestión"
                        ariaLabel={`Postulantes identificados por gestión. ${admissionVolumeSeries.length} gestiones.`}
                        loading={loading}
                        emptyMessage="No hay registros identificados para graficar."
                        height={280}
                      />
                    </div>
                    <div className="min-w-0 rounded-lg border border-border p-3">
                      <TrendLineChart
                        data={admissionRateSeries}
                        title="Tasa de admisión observada"
                        ariaLabel={`Tasa de admisión por gestión sobre resultados conocidos. ${admissionRateSeries.length} gestiones.`}
                        loading={loading}
                        emptyMessage="No hay resultados conocidos para calcular la tasa."
                        height={280}
                      />
                    </div>
                  </div>
                  <DataTable
                    caption="Postulantes y admitidos identificados por gestión académica"
                    headers={[
                      'Gestión',
                      'Postulantes identificados',
                      'Admitidos identificados',
                      'Solicitudes',
                      'Resultados conocidos',
                      'Tasa de admisión',
                      'Variación postulantes',
                      'Variación admitidos',
                    ]}
                    rows={admissionTableRows.map((row, index) => {
                      const previous =
                        admissionTableRows[index - 1]?.applicants;
                      const previousAdmitted =
                        admissionTableRows[index - 1]?.admitted;
                      const growth =
                        previous && row.applicants !== null
                          ? ((row.applicants - previous) / previous) * 100
                          : null;
                      const admittedGrowth =
                        previousAdmitted && row.admitted !== null
                          ? ((row.admitted - previousAdmitted) /
                              previousAdmitted) *
                            100
                          : null;
                      const rate =
                        row.known && row.admitted !== null
                          ? (row.admitted / row.known) * 100
                          : null;
                      return [
                        row.year,
                        formatCount(row.applicants),
                        formatCount(row.admitted),
                        formatCount(row.applications),
                        formatCount(row.known),
                        formatPercent(rate),
                        formatPercent(growth),
                        formatPercent(admittedGrowth),
                      ];
                    })}
                    empty="No hay postulaciones con datos para el contexto asignado."
                  />
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-foreground">
                          Distribución de postulantes
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Consulta un desglose agregado por año. Las celdas
                          pequeñas se ocultan según la política de privacidad
                          OLAP.
                        </p>
                      </div>
                      <label className="grid gap-1 text-sm font-medium text-foreground">
                        Agrupar por
                        <select
                          className="min-h-10 rounded-md border border-input bg-background px-3"
                          value={breakdownId}
                          disabled={breakdownLoading}
                          onChange={(event) =>
                            void loadBreakdown(event.target.value)
                          }
                        >
                          {BREAKDOWN_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <DataTable
                      caption={`Postulantes y admitidos por gestión y ${breakdownOption?.label.toLocaleLowerCase() ?? 'categoría'}`}
                      headers={[
                        'Gestión',
                        breakdownOption?.label ?? 'Categoría',
                        'Postulantes identificados',
                        'Admitidos identificados',
                        'Solicitudes',
                        'Tasa de admisión',
                      ]}
                      rows={breakdownTableRows.map((row) => [
                        row.year,
                        row.category,
                        formatCount(row.applicants),
                        formatCount(row.admitted),
                        formatCount(row.applications),
                        formatPercent(
                          row.known && row.admitted !== null
                            ? (row.admitted / row.known) * 100
                            : null,
                        ),
                      ])}
                      empty={
                        breakdownLoading
                          ? 'Cargando desglose…'
                          : 'No hay datos para este desglose en el contexto asignado.'
                      }
                    />
                  </div>
                </>
              )
            )}
          </CardContent>
        </section>
      )}

      {section === 'retention' && (
        <section
          aria-labelledby="director-retention-title"
          aria-busy={loading}
          className={SECTION_CLASS}
        >
          <CardHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
            <CardTitle id="director-retention-title">
              Permanencia y deserción observada
            </CardTitle>
            <CardDescription>
              Los resultados se calculan únicamente sobre snapshots evaluables
              de periodos cerrados. Los casos no evaluables se excluyen de las
              tasas.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
            {loading ? (
              <Loader text="Cargando el cubo de permanencia…" fullScreen={false} className="rounded-lg" />
            ) : (
              retentionCube && (
                <div className="space-y-4">
                  <div className="min-w-0 rounded-lg border border-border p-3">
                    <TrendLineChart
                      data={dropoutRateSeries}
                      title="Tasa observada de deserción"
                      ariaLabel={`Tasa observada de deserción por gestión cerrada. ${dropoutRateSeries.length} gestiones.`}
                      loading={loading}
                      emptyMessage="No hay cierres evaluables para graficar."
                      height={280}
                    />
                  </div>
                  <DataTable
                    caption="Retención y deserción por gestión académica"
                    headers={[
                      'Gestión',
                      'Carrera',
                      'Casos evaluables',
                      'Estudiantes retenidos',
                      'Deserciones observadas',
                      'Tasa observada de deserción',
                    ]}
                    rows={retentionTableRows.map((row) => [
                      row.year,
                      row.career,
                      formatCount(row.evaluable),
                      formatCount(row.retained),
                      formatCount(row.dropouts),
                      formatPercent(row.dropoutRate),
                    ])}
                    empty="No hay cierres con snapshots evaluables para el contexto asignado."
                  />
                </div>
              )
            )}
          </CardContent>
        </section>
      )}

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-foreground">{error}</p>
          <Button
            variant="outline"
            onClick={() =>
              void (admissionCube ? loadBreakdown(breakdownId) : loadBase())
            }
            disabled={loading || breakdownLoading}
          >
            Reintentar
          </Button>
        </div>
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        Las cifras corresponden al ámbito académico autorizado para tu cuenta.
      </p>
    </div>
  );
}

function formatPercent(value: number | null): string {
  return value === null || !Number.isFinite(value)
    ? '—'
    : new Intl.NumberFormat('es-BO', {
        style: 'percent',
        maximumFractionDigits: 1,
      }).format(value / 100);
}

function DataTable({
  caption,
  headers,
  rows,
  empty,
}: {
  caption: string;
  headers: string[];
  rows: string[][];
  empty: string;
}) {
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const filtered = rows.filter((row) =>
    row.some((cell) =>
      cell.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()),
    ),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pageCount - 1);
  return (
    <div className="space-y-3">
      <label className="grid max-w-sm gap-1 text-sm font-medium">
        Filtrar {caption.toLocaleLowerCase()}
        <input
          type="search"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            setPage(0);
          }}
          placeholder="Buscar en la tabla"
          className="min-h-10 rounded-md border border-input bg-background px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        El filtro busca en los resultados cargados
        {rows.length >= 500 ? '; la consulta muestra hasta 500 filas' : ''}.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className={TABLE_CLASS}>
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground">
            <tr>
              {headers.map((header) => (
                <th key={header} scope="col" className="px-3 py-2.5">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length ? (
              filtered
                .slice(currentPage * 10, currentPage * 10 + 10)
                .map((row, index) => (
                  <tr
                    key={`${currentPage * 10 + index}-${row[0]}`}
                    className="text-foreground"
                  >
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`${cellIndex}-${cell}`}
                        className="px-3 py-2.5 tabular-nums"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
            ) : (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span aria-live="polite">
          {filtered.length} resultados · página {currentPage + 1} de {pageCount}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            disabled={currentPage + 1 >= pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
