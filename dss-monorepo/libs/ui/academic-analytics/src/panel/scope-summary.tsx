'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  DoorOpen,
  LogOut,
  Percent,
  RotateCcw,
  ShieldCheck,
  Star,
  Users,
} from 'lucide-react';
import { Button, Card, Skeleton } from '@dss-monorepo/design-system';
import {
  ChartFrame,
  EmptyState,
  FilterBar,
  KpiCard,
  NativeSelect,
  PageContainer,
  PageHeader,
  RefreshIndicator,
  StatusBanner,
  type DeltaBadgeProps,
} from '@dss-monorepo/design-system/page';
import { useReveal } from '@dss-monorepo/design-system/motion';
import { TrendLineChart } from '@dss-monorepo/charts';
import { AcademicSparkline } from '../academic-sparkline';
import { useAcademicScope, useScopeYear } from './academic-scope';
import {
  CAREER_AXIS,
  FACULTY_AXIS,
  YEAR_AXIS,
  assertViewerScope,
  formatValue,
  queryCube,
  yearMembers,
  type Axis,
  type DataRow,
  type Member,
} from './rendimiento-data';
import {
  CAREER_RULES,
  FACULTY_RULES,
  SUMMARY_CUBES,
  SUMMARY_MEASURES,
  attentionFor,
  deltaOf,
  facultiesIn,
  facultyYearSeries,
  measuresOf,
  mergeCareers,
  previousYear,
  type AttentionRule,
  type CareerRow,
  type SummaryCube,
  type SummaryKey,
  type SummaryValues,
} from './faculty-summary-data';

type CubeRows = Partial<Record<SummaryCube, DataRow[]>>;

/** Subjects of a career; only the coursework cube publishes the Materia dimension. */
const SUBJECT_AXIS: Axis = {
  dimension: 'Materia',
  hierarchy: 'Nivel y materia',
  level: 'Materia',
};

interface SummaryConfig {
  scope: 'faculty' | 'career';
  /** The unit the user governs and can pick when there are several. */
  unitAxis: Axis;
  unitLabel: string;
  title: string;
  description: (unit: string) => string;
  /** The rows compared with the unit in the table. */
  detail: {
    axis: Axis;
    cubes: SummaryCube[];
    header: string;
    title: (year: string) => string;
    caption: string;
    referenceLabel: string;
    columns: SummaryKey[];
    sorts: Array<{ key: SummaryKey; label: string; direction: 1 | -1 }>;
    rules: AttentionRule[];
    empty: string;
  };
}

const KPIS: SummaryKey[] = [
  'applications',
  'admissionRate',
  'passRate',
  'averageGrade',
  'dropoutRate',
  'retentionRate',
];
const TRENDS: SummaryKey[] = ['applications', 'passRate', 'dropoutRate'];

const FACULTY_CONFIG: SummaryConfig = {
  scope: 'faculty',
  unitAxis: FACULTY_AXIS,
  unitLabel: 'Facultad',
  title: 'Resumen de la facultad',
  description: (unit) =>
    `${unit}: admisión, rendimiento y permanencia de sus carreras, comparadas con el promedio de la facultad.`,
  detail: {
    axis: CAREER_AXIS,
    cubes: SUMMARY_CUBES,
    header: 'Carrera',
    title: (year) => `Carreras de la facultad, gestión ${year}`,
    caption:
      'Se marcan las carreras con aprobación o deserción a más de 5 puntos del promedio de la facultad.',
    referenceLabel: 'Promedio de la facultad',
    columns: [
      'applications',
      'admissionRate',
      'passRate',
      'averageGrade',
      'dropoutRate',
    ],
    sorts: [
      { key: 'applications', label: 'Más postulaciones', direction: -1 },
      { key: 'passRate', label: 'Menor aprobación', direction: 1 },
      { key: 'dropoutRate', label: 'Mayor deserción', direction: -1 },
    ],
    rules: FACULTY_RULES,
    empty: 'No hay carreras con datos para esta gestión.',
  },
};

const CAREER_CONFIG: SummaryConfig = {
  scope: 'career',
  unitAxis: CAREER_AXIS,
  unitLabel: 'Carrera',
  title: 'Resumen de la carrera',
  description: (unit) =>
    `${unit}: admisión, rendimiento y permanencia de la carrera, y sus materias comparadas con el promedio de la carrera.`,
  detail: {
    axis: SUBJECT_AXIS,
    cubes: ['Rendimiento académico'],
    header: 'Materia',
    title: (year) => `Materias de la carrera, gestión ${year}`,
    caption:
      'Se marcan las materias con reprobación o repitencia a más de 5 puntos del promedio de la carrera.',
    referenceLabel: 'Promedio de la carrera',
    columns: [
      'attempts',
      'passRate',
      'failRate',
      'repetitionRate',
      'averageGrade',
    ],
    sorts: [
      { key: 'failRate', label: 'Mayor reprobación', direction: -1 },
      { key: 'repetitionRate', label: 'Mayor repitencia', direction: -1 },
      { key: 'attempts', label: 'Más inscripciones', direction: -1 },
    ],
    rules: CAREER_RULES,
    empty: 'No hay materias con datos para esta gestión.',
  },
};

const measureOf = (key: SummaryKey) =>
  SUMMARY_MEASURES.find((item) => item.key === key)!;
const show = (key: SummaryKey, value: number | null | undefined) =>
  formatValue(value ?? null, measureOf(key).format);

/** Indicators where a lower value is good news. */
const LOWER_IS_BETTER = new Set<SummaryKey>([
  'dropoutRate',
  'failRate',
  'repetitionRate',
]);

const KPI_ICONS: Partial<Record<SummaryKey, ReactNode>> = {
  applications: <DoorOpen />,
  admissionRate: <Percent />,
  passRate: <CheckCircle2 />,
  averageGrade: <Star />,
  dropoutRate: <LogOut />,
  retentionRate: <Users />,
};

/**
 * Change against the previous gestión for DeltaBadge: percentage points for
 * rates, relative change (%) for counts and averages.
 */
function deltaBadge(
  key: SummaryKey,
  delta: number | null,
  previousLabel: string | null,
): DeltaBadgeProps {
  return {
    value: delta == null ? null : delta * 100,
    unit: measureOf(key).format === 'percent' ? 'pp' : '%',
    goodWhen: LOWER_IS_BETTER.has(key) ? 'down' : 'up',
    comparisonLabel: previousLabel
      ? `respecto a ${previousLabel}`
      : 'frente a la gestión anterior',
  };
}

const measureNames = (cube: SummaryCube) =>
  measuresOf(cube).map((item) => item.measure);
/** The cube's base count (first measure), non-empty wherever a row has data; used to rank rows. */
const baseMeasure = (cube: SummaryCube) => measuresOf(cube)[0].measure;

const settledRows = (
  cubes: SummaryCube[],
  results: PromiseSettledResult<DataRow[]>[],
): CubeRows =>
  Object.fromEntries(
    cubes.map((cube, i) => [
      cube,
      results[i].status === 'fulfilled' ? results[i].value : [],
    ]),
  );

/** Dean's home: the selected faculty and its careers. */
export function FacultySummaryDashboard() {
  return <ScopeSummaryDashboard config={FACULTY_CONFIG} />;
}

/** Director's home: the selected career and its subjects. */
export function CareerSummaryDashboard() {
  return <ScopeSummaryDashboard config={CAREER_CONFIG} />;
}

/**
 * KPIs of one governed unit for a gestión, their evolution, and its details
 * compared with the unit's own value. Every query runs inside the user's
 * academic scope (enforced by the BFF); with several units a selector appears.
 */
function ScopeSummaryDashboard({ config }: { config: SummaryConfig }) {
  const { detail } = config;
  const [cubeYears, setCubeYears] = useState<
    Partial<Record<SummaryCube, Member[]>>
  >({});
  // Shared with the header badge when the portal provides an academic scope.
  const { unit, units, setUnit, setUnits, shared } = useAcademicScope();
  const [trendRows, setTrendRows] = useState<CubeRows | null>(null);
  const [detailRows, setDetailRows] = useState<CubeRows | null>(null);
  const [failed, setFailed] = useState<SummaryCube[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [trendKey, setTrendKey] = useState<SummaryKey>('applications');
  const [sortIndex, setSortIndex] = useState(0);

  // Scope check, gestiones and the per-gestión series of every unit in scope.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    (async () => {
      await assertViewerScope(config.scope);
      const yearResults = await Promise.allSettled(
        SUMMARY_CUBES.map((cube) => yearMembers(cube)),
      );
      // Gestiones of every cube: admissions and coursework do not cover the same years.
      const members = [
        ...new Map(
          yearResults
            .flatMap((result) =>
              result.status === 'fulfilled' ? result.value : [],
            )
            .map((m) => [m.caption, m]),
        ).values(),
      ].sort((a, b) =>
        a.caption.localeCompare(b.caption, 'es', { numeric: true }),
      );
      if (!members.length)
        throw new Error('No hay gestiones académicas publicadas.');
      const results = await Promise.allSettled(
        SUMMARY_CUBES.map((cube) =>
          queryCube(
            cube,
            measureNames(cube),
            [config.unitAxis, YEAR_AXIS[cube]],
            undefined,
            baseMeasure(cube),
          ),
        ),
      );
      if (!active) return;
      if (results.every((result) => result.status === 'rejected'))
        throw (results[0] as PromiseRejectedResult).reason;
      const rows = settledRows(SUMMARY_CUBES, results);
      // A unit may lack data in one cube (e.g. no admissions), so list the union.
      const found = [
        ...new Set(
          SUMMARY_CUBES.flatMap((cube) =>
            facultiesIn(rows[cube] ?? [], config.unitAxis.level),
          ),
        ),
      ].sort((a, b) => a.localeCompare(b, 'es'));
      setFailed(
        SUMMARY_CUBES.filter((_, i) => results[i].status === 'rejected'),
      );
      setCubeYears(
        Object.fromEntries(
          SUMMARY_CUBES.map((cube, i) => [
            cube,
            yearResults[i].status === 'fulfilled' ? yearResults[i].value : [],
          ]),
        ),
      );
      // Keeps the current unit when it is still in scope, otherwise picks the first.
      setUnits(found);
      setTrendRows(rows);
    })()
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : `No se pudo cargar el ${config.title.toLocaleLowerCase('es')}.`,
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, config, setUnits]);

  const series = useMemo(() => {
    const merged = new Map<string, SummaryValues>();
    if (!trendRows || !unit) return merged;
    for (const cube of SUMMARY_CUBES) {
      for (const [label, values] of facultyYearSeries(
        trendRows[cube] ?? [],
        cube,
        unit,
        config.unitAxis.level,
        YEAR_AXIS[cube].level,
      ))
        merged.set(label, { ...merged.get(label), ...values });
    }
    return merged;
  }, [trendRows, unit, config]);

  const yearLabels = useMemo(
    () =>
      [...series.keys()].sort((a, b) =>
        a.localeCompare(b, 'es', { numeric: true }),
      ),
    [series],
  );
  // One gestión for the whole portal (header); this page offers the gestiones
  // with data for the unit and falls back to the latest one.
  const { year, setYear } = useScopeYear(yearLabels, yearLabels.at(-1) ?? '');

  // Details of the selected gestión.
  useEffect(() => {
    if (!year || loading || error) return;
    let active = true;
    setDetailLoading(true);
    Promise.allSettled(
      detail.cubes.map((cube) => {
        // A cube without this gestión has no details to show for it.
        const member = cubeYears[cube]?.find((item) => item.caption === year);
        return member
          ? queryCube(
              cube,
              measureNames(cube),
              [config.unitAxis, detail.axis],
              member,
              baseMeasure(cube),
            )
          : Promise.resolve([] as DataRow[]);
      }),
    )
      .then((results) => {
        if (active) setDetailRows(settledRows(detail.cubes, results));
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [year, cubeYears, loading, error, config, detail]);

  const current = series.get(year) ?? {};
  const prevLabel = previousYear(yearLabels, year);
  const previous = prevLabel ? (series.get(prevLabel) ?? {}) : {};

  const details = useMemo(() => {
    if (!detailRows || !unit) return [] as CareerRow[];
    const rows = mergeCareers(
      detail.cubes.map((cube) => ({ cube, rows: detailRows[cube] ?? [] })),
      unit,
      config.unitAxis.level,
      detail.axis.level,
    );
    const sort = detail.sorts[sortIndex];
    return rows.sort((a, b) => {
      const x = a.values[sort.key];
      const y = b.values[sort.key];
      if (x == null) return 1;
      if (y == null) return -1;
      return (x - y) * sort.direction;
    });
  }, [detailRows, unit, sortIndex, config, detail]);

  const trendPoints = useMemo(
    () =>
      yearLabels.flatMap((label) => {
        const value = series.get(label)?.[trendKey];
        if (value == null) return [];
        return [
          {
            label,
            value:
              measureOf(trendKey).format === 'percent'
                ? Math.round(value * 1000) / 10
                : value,
          },
        ];
      }),
    [yearLabels, series, trendKey],
  );

  /** Per-indicator series for the KPI sparklines, rebuilt only when data changes. */
  const sparklines = useMemo(
    () =>
      Object.fromEntries(
        KPIS.map((key) => [
          key,
          yearLabels.flatMap((label) => {
            const value = series.get(label)?.[key];
            return value == null ? [] : [{ label, value }];
          }),
        ]),
      ) as Record<SummaryKey, { label: string; value: number }[]>,
    [yearLabels, series],
  );

  // First load shows skeletons; later loads keep the data on screen and dim it.
  const firstLoad = loading && !trendRows;
  const refreshing = loading && !!trendRows;
  const unitName = config.unitLabel.toLocaleLowerCase('es');

  // One staggered entrance when the first data lands; never on refresh.
  const pageRef = useRef<HTMLDivElement>(null);
  useReveal(pageRef, { when: !firstLoad && !error });

  if (error && !trendRows)
    return (
      <PageContainer>
        <PageHeader
          title={config.title}
          description={config.description(config.unitLabel)}
        />
        <StatusBanner
          title={`No se pudo cargar el ${config.title.toLocaleLowerCase('es')}`}
          description={error}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      </PageContainer>
    );

  return (
    <div ref={pageRef}>
      <PageContainer>
        <PageHeader
          title={config.title}
          description={config.description(unit || config.unitLabel)}
          meta={
            shared ? (
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck aria-hidden="true" className="size-3.5" />
                {`Datos limitados a tu ${unitName}`}
              </span>
            ) : year ? (
              `Gestión ${year}`
            ) : undefined
          }
          actions={
            <Button
              variant="outline"
              loading={refreshing}
              iconLeft={<RotateCcw aria-hidden="true" />}
              onClick={() => setAttempt((n) => n + 1)}
            >
              {refreshing ? 'Actualizando…' : 'Actualizar datos'}
            </Button>
          }
        />

        {/* With a shared scope the header holds the unit and gestión selectors. */}
        {shared ? null : (
          <FilterBar
            label={`Filtros del ${config.title.toLocaleLowerCase('es')}`}
            aside={
              <>
                <ShieldCheck aria-hidden="true" />
                {`Datos limitados a tu ${unitName}`}
              </>
            }
          >
            {units.length > 1 ? (
              <NativeSelect
                label={config.unitLabel}
                value={unit}
                onChange={(event) => setUnit(event.currentTarget.value)}
                options={units.map((item) => ({ value: item, label: item }))}
                containerClassName="min-w-56"
              />
            ) : null}
            <NativeSelect
              label="Gestión académica"
              value={year}
              disabled={firstLoad}
              onChange={(event) => setYear(event.currentTarget.value)}
              options={[...yearLabels].reverse().map((label) => ({
                value: label,
                label,
              }))}
            />
          </FilterBar>
        )}

        {error ? (
          <StatusBanner
            title="No se pudieron actualizar los datos"
            description={`${error} Se muestran los últimos datos cargados.`}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        ) : null}
        {failed.length > 0 ? (
          <StatusBanner
            tone="warning"
            title="Algunos indicadores no están disponibles"
            description={`No se pudo consultar: ${failed.join(', ')}. El resto de indicadores sigue disponible.`}
          />
        ) : null}

        <section
          aria-label={`Indicadores de la ${unitName}`}
          className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-6"
        >
          {KPIS.map((key) => (
            <KpiCard
              key={key}
              label={measureOf(key).label}
              icon={KPI_ICONS[key]}
              value={current[key] ?? null}
              format={(value) => show(key, value)}
              emptyLabel="Sin dato para esta gestión"
              loading={firstLoad}
              refreshing={refreshing}
              delta={
                current[key] == null
                  ? undefined
                  : deltaBadge(
                      key,
                      deltaOf(
                        current[key],
                        previous[key],
                        measureOf(key).format,
                      ),
                      prevLabel,
                    )
              }
              detail={
                current[key] == null && !firstLoad
                  ? 'Sin dato para esta gestión'
                  : undefined
              }
              sparkline={
                sparklines[key]?.length > 1 ? (
                  <AcademicSparkline
                    label={measureOf(key).label}
                    data={sparklines[key]}
                    formatValue={(value) => show(key, value)}
                    className="h-7 w-24 text-role-accent"
                  />
                ) : undefined
              }
            />
          ))}
        </section>

        <ChartFrame
          title={`Evolución de la ${unitName}`}
          description={`Valor de la ${unitName} en cada gestión.`}
          loading={firstLoad}
          refreshing={refreshing}
          height={280}
          empty={
            !firstLoad && trendPoints.length === 0
              ? {
                  title: 'Sin datos para este indicador',
                  description:
                    'Prueba con otro indicador o revisa si los cubos ya publican gestiones.',
                }
              : undefined
          }
          actions={
            <div
              role="group"
              aria-label="Indicador de la evolución"
              className="inline-flex flex-wrap gap-1 rounded-xl bg-(--glass-track) p-1"
            >
              {TRENDS.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={key === trendKey}
                  onClick={() => setTrendKey(key)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-[background-color,color,box-shadow] duration-(--dur-fast) hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-glass dark:aria-pressed:bg-white/10"
                >
                  {measureOf(key).label}
                </button>
              ))}
            </div>
          }
        >
          <TrendLineChart
            data={trendPoints}
            ariaLabel={`${measureOf(trendKey).label}${measureOf(trendKey).format === 'percent' ? ' (%)' : ''} de ${unit} por gestión`}
            height={280}
          />
        </ChartFrame>

        <Card data-reveal className="gap-0 py-0">
          <RefreshIndicator
            active={detailLoading && details.length > 0}
            label="Actualizando el detalle…"
          />
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 px-5 pt-5 pb-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="font-heading text-base font-semibold tracking-tight">
                {detail.title(year)}
              </h2>
              <p className="mt-0.5 max-w-[70ch] text-xs text-muted-foreground">
                {detail.caption}
              </p>
            </div>
            <NativeSelect
              label="Ordenar por"
              value={String(sortIndex)}
              onChange={(event) =>
                setSortIndex(Number(event.currentTarget.value))
              }
              options={detail.sorts.map((sort, index) => ({
                value: String(index),
                label: sort.label,
              }))}
            />
          </div>

          {(firstLoad || detailLoading) && details.length === 0 ? (
            <div
              aria-hidden="true"
              className="flex flex-col gap-3 px-5 pb-6 sm:px-6"
            >
              {[0, 1, 2, 3, 4].map((row) => (
                <Skeleton key={row} className="h-9 w-full rounded-lg" />
              ))}
            </div>
          ) : details.length === 0 ? (
            <EmptyState
              title={detail.empty}
              description="Elige otra gestión o revisa si el cierre académico ya se publicó."
            />
          ) : (
            <div
              role="region"
              aria-label={detail.title(year)}
              tabIndex={0}
              className={`overflow-x-auto border-t border-(--glass-border) transition-opacity duration-(--dur-base) focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none ${detailLoading ? 'opacity-60' : ''}`}
            >
              <table className="w-full min-w-[760px] text-left text-sm">
                <caption className="sr-only">{`${detail.title(year)}. ${detail.caption}`}</caption>
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th scope="col" className="px-5 py-3 font-medium sm:px-6">
                      {detail.header}
                    </th>
                    {detail.columns.map((key) => (
                      <th
                        key={key}
                        scope="col"
                        className="px-3 py-3 text-right font-medium"
                      >
                        {measureOf(key).label}
                      </th>
                    ))}
                    <th scope="col" className="px-5 py-3 font-medium sm:px-6">
                      Atención
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-(--glass-border) bg-(--glass-track) text-muted-foreground">
                    <th
                      scope="row"
                      className="px-5 py-3 font-medium italic sm:px-6"
                    >
                      {detail.referenceLabel}
                    </th>
                    {detail.columns.map((key) => (
                      <td
                        key={key}
                        className="px-3 py-3 text-right tabular-nums"
                      >
                        {show(key, current[key])}
                      </td>
                    ))}
                    <td className="px-5 py-3 text-xs sm:px-6">Referencia</td>
                  </tr>
                  {details.map((row) => {
                    const flags = attentionFor(
                      row.values,
                      current,
                      detail.rules,
                    );
                    return (
                      <tr
                        key={row.career}
                        className="border-t border-(--glass-border) transition-colors duration-(--dur-instant) hover:bg-role-accent/5"
                      >
                        <th
                          scope="row"
                          className="px-5 py-3 font-medium sm:px-6"
                        >
                          {row.career}
                        </th>
                        {detail.columns.map((key) => (
                          <td
                            key={key}
                            className={`px-3 py-3 text-right tabular-nums ${flags.some((flag) => flag.key === key) ? 'font-semibold text-destructive' : ''}`}
                          >
                            {show(key, row.values[key])}
                          </td>
                        ))}
                        <td className="px-5 py-3 sm:px-6">
                          {flags.length ? (
                            <span className="inline-flex flex-wrap gap-1.5">
                              {flags.map((flag) => (
                                <span
                                  key={flag.key}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-warning/14 px-2.5 whitespace-nowrap py-0.5 text-xs font-medium text-warning ring-1 ring-inset ring-warning/30"
                                >
                                  <AlertTriangle
                                    aria-hidden="true"
                                    className="size-3.5"
                                  />
                                  {flag.message}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-2.5 whitespace-nowrap py-0.5 text-xs font-medium text-success ring-1 ring-inset ring-success/25">
                              <CheckCircle2
                                aria-hidden="true"
                                className="size-3.5"
                              />
                              En rango
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </PageContainer>
    </div>
  );
}
