'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Loader,
} from '@dss-monorepo/design-system';
import { AcademicBarChart, TrendLineChart } from '@dss-monorepo/charts';
import {
  CAREER_AXIS,
  FACULTY_AXIS,
  YEAR_AXIS,
  formatValue,
  queryCube,
  readLabel,
  readNumber,
  yearMembers,
  type CubeName,
  type DataRow,
  type Member,
} from './rendimiento-data';
import type { RendimientoView, ViewMeasure } from './rendimiento-views';
import { StackedShareChart } from './stacked-share-chart';

type Values = Record<string, number | null>;
interface Row {
  label: string;
  values: Values;
}

function sourcesOf(view: RendimientoView): CubeName[] {
  return [...new Set(view.measures.map((measure) => measure.source))];
}

function measuresOf(view: RendimientoView, cube: CubeName): string[] {
  return view.measures.filter((measure) => measure.source === cube).map((measure) => measure.name);
}

/** Runs one query per source cube and merges the rows by their label. */
async function loadRows(
  view: RendimientoView,
  rowsFor: (cube: CubeName) => { axes: Parameters<typeof queryCube>[2]; label: (row: DataRow) => string | null },
  yearFor: (cube: CubeName) => Member | undefined,
): Promise<Row[]> {
  const merged = new Map<string, Values>();
  await Promise.all(
    sourcesOf(view).map(async (cube) => {
      const names = measuresOf(view, cube);
      const { axes, label } = rowsFor(cube);
      const data = await queryCube(cube, names, axes, yearFor(cube));
      for (const row of data) {
        const key = label(row);
        if (key === null) continue;
        const values = merged.get(key) ?? {};
        for (const name of names) values[name] = readNumber(row, name);
        merged.set(key, values);
      }
    }),
  );
  return [...merged.entries()].map(([label, values]) => ({ label, values }));
}

function MeasureTable({
  view,
  rows,
  labelHeader,
  rank,
  onSelect,
}: {
  view: RendimientoView;
  rows: Row[];
  labelHeader: string;
  rank?: boolean;
  onSelect?: (label: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <caption className="sr-only">{`${view.title} por ${labelHeader.toLocaleLowerCase('es')}`}</caption>
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            {rank ? <th className="p-3 text-right">Orden</th> : null}
            <th className="p-3">{labelHeader}</th>
            {view.measures.map((measure) => (
              <th key={measure.name} className="p-3 text-right">
                {measure.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.label} className="border-b border-border/60 last:border-0">
              {rank ? <td className="p-3 text-right tabular-nums text-muted-foreground">{index + 1}</td> : null}
              <td className="p-3 font-medium">
                {onSelect ? (
                  <button
                    type="button"
                    className="text-left text-primary underline-offset-4 hover:underline"
                    onClick={() => onSelect(row.label)}
                    title={`Ver carreras de ${row.label}`}
                  >
                    {row.label}
                  </button>
                ) : (
                  row.label
                )}
              </td>
              {view.measures.map((measure) => (
                <td key={measure.name} className="p-3 text-right tabular-nums">
                  {formatValue(row.values[measure.name] ?? null, measure.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Kpi({ measure, value }: { measure: ViewMeasure; value: number | null }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{measure.label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{formatValue(value, measure.format)}</CardTitle>
      </CardHeader>
      {measure.help ? <CardContent className="text-xs text-muted-foreground">{measure.help}</CardContent> : null}
    </Card>
  );
}

export function RendimientoViewPanel({ view }: { view: RendimientoView }) {
  const [years, setYears] = useState<Partial<Record<CubeName, Member[]>>>({});
  const [year, setYear] = useState('');
  const [trend, setTrend] = useState<Row[]>([]);
  const [faculty, setFaculty] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const headline = view.measures.find((m) => m.name === view.headline) ?? view.measures[0];
  const memberFor = useCallback(
    (cube: CubeName) => years[cube]?.find((member) => member.caption === year),
    [years, year],
  );

  // Years and the evolution by gestión.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    (async () => {
      const entries = await Promise.all(sourcesOf(view).map(async (cube) => [cube, await yearMembers(cube)] as const));
      const byCube = Object.fromEntries(entries) as Partial<Record<CubeName, Member[]>>;
      const rows = await loadRows(
        view,
        (cube) => ({ axes: [YEAR_AXIS[cube]], label: (row) => readLabel(row, 'Gestión') }),
        () => undefined,
      );
      rows.sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true }));
      if (!active) return;
      setYears(byCube);
      setTrend(rows);
      const withHeadline = rows.filter((row) => row.values[view.headline] !== null && row.values[view.headline] !== undefined);
      setYear((current) => current || withHeadline.at(-1)?.label || rows.at(-1)?.label || '');
    })()
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el rendimiento.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [view, attempt]);

  // Breakdown of the selected gestión: faculties, or careers of one faculty.
  useEffect(() => {
    if (!year || loading || error) return;
    let active = true;
    setBreakdownLoading(true);
    loadRows(
      view,
      () =>
        faculty
          ? {
              axes: [FACULTY_AXIS, CAREER_AXIS],
              label: (row) => (readLabel(row, 'Facultad') === faculty ? readLabel(row, 'Carrera') : null),
            }
          : { axes: [FACULTY_AXIS], label: (row) => readLabel(row, 'Facultad') },
      memberFor,
    )
      .then((rows) => {
        if (!active) return;
        rows.sort((a, b) => (b.values[view.headline] ?? -Infinity) - (a.values[view.headline] ?? -Infinity));
        setBreakdown(rows);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el desglose.');
      })
      .finally(() => {
        if (active) setBreakdownLoading(false);
      });
    return () => {
      active = false;
    };
  }, [view, year, faculty, loading, error, memberFor]);

  const yearRow = useMemo(() => trend.find((row) => row.label === year), [trend, year]);
  const kpis = view.measures.slice(0, view.kpiCount ?? 4);
  const asChartValue = (value: number | null | undefined) =>
    value === null || value === undefined ? null : headline.format === 'percent' ? Number((value * 100).toFixed(1)) : Number(value.toFixed(1));
  const trendPoints = trend
    .map((row) => ({ label: row.label, value: asChartValue(row.values[view.headline]) }))
    .filter((point): point is { label: string; value: number } => point.value !== null);
  const breakdownPoints = breakdown
    .map((row) => ({ label: row.label, value: asChartValue(row.values[view.headline]) }))
    .filter((point): point is { label: string; value: number } => point.value !== null);
  const unit = headline.format === 'percent' ? ' (%)' : '';
  const scopeLabel = faculty ? `Carreras de ${faculty}` : 'Facultades';

  if (loading) return <Loader text="Cargando indicadores de rendimiento…" fullScreen={false} />;
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-3xl text-muted-foreground">{view.description}</p>
        <label className="grid gap-1 text-sm font-medium">
          Gestión académica
          <select
            className="min-h-10 rounded-md border border-input bg-background px-3"
            value={year}
            onChange={(event) => {
              setYear(event.target.value);
              setFaculty(null);
            }}
          >
            {trend.map((row) => (
              <option key={row.label} value={row.label}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section aria-label={`Indicadores de la gestión ${year}`} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((measure) => (
          <Kpi key={measure.name} measure={measure} value={yearRow?.values[measure.name] ?? null} />
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Evolución por gestión</CardTitle>
          <CardDescription>
            {view.stack
              ? `Distribución porcentual de ${view.stack.map((p) => p.label.toLocaleLowerCase('es')).join(', ')} en cada gestión.`
              : `${headline.label}${unit} en cada gestión cargada.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {view.stack ? (
            <StackedShareChart
              ariaLabel={`${view.title}: evolución por gestión`}
              parts={view.stack.map((part) => part.label)}
              rows={trend.map((row) => ({ label: row.label, parts: view.stack!.map((part) => row.values[part.name] ?? null) }))}
            />
          ) : (
            <TrendLineChart data={trendPoints} ariaLabel={`${headline.label} por gestión`} height={300} />
          )}
          <MeasureTable view={view} rows={trend} labelHeader="Gestión" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle>{`${scopeLabel}, gestión ${year}`}</CardTitle>
            <CardDescription>
              {faculty
                ? `Ranking de las carreras de la facultad por ${headline.label}.`
                : `Ranking de facultades por ${headline.label}. Elige una facultad para ver sus carreras.`}
            </CardDescription>
          </div>
          {faculty ? (
            <Button variant="outline" onClick={() => setFaculty(null)}>
              Volver a todas las facultades
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          <nav aria-label="Nivel de desglose" className="text-sm text-muted-foreground">
            <button type="button" className="hover:underline" onClick={() => setFaculty(null)}>
              UATF
            </button>
            {faculty ? <span>{` / ${faculty}`}</span> : null}
          </nav>
          {breakdownLoading ? (
            <Loader text="Cargando desglose…" fullScreen={false} />
          ) : breakdown.length === 0 ? (
            <p className="text-muted-foreground">No hay datos para esta selección.</p>
          ) : (
            <>
              {view.stack ? (
                <StackedShareChart
                  horizontal
                  ariaLabel={`${view.title}: ${scopeLabel.toLocaleLowerCase('es')} en ${year}`}
                  parts={view.stack.map((part) => part.label)}
                  rows={breakdown.map((row) => ({ label: row.label, parts: view.stack!.map((part) => row.values[part.name] ?? null) }))}
                />
              ) : (
                <AcademicBarChart data={breakdownPoints} ariaLabel={`${headline.label}${unit} por ${faculty ? 'carrera' : 'facultad'}`} height={340} />
              )}
              <MeasureTable
                view={view}
                rows={breakdown}
                labelHeader={faculty ? 'Carrera' : 'Facultad'}
                rank
                onSelect={faculty ? undefined : (label) => setFaculty(label)}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cómo leer estos indicadores</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm">
            {view.measures
              .filter((measure) => measure.help)
              .map((measure) => (
                <div key={measure.name}>
                  <dt className="font-medium">{measure.label}</dt>
                  <dd className="text-muted-foreground">{measure.help}</dd>
                </div>
              ))}
          </dl>
          {view.notes?.length ? (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {view.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-4 text-xs text-muted-foreground">
            Fuente: DW institucional (cubos «Rendimiento académico» y «Rendimiento estudiantil»), con las definiciones del Boletín 3 de la DSA. Las celdas con menos de 5 estudiantes se ocultan por privacidad.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
