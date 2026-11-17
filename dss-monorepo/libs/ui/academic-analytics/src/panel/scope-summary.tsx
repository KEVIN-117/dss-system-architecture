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
import { AcademicSparkline } from '../academic-sparkline';
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
const SUBJECT_AXIS: Axis = { dimension: 'Materia', hierarchy: 'Nivel y materia', level: 'Materia' };

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

const KPIS: SummaryKey[] = ['applications', 'admissionRate', 'passRate', 'averageGrade', 'dropoutRate', 'retentionRate'];
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
    caption: 'Se marcan las carreras con aprobación o deserción a más de 5 puntos del promedio de la facultad.',
    referenceLabel: 'Promedio de la facultad',
    columns: ['applications', 'admissionRate', 'passRate', 'averageGrade', 'dropoutRate'],
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
    caption: 'Se marcan las materias con reprobación o repitencia a más de 5 puntos del promedio de la carrera.',
    referenceLabel: 'Promedio de la carrera',
    columns: ['attempts', 'passRate', 'failRate', 'repetitionRate', 'averageGrade'],
    sorts: [
      { key: 'failRate', label: 'Mayor reprobación', direction: -1 },
      { key: 'repetitionRate', label: 'Mayor repitencia', direction: -1 },
      { key: 'attempts', label: 'Más inscripciones', direction: -1 },
    ],
    rules: CAREER_RULES,
    empty: 'No hay materias con datos para esta gestión.',
  },
};

const measureOf = (key: SummaryKey) => SUMMARY_MEASURES.find((item) => item.key === key)!;
const show = (key: SummaryKey, value: number | null | undefined) => formatValue(value ?? null, measureOf(key).format);

function formatDelta(key: SummaryKey, delta: number | null): string | null {
  if (delta === null) return null;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  const abs = Math.abs(delta);
  return measureOf(key).format === 'percent'
    ? `${sign}${new Intl.NumberFormat('es-BO', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(abs * 100)} pp`
    : `${sign}${new Intl.NumberFormat('es-BO', { style: 'percent', maximumFractionDigits: 1 }).format(abs)}`;
}

const measureNames = (cube: SummaryCube) => measuresOf(cube).map((item) => item.measure);
/** The cube's base count (first measure), non-empty wherever a row has data; used to rank rows. */
const baseMeasure = (cube: SummaryCube) => measuresOf(cube)[0].measure;

const settledRows = (cubes: SummaryCube[], results: PromiseSettledResult<DataRow[]>[]): CubeRows =>
  Object.fromEntries(cubes.map((cube, i) => [cube, results[i].status === 'fulfilled' ? results[i].value : []]));

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
  const [years, setYears] = useState<Member[]>([]);
  const [cubeYears, setCubeYears] = useState<Partial<Record<SummaryCube, Member[]>>>({});
  const [year, setYear] = useState('');
  const [yearPicked, setYearPicked] = useState(false);
  const [unit, setUnit] = useState('');
  const [units, setUnits] = useState<string[]>([]);
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
      const yearResults = await Promise.allSettled(SUMMARY_CUBES.map((cube) => yearMembers(cube)));
      // Gestiones of every cube: admissions and coursework do not cover the same years.
      const members = [
        ...new Map(
          yearResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])).map((m) => [m.caption, m]),
        ).values(),
      ].sort((a, b) => a.caption.localeCompare(b.caption, 'es', { numeric: true }));
      if (!members.length) throw new Error('No hay gestiones académicas publicadas.');
      const results = await Promise.allSettled(
        SUMMARY_CUBES.map((cube) =>
          queryCube(cube, measureNames(cube), [config.unitAxis, YEAR_AXIS[cube]], undefined, baseMeasure(cube)),
        ),
      );
      if (!active) return;
      if (results.every((result) => result.status === 'rejected')) throw (results[0] as PromiseRejectedResult).reason;
      const rows = settledRows(SUMMARY_CUBES, results);
      // A unit may lack data in one cube (e.g. no admissions), so list the union.
      const found = [...new Set(SUMMARY_CUBES.flatMap((cube) => facultiesIn(rows[cube] ?? [], config.unitAxis.level)))].sort(
        (a, b) => a.localeCompare(b, 'es'),
      );
      setFailed(SUMMARY_CUBES.filter((_, i) => results[i].status === 'rejected'));
      setYears(members);
      setCubeYears(
        Object.fromEntries(
          SUMMARY_CUBES.map((cube, i) => [cube, yearResults[i].status === 'fulfilled' ? yearResults[i].value : []]),
        ),
      );
      setUnits(found);
      setUnit((current) => (found.includes(current) ? current : found[0] ?? ''));
      setTrendRows(rows);
    })()
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : `No se pudo cargar el ${config.title.toLocaleLowerCase('es')}.`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt, config]);

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
          ? queryCube(cube, measureNames(cube), [config.unitAxis, detail.axis], member, baseMeasure(cube))
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

  const series = useMemo(() => {
    const merged = new Map<string, SummaryValues>();
    if (!trendRows || !unit) return merged;
    for (const cube of SUMMARY_CUBES) {
      for (const [label, values] of facultyYearSeries(trendRows[cube] ?? [], cube, unit, config.unitAxis.level, YEAR_AXIS[cube].level))
        merged.set(label, { ...merged.get(label), ...values });
    }
    return merged;
  }, [trendRows, unit, config]);

  const yearLabels = useMemo(
    () => [...series.keys()].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })),
    [series],
  );
  // Until the user picks one, show the latest gestión with data for the unit.
  useEffect(() => {
    if (!yearPicked && yearLabels.length) setYear(yearLabels.at(-1)!);
  }, [yearLabels, yearPicked]);

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

  const trendPoints = yearLabels.flatMap((label) => {
    const value = series.get(label)?.[trendKey];
    if (value == null) return [];
    return [{ label, value: measureOf(trendKey).format === 'percent' ? Math.round(value * 1000) / 10 : value }];
  });

  if (loading) return <Loader text={`Cargando el ${config.title.toLocaleLowerCase('es')}…`} fullScreen={false} />;
  if (error)
    return (
      <Card role="alert">
        <CardContent className="flex flex-wrap items-center gap-3 p-6">
          <span>{error}</span>
          <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{config.title}</h1>
          <p className="text-sm text-muted-foreground sm:text-base">{config.description(unit || config.unitLabel)}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {units.length > 1 ? (
            <label className="grid gap-1 text-sm font-medium">
              {config.unitLabel}
              <select
                className="min-h-10 rounded-md border border-input bg-background px-3"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
              >
                {units.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="grid gap-1 text-sm font-medium">
            Gestión académica
            <select
              className="min-h-10 rounded-md border border-input bg-background px-3"
              value={year}
              onChange={(event) => {
                setYearPicked(true);
                setYear(event.target.value);
              }}
            >
              {years.map((item) => (
                <option key={item.uniqueName} value={item.caption}>
                  {item.caption}
                </option>
              ))}
            </select>
          </label>
          <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            Actualizar datos
          </Button>
        </div>
      </header>

      {failed.length > 0 ? (
        <p role="status" className="text-sm text-muted-foreground">
          {`No se pudo consultar: ${failed.join(', ')}. El resto de indicadores sigue disponible.`}
        </p>
      ) : null}

      <section
        aria-label={`Indicadores de la ${config.unitLabel.toLocaleLowerCase('es')}`}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {KPIS.map((key) => {
          const delta = formatDelta(key, deltaOf(current[key], previous[key], measureOf(key).format));
          const spark = yearLabels.flatMap((label) => {
            const value = series.get(label)?.[key];
            return value == null ? [] : [{ label, value }];
          });
          return (
            <Card key={key}>
              <CardContent className="space-y-2 px-5 py-5">
                <p className="text-sm font-medium text-muted-foreground">{measureOf(key).label}</p>
                <p className="text-3xl font-semibold tabular-nums tracking-tight">{show(key, current[key])}</p>
                <p className="text-xs text-muted-foreground">
                  {current[key] == null
                    ? 'Sin dato para esta gestión'
                    : delta && prevLabel
                      ? `${delta} respecto a ${prevLabel}`
                      : `Gestión ${year}`}
                </p>
                {spark.length > 1 ? (
                  <AcademicSparkline
                    label={measureOf(key).label}
                    data={spark}
                    formatValue={(value) => show(key, value)}
                    className="h-8 w-full text-(--role-accent,var(--primary))"
                  />
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{`Evolución de la ${config.unitLabel.toLocaleLowerCase('es')}`}</CardTitle>
            <CardDescription>{`Valor de la ${config.unitLabel.toLocaleLowerCase('es')} en cada gestión.`}</CardDescription>
          </div>
          <div role="group" aria-label="Indicador de la evolución" className="flex flex-wrap gap-2">
            {TRENDS.map((key) => (
              <Button
                key={key}
                size="sm"
                variant={key === trendKey ? 'default' : 'outline'}
                aria-pressed={key === trendKey}
                onClick={() => setTrendKey(key)}
              >
                {measureOf(key).label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <TrendLineChart
            data={trendPoints}
            ariaLabel={`${measureOf(trendKey).label}${measureOf(trendKey).format === 'percent' ? ' (%)' : ''} de ${unit} por gestión`}
            height={280}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>{detail.title(year)}</CardTitle>
            <CardDescription>{detail.caption}</CardDescription>
          </div>
          <label className="grid gap-1 text-sm font-medium">
            Ordenar por
            <select
              className="min-h-10 rounded-md border border-input bg-background px-3"
              value={sortIndex}
              onChange={(event) => setSortIndex(Number(event.target.value))}
            >
              {detail.sorts.map((sort, index) => (
                <option key={sort.key} value={index}>
                  {sort.label}
                </option>
              ))}
            </select>
          </label>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {detailLoading ? (
            <Loader text="Cargando detalle…" fullScreen={false} />
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th scope="col" className="p-3 font-medium">{detail.header}</th>
                  {detail.columns.map((key) => (
                    <th key={key} scope="col" className="p-3 text-right font-medium">
                      {measureOf(key).label}
                    </th>
                  ))}
                  <th scope="col" className="p-3 font-medium">Atención</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border bg-muted/40 font-semibold">
                  <th scope="row" className="p-3">{detail.referenceLabel}</th>
                  {detail.columns.map((key) => (
                    <td key={key} className="p-3 text-right tabular-nums">{show(key, current[key])}</td>
                  ))}
                  <td className="p-3" />
                </tr>
                {details.map((row) => {
                  const flags = attentionFor(row.values, current, detail.rules);
                  return (
                    <tr key={row.career} className="border-t border-border">
                      <th scope="row" className="p-3 font-normal">{row.career}</th>
                      {detail.columns.map((key) => (
                        <td
                          key={key}
                          className={`p-3 text-right tabular-nums ${flags.some((flag) => flag.key === key) ? 'font-semibold text-destructive' : ''}`}
                        >
                          {show(key, row.values[key])}
                        </td>
                      ))}
                      <td className="p-3 text-xs">
                        {flags.length ? flags.map((flag) => flag.message).join(' · ') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!detailLoading && details.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{detail.empty}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
