'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
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
import { AcademicBarChart, TrendLineChart } from '@dss-monorepo/charts';
import { AcademicSparkline } from '../academic-sparkline';
import { useAcademicScope, useScopeYear } from './academic-scope';
import {
  YEAR_AXIS,
  assertViewerScope,
  type AcademicScopeKind,
  formatValue,
  queryCube,
  readLabel,
  readNumber,
  yearMembers,
  type CubeName,
  type DataRow,
  type Member,
} from './rendimiento-data';
import {
  CAREER_BREAKDOWN,
  FACULTY_BREAKDOWN,
  type RendimientoView,
  type ViewMeasure,
} from './rendimiento-views';
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
  return view.measures
    .filter((measure) => measure.source === cube)
    .map((measure) => measure.name);
}

/** Runs one query per source cube and merges the rows by their label. */
async function loadRows(
  view: RendimientoView,
  rowsFor: (cube: CubeName) => {
    axes: Parameters<typeof queryCube>[2];
    label: (row: DataRow) => string | null;
  },
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

/**
 * Change of one measure against the previous gestión. The views do not say
 * which direction is good, so the badge stays neutral: arrow and text only.
 */
function deltaFor(
  measure: ViewMeasure,
  current: number | null | undefined,
  previous: number | null | undefined,
  previousLabel: string | undefined,
): DeltaBadgeProps {
  let value: number | null = null;
  if (current != null && previous != null) {
    value =
      measure.format === 'percent'
        ? (current - previous) * 100
        : previous === 0
          ? null
          : ((current - previous) / previous) * 100;
  }
  return {
    value,
    unit: measure.format === 'percent' ? 'pp' : '%',
    goodWhen: 'none',
    comparisonLabel: previousLabel
      ? `respecto a ${previousLabel}`
      : 'frente a la gestión anterior',
  };
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
  const caption = `${view.title} por ${labelHeader.toLocaleLowerCase('es')}`;
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="overflow-x-auto rounded-xl border border-(--glass-border) focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"
    >
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-(--glass-track) text-xs text-muted-foreground">
            {rank ? (
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Orden
              </th>
            ) : null}
            <th scope="col" className="px-4 py-3 font-medium">
              {labelHeader}
            </th>
            {view.measures.map((measure) => (
              <th
                key={measure.name}
                scope="col"
                className="px-4 py-3 text-right font-medium"
              >
                {measure.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.label}
              className="border-t border-(--glass-border) transition-colors duration-(--dur-instant) hover:bg-role-accent/5"
            >
              {rank ? (
                <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </td>
              ) : null}
              <th scope="row" className="px-4 py-3 font-medium">
                {onSelect ? (
                  <button
                    type="button"
                    className="group/drill inline-flex items-center gap-1 rounded-md text-left text-foreground underline decoration-role-accent/40 underline-offset-4 transition-colors hover:text-role-accent hover:decoration-role-accent focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"
                    onClick={() => onSelect(row.label)}
                    aria-label={`Ver el detalle de ${row.label}`}
                  >
                    {row.label}
                    <ChevronRight
                      aria-hidden="true"
                      className="size-3.5 opacity-60 transition-transform duration-(--dur-fast) group-hover/drill:translate-x-0.5"
                    />
                  </button>
                ) : (
                  row.label
                )}
              </th>
              {view.measures.map((measure) => (
                <td
                  key={measure.name}
                  className="px-4 py-3 text-right tabular-nums"
                >
                  {formatValue(
                    row.values[measure.name] ?? null,
                    measure.format,
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type PanelScope = AcademicScopeKind;

const SCOPE_NOTE: Record<PanelScope, string | null> = {
  global: null,
  faculty: 'Datos limitados a las carreras de tu facultad.',
  career: 'Datos limitados a tu carrera.',
};

/** Root of the drill-down breadcrumb when the unit name is not known yet. */
const SCOPE_ROOT: Record<PanelScope, string> = {
  global: 'UATF',
  faculty: 'Tu facultad',
  career: 'Tu carrera',
};

/**
 * Analytics panel for one view. `scope` is the portal's academic scope: the
 * BFF filters every query to the user's faculty or career, and the panel
 * ranks careers directly instead of faculties outside the global scope.
 *
 * With `eyebrow` the panel renders the page header itself (title, description
 * and section); without it the hosting page keeps its own header.
 */
export function RendimientoViewPanel({
  view,
  scope = 'global',
  eyebrow,
}: {
  view: RendimientoView;
  scope?: PanelScope;
  eyebrow?: string;
}) {
  const [years, setYears] = useState<Partial<Record<CubeName, Member[]>>>({});
  const [trend, setTrend] = useState<Row[]>([]);
  // One gestión for the whole portal (header). This report offers the gestiones
  // it has data for and falls back to the latest one with its main measure.
  const trendLabels = useMemo(() => trend.map((row) => row.label), [trend]);
  const latestYear = useMemo(
    () =>
      trend.filter((row) => row.values[view.headline] != null).at(-1)?.label ??
      trend.at(-1)?.label ??
      '',
    [trend, view.headline],
  );
  const { year, setYear } = useScopeYear(trendLabels, latestYear);
  const breakdowns = useMemo(
    () =>
      (view.breakdowns ?? [FACULTY_BREAKDOWN]).map((option) =>
        scope !== 'global' && option.id === FACULTY_BREAKDOWN.id
          ? CAREER_BREAKDOWN
          : option,
      ),
    [view, scope],
  );
  const [breakdownId, setBreakdownId] = useState(breakdowns[0].id);
  const selected =
    breakdowns.find((option) => option.id === breakdownId) ?? breakdowns[0];
  const [parent, setParent] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<Row[]>([]);
  const [composition, setComposition] = useState<{
    parts: string[];
    rows: { label: string; parts: (number | null)[] }[];
  }>({ parts: [], rows: [] });
  const [loading, setLoading] = useState(true);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [error, setError] = useState('');
  // A failed breakdown only affects its own card, never the whole panel.
  const [breakdownError, setBreakdownError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [breakdownAttempt, setBreakdownAttempt] = useState(0);
  const {
    unit: scopeUnit,
    units: scopeUnits,
    shared: sharedScope,
  } = useAcademicScope();

  // A new gestión starts the drill-down again from the first level.
  useEffect(() => {
    setParent(null);
  }, [year]);

  const headline =
    view.measures.find((m) => m.name === view.headline) ?? view.measures[0];
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
      if (scope !== 'global') await assertViewerScope(scope);
      const entries = await Promise.all(
        sourcesOf(view).map(
          async (cube) => [cube, await yearMembers(cube)] as const,
        ),
      );
      const byCube = Object.fromEntries(entries) as Partial<
        Record<CubeName, Member[]>
      >;
      const rows = await loadRows(
        view,
        (cube) => ({
          axes: [YEAR_AXIS[cube]],
          label: (row) => readLabel(row, 'Gestión'),
        }),
        () => undefined,
      );
      rows.sort((a, b) =>
        a.label.localeCompare(b.label, 'es', { numeric: true }),
      );
      if (view.composition) {
        const { source, measure, axis } = view.composition;
        const data = await queryCube(
          source,
          [measure],
          [YEAR_AXIS[source], axis],
        );
        const parts = [
          ...new Set(data.map((row) => readLabel(row, axis.level))),
        ];
        const byYear = new Map<string, Map<string, number | null>>();
        for (const row of data) {
          const yearLabel = readLabel(row, 'Gestión');
          const values =
            byYear.get(yearLabel) ?? new Map<string, number | null>();
          values.set(readLabel(row, axis.level), readNumber(row, measure));
          byYear.set(yearLabel, values);
        }
        if (active)
          setComposition({
            parts,
            rows: [...byYear.entries()]
              .sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true }))
              .map(([label, values]) => ({
                label,
                parts: parts.map((part) => values.get(part) ?? null),
              })),
          });
      }
      if (!active) return;
      setYears(byCube);
      setTrend(rows);
    })()
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'No se pudo cargar el rendimiento.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [view, scope, attempt]);

  // Breakdown of the selected gestión by the chosen dimension, or its second level for one parent.
  useEffect(() => {
    if (!year || loading || error) return;
    let active = true;
    setBreakdownLoading(true);
    setBreakdownError('');
    loadRows(
      view,
      () =>
        parent && selected.second
          ? {
              axes: [selected.first, selected.second],
              label: (row) =>
                readLabel(row, selected.first.level) === parent
                  ? readLabel(row, selected.second!.level)
                  : null,
            }
          : {
              axes: [selected.first],
              label: (row) => readLabel(row, selected.first.level),
            },
      memberFor,
    )
      .then((rows) => {
        if (!active) return;
        rows.sort(
          (a, b) =>
            (b.values[view.headline] ?? -Infinity) -
            (a.values[view.headline] ?? -Infinity),
        );
        setBreakdown(rows);
      })
      .catch((reason: unknown) => {
        if (active)
          setBreakdownError(
            reason instanceof Error
              ? reason.message
              : 'No se pudo cargar el desglose.',
          );
      })
      .finally(() => {
        if (active) setBreakdownLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    view,
    year,
    parent,
    selected,
    loading,
    error,
    memberFor,
    breakdownAttempt,
  ]);

  // Drill-down focus: into the detail, focus "Volver"; back out, focus the heading.
  const backRef = useRef<HTMLButtonElement>(null);
  const breakdownHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousParent = useRef<string | null>(null);
  useEffect(() => {
    if (parent && !previousParent.current) backRef.current?.focus();
    if (!parent && previousParent.current) breakdownHeadingRef.current?.focus();
    previousParent.current = parent;
  }, [parent]);

  const yearIndex = trend.findIndex((row) => row.label === year);
  const yearRow = trend[yearIndex];
  const previousRow = yearIndex > 0 ? trend[yearIndex - 1] : undefined;
  const kpis = useMemo(
    () => view.measures.slice(0, view.kpiCount ?? 4),
    [view],
  );

  const asChartValue = useCallback(
    (value: number | null | undefined) =>
      value === null || value === undefined
        ? null
        : headline.format === 'percent'
          ? Number((value * 100).toFixed(1))
          : Number(value.toFixed(1)),
    [headline],
  );
  const trendPoints = useMemo(
    () =>
      trend
        .map((row) => ({
          label: row.label,
          value: asChartValue(row.values[view.headline]),
        }))
        .filter(
          (point): point is { label: string; value: number } =>
            point.value !== null,
        ),
    [trend, view.headline, asChartValue],
  );
  const breakdownPoints = useMemo(
    () =>
      breakdown
        .map((row) => ({
          label: row.label,
          value: asChartValue(row.values[view.headline]),
        }))
        .filter(
          (point): point is { label: string; value: number } =>
            point.value !== null,
        ),
    [breakdown, view.headline, asChartValue],
  );
  const sparklines = useMemo(
    () =>
      Object.fromEntries(
        kpis.map((measure) => [
          measure.name,
          trend.flatMap((row) => {
            const value = row.values[measure.name];
            return value == null ? [] : [{ label: row.label, value }];
          }),
        ]),
      ) as Record<string, { label: string; value: number }[]>,
    [kpis, trend],
  );

  const unit = headline.format === 'percent' ? ' (%)' : '';
  const firstSingular = selected.first.level.toLocaleLowerCase('es');
  const scopeLabel = parent
    ? `${selected.secondPlural ?? 'Detalle'} de ${parent}`
    : selected.firstPlural;
  // Reports cover every unit in scope, so name the root only when there is just one.
  const rootLabel =
    scopeUnits.length === 1 && scopeUnit
      ? scopeUnit
      : scope === 'career' && scopeUnits.length > 1
        ? 'Tus carreras'
        : scope === 'faculty' && scopeUnits.length > 1
          ? 'Tus facultades'
          : SCOPE_ROOT[scope];

  // First load shows skeletons; reloads keep the data on screen and dim it.
  const firstLoad = loading && trend.length === 0;
  const refreshing = loading && trend.length > 0;

  const pageRef = useRef<HTMLDivElement>(null);
  useReveal(pageRef, { when: !firstLoad && !error });

  const header = eyebrow ? (
    <PageHeader
      eyebrow={view.section ?? eyebrow}
      title={view.title}
      description={view.description}
      meta={
        sharedScope && SCOPE_NOTE[scope] ? (
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            {SCOPE_NOTE[scope]}
          </span>
        ) : year ? (
          `Gestión ${year}`
        ) : undefined
      }
    />
  ) : (
    <p className="max-w-3xl text-sm text-muted-foreground">
      {view.description}
    </p>
  );

  if (error && trend.length === 0)
    return (
      <PageContainer>
        {header}
        <StatusBanner
          title="No se pudieron cargar los indicadores"
          description={error}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      </PageContainer>
    );

  return (
    <div ref={pageRef}>
      <PageContainer>
        {header}

        {/* With a shared scope the gestión is chosen in the header. */}
        {sharedScope ? null : (
          <FilterBar
            label={`Filtros de ${view.title}`}
            aside={
              SCOPE_NOTE[scope] ? (
                <>
                  <ShieldCheck aria-hidden="true" />
                  {SCOPE_NOTE[scope]}
                </>
              ) : undefined
            }
          >
            <NativeSelect
              label="Gestión académica"
              value={year}
              disabled={firstLoad}
              onChange={(event) => setYear(event.currentTarget.value)}
              options={[...trendLabels].reverse().map((label) => ({
                value: label,
                label,
              }))}
            />
          </FilterBar>
        )}

        {error ? (
          <StatusBanner
            title="No se pudieron actualizar los indicadores"
            description={`${error} Se muestran los últimos datos cargados.`}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        ) : null}

        <section
          aria-label={
            year ? `Indicadores de la gestión ${year}` : 'Indicadores'
          }
          className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
        >
          {kpis.map((measure) => (
            <KpiCard
              key={measure.name}
              label={measure.label}
              value={yearRow?.values[measure.name] ?? null}
              format={(value) => formatValue(value, measure.format)}
              emptyLabel="Sin dato para esta gestión"
              loading={firstLoad}
              refreshing={refreshing}
              delta={
                yearRow?.values[measure.name] == null
                  ? undefined
                  : deltaFor(
                      measure,
                      yearRow?.values[measure.name],
                      previousRow?.values[measure.name],
                      previousRow?.label,
                    )
              }
              detail={measure.help}
              sparkline={
                sparklines[measure.name]?.length > 1 ? (
                  <AcademicSparkline
                    label={measure.label}
                    data={sparklines[measure.name]}
                    formatValue={(value) => formatValue(value, measure.format)}
                    className="h-7 w-24 text-role-accent"
                  />
                ) : undefined
              }
            />
          ))}
        </section>

        {view.slug === 'resumen' && (
          <ChartFrame
            title="Evolución por gestión"
            description={
              view.stack
                ? `Distribución porcentual de ${view.stack.map((p) => p.label.toLocaleLowerCase('es')).join(', ')} en cada gestión.`
                : `${headline.label}${unit} en cada gestión cargada.`
            }
            loading={firstLoad}
            refreshing={refreshing}
            height={300}
          >
            <div className="flex flex-col gap-6">
              {view.stack ? (
                <StackedShareChart
                  ariaLabel={`${view.title}: evolución por gestión`}
                  parts={view.stack.map((part) => part.label)}
                  rows={trend.map((row) => ({
                    label: row.label,
                    parts: view.stack!.map(
                      (part) => row.values[part.name] ?? null,
                    ),
                  }))}
                />
              ) : (
                <TrendLineChart
                  data={trendPoints}
                  ariaLabel={`${headline.label} por gestión`}
                  height={300}
                />
              )}
              <MeasureTable view={view} rows={trend} labelHeader="Gestión" />
            </div>
          </ChartFrame>
        )}

        {view.composition && composition.rows.length ? (
          <ChartFrame
            title={`Composición por ${view.composition.label.toLocaleLowerCase('es')}`}
            description={`Distribución porcentual de ${view.measures.find((m) => m.name === view.composition!.measure)?.label.toLocaleLowerCase('es') ?? view.composition.measure.toLocaleLowerCase('es')} por ${view.composition.label.toLocaleLowerCase('es')} en cada gestión.`}
            refreshing={refreshing}
          >
            <StackedShareChart
              ariaLabel={`${view.title}: composición por ${view.composition.label.toLocaleLowerCase('es')}`}
              parts={composition.parts}
              rows={composition.rows}
            />
          </ChartFrame>
        ) : null}

        <Card data-reveal className="gap-5 px-5 py-5 sm:px-6">
          <RefreshIndicator
            active={breakdownLoading && breakdown.length > 0}
            label="Actualizando el desglose…"
          />
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <h2
                ref={breakdownHeadingRef}
                tabIndex={-1}
                className="font-heading text-base font-semibold tracking-tight outline-none"
              >
                {year ? `${scopeLabel}, gestión ${year}` : scopeLabel}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {parent
                  ? `Ranking por ${headline.label}.`
                  : selected.second
                    ? `Ranking por ${headline.label}. Elige un elemento de la tabla para ver su detalle (${(selected.secondPlural ?? '').toLocaleLowerCase('es')}).`
                    : `Ranking por ${headline.label}.`}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              {breakdowns.length > 1 ? (
                <NativeSelect
                  label="Desglosar por"
                  value={selected.id}
                  onChange={(event) => {
                    setBreakdownId(event.currentTarget.value);
                    setParent(null);
                  }}
                  options={breakdowns.map((option) => ({
                    value: option.id,
                    label: option.label,
                  }))}
                />
              ) : null}
              {parent ? (
                <Button
                  ref={backRef}
                  variant="outline"
                  className="h-10 animate-ds-fade"
                  iconLeft={<ArrowLeft aria-hidden="true" />}
                  onClick={() => setParent(null)}
                >
                  {`Volver a ${selected.firstPlural.toLocaleLowerCase('es')}`}
                </Button>
              ) : null}
            </div>
          </div>

          <nav aria-label="Nivel de desglose">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <li>
                {parent ? (
                  <button
                    type="button"
                    className="rounded-md underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"
                    onClick={() => setParent(null)}
                  >
                    {rootLabel}
                  </button>
                ) : (
                  <span
                    aria-current="page"
                    className="font-medium text-foreground"
                  >
                    {rootLabel}
                  </span>
                )}
              </li>
              {parent ? (
                <>
                  <li aria-hidden="true">
                    <ChevronRight className="size-3.5" />
                  </li>
                  <li
                    aria-current="page"
                    className="font-medium text-foreground"
                  >
                    {parent}
                  </li>
                </>
              ) : null}
            </ol>
          </nav>

          {breakdownError ? (
            <StatusBanner
              title="No se pudo cargar el desglose"
              description={`${breakdownError} Los indicadores de arriba siguen disponibles.`}
              onRetry={() => setBreakdownAttempt((n) => n + 1)}
            />
          ) : (firstLoad || breakdownLoading) && breakdown.length === 0 ? (
            <div aria-hidden="true" className="flex flex-col gap-3">
              <Skeleton className="h-64 w-full rounded-xl" />
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-9 w-full rounded-lg" />
              ))}
            </div>
          ) : breakdown.length === 0 ? (
            <EmptyState
              title="No hay datos para esta selección"
              description="Elige otra gestión u otra forma de desglose."
              size="compact"
            />
          ) : (
            <div
              key={`${selected.id}-${parent ?? 'root'}`}
              className={`flex animate-ds-fade flex-col gap-6 transition-opacity duration-(--dur-base) ${breakdownLoading ? 'pointer-events-none opacity-60' : ''}`}
            >
              {view.stack ? (
                <StackedShareChart
                  horizontal
                  ariaLabel={`${view.title}: ${scopeLabel.toLocaleLowerCase('es')} en ${year}`}
                  parts={view.stack.map((part) => part.label)}
                  rows={breakdown.map((row) => ({
                    label: row.label,
                    parts: view.stack!.map(
                      (part) => row.values[part.name] ?? null,
                    ),
                  }))}
                />
              ) : (
                <AcademicBarChart
                  data={breakdownPoints}
                  ariaLabel={`${headline.label}${unit} por ${parent && selected.second ? selected.second.level.toLocaleLowerCase('es') : firstSingular}`}
                  height={340}
                />
              )}
              <MeasureTable
                view={view}
                rows={breakdown}
                labelHeader={
                  parent && selected.second
                    ? selected.second.level
                    : selected.first.level
                }
                rank
                onSelect={
                  parent || !selected.second
                    ? undefined
                    : (label) => setParent(label)
                }
              />
            </div>
          )}
        </Card>

        <details
          data-reveal
          className="group/glossary glass-surface rounded-2xl border border-(--glass-border) shadow-glass"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 font-heading text-base font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/35 sm:px-6 [&::-webkit-details-marker]:hidden">
            Cómo leer estos indicadores
            <ChevronDown
              aria-hidden="true"
              className="size-4 text-muted-foreground transition-transform duration-(--dur-base) group-open/glossary:rotate-180"
            />
          </summary>
          <div className="border-t border-(--glass-border) px-5 py-5 sm:px-6">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
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
          </div>
        </details>
        <p className="text-xs text-muted-foreground">
          {view.sourceNote ??
            'Fuente: DW institucional (cubos «Rendimiento académico» y «Rendimiento estudiantil»), con las definiciones del Boletín 3 de la DSA.'}{' '}
          Las celdas con menos de 5 personas se ocultan por privacidad.
        </p>
      </PageContainer>
    </div>
  );
}
