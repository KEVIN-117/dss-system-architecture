'use client';

import { useEffect, useMemo, useState } from 'react';
import { Play, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '@dss-monorepo/auth';
import { ForecastBandChart, ForecastStackedChart, forecastPeriodLabel, type StackedForecastSeries } from '@dss-monorepo/charts';
import {
  ChartFrame,
  EmptyState,
  FilterBar,
  KpiCard,
  NativeSelect,
  PageContainer,
  PageHeader,
  StatusBanner,
} from '@dss-monorepo/design-system/page';

import type { AcademicScopeKind } from '../panel/rendimiento-data';
import {
  FORECAST_SERIES,
  ForecastRequestError,
  forecastHighlights,
  getForecastJob,
  getProgramCatalog,
  getProgramForecast,
  listProgramForecasts,
  submitForecastJob,
  type ForecastCadence,
  type ForecastJobStatus,
  type ForecastSeriesCode,
  type ProgramForecast,
} from './forecast-data';

const integer = (value: number) => new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(value);
const decimal = (value: number) => new Intl.NumberFormat('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
const percent = (value: number) => `${new Intl.NumberFormat('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value * 100)} %`;
const HORIZONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const SCOPE_NOTE: Record<AcademicScopeKind, string | null> = {
  global: null,
  faculty: 'Solo ves los programas de tu facultad.',
  career: 'Solo ves tu carrera.',
};

/** Model kinds chosen by Prediction Service backtesting (forecasting/models.py MODEL_KINDS). */
const MODEL_LABEL: Record<string, string> = {
  linear_trend: 'Tendencia lineal',
  linear_trend_lag: 'Tendencia lineal con rezago',
  seasonal_naive: 'Estacional ingenuo',
};

function errorText(error: unknown, fallback: string): string {
  return error instanceof ForecastRequestError ? error.message : fallback;
}

/**
 * Applications and enrolled-students forecasts of the programs in the caller's academic scope,
 * shared by the rector, decano and director portals (PRED-108). Prediction Service filters the
 * programs; ``scope`` only adapts the wording.
 */
export function ForecastPanel({ scope = 'global' }: { scope?: AcademicScopeKind }) {
  const { hasPermission } = useAuth();
  const canGenerate = hasPermission('prediction:publish') || hasPermission('prediction:train');
  const [series, setSeries] = useState<ForecastSeriesCode>('APPLICATIONS_BY_PROGRAM');
  const [cadence, setCadence] = useState<ForecastCadence>('SEMESTRAL');
  const [horizon, setHorizon] = useState<number>(4);
  const [programs, setPrograms] = useState<ProgramForecast[] | null>(null);
  const [programRef, setProgramRef] = useState('');
  const [facultyFilter, setFacultyFilter] = useState<string>('ALL');
  const [detail, setDetail] = useState<ProgramForecast | null>(null);
  const [stackedSeries, setStackedSeries] = useState<StackedForecastSeries[]>([]);
  const [stackedLoading, setStackedLoading] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [faculties, setFaculties] = useState<Record<string, number>>({});
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<ForecastJobStatus | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [detailAttempt, setDetailAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getProgramCatalog(controller.signal)
      .then((catalog) => {
        setNames(catalog.names);
        setFaculties(catalog.faculties);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setPrograms(null);
    setListError(null);
    listProgramForecasts(series, cadence, controller.signal)
      .then((runs) => {
        setPrograms(runs);
        setProgramRef((current) =>
          runs.some((run) => run.program_ref === current) ? current : runs[0]?.program_ref ?? '',
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setPrograms([]);
        setListError(errorText(error, 'No se pudieron cargar los pronósticos.'));
      });
    return () => controller.abort();
  }, [series, cadence, attempt]);

  useEffect(() => {
    if (!programRef) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError(null);
    getProgramForecast(series, programRef, cadence, controller.signal)
      .then(setDetail)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setDetail(null);
        setDetailError(errorText(error, 'No se pudo cargar el pronóstico del programa.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [series, programRef, cadence, detailAttempt]);

  useEffect(() => {
    if (!job || (job.status !== 'QUEUED' && job.status !== 'RUNNING')) return undefined;
    const timer = window.setInterval(() => {
      getForecastJob(job.job_id)
        .then((next) => {
          setJob(next);
          if (next.status === 'SUCCEEDED') {
            setAttempt((n) => n + 1);
            setDetailAttempt((n) => n + 1);
          } else if (next.status === 'FAILED') {
            setJobError(next.error?.detail ?? 'No se pudo generar el pronóstico.');
          }
        })
        .catch((error: unknown) => {
          setJobError(errorText(error, 'No se pudo consultar el estado del pronóstico.'));
        });
    }, 2000);
    return () => window.clearInterval(timer);
  }, [job]);

  async function handleGenerate() {
    setSubmitting(true);
    setJobError(null);
    try {
      const created = await submitForecastJob({ cadence, series_codes: [series], horizon });
      setJob(created);
    } catch (error: unknown) {
      setJobError(errorText(error, 'No se pudo iniciar el pronóstico.'));
    } finally {
      setSubmitting(false);
    }
  }

  const facultyIds = useMemo(() => {
    const set = new Set<number>();
    for (const run of programs ?? []) {
      const fac = faculties[run.program_ref];
      if (typeof fac === 'number') set.add(fac);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [programs, faculties]);

  const filteredPrograms = useMemo(() => {
    const list = programs ?? [];
    if (scope !== 'global' || facultyFilter === 'ALL') return list;
    const targetFaculty = Number(facultyFilter);
    return list.filter((run) => faculties[run.program_ref] === targetFaculty);
  }, [programs, scope, facultyFilter, faculties]);

  useEffect(() => {
    if (!filteredPrograms.length) return;
    if (!filteredPrograms.some((run) => run.program_ref === programRef)) {
      setProgramRef(filteredPrograms[0].program_ref);
    }
  }, [filteredPrograms, programRef]);

  useEffect(() => {
    if (!filteredPrograms.length) {
      setStackedSeries([]);
      return;
    }
    const controller = new AbortController();
    setStackedLoading(true);
    Promise.all(
      filteredPrograms.map((run) =>
        getProgramForecast(series, run.program_ref, cadence, controller.signal)
          .then((full) => ({
            programRef: run.program_ref,
            label: names[run.program_ref] ? `${names[run.program_ref]} (${run.program_ref})` : run.program_ref,
            points: full.points ?? [],
          }))
          .catch(() => null),
      ),
    )
      .then((results) => {
        if (!controller.signal.aborted) {
          setStackedSeries(results.filter((item): item is StackedForecastSeries => item !== null && item.points.length > 0));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setStackedLoading(false);
      });
    return () => controller.abort();
  }, [filteredPrograms, series, cadence, names, detailAttempt]);

  const seriesInfo = FORECAST_SERIES.find((item) => item.code === series) ?? FORECAST_SERIES[0];
  const programName = (ref: string) => (names[ref] ? `${names[ref]} (${ref})` : ref);
  const points = useMemo(() => detail?.points ?? [], [detail]);
  const { lastObserved, nextProjected } = forecastHighlights(points);
  const band80 = nextProjected?.interval?.['0.8'];
  const backtest = detail?.backtest?.selected;
  const scopeNote = SCOPE_NOTE[scope];
  const jobRunning = job?.status === 'QUEUED' || job?.status === 'RUNNING';

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Pronósticos"
        title="Pronóstico de postulaciones y matriculados"
        description="Proyección por programa a partir de los periodos cerrados del almacén de datos, con bandas de predicción del 80 % y 95 %."
      />

      <FilterBar
        label="Filtros del pronóstico"
        aside={
          scopeNote ? (
            <>
              <ShieldCheck aria-hidden="true" />
              {scopeNote}
            </>
          ) : undefined
        }
      >
        <NativeSelect
          label="Serie"
          value={series}
          onChange={(event) => setSeries(event.currentTarget.value as ForecastSeriesCode)}
          options={FORECAST_SERIES.map((item) => ({ value: item.code, label: item.label }))}
        />
        <NativeSelect
          label="Cadencia"
          value={cadence}
          onChange={(event) => setCadence(event.currentTarget.value as ForecastCadence)}
          options={[
            { value: 'ANUAL', label: 'Anual' },
            { value: 'SEMESTRAL', label: 'Semestral' },
          ]}
        />
        {scope === 'global' && facultyIds.length > 1 ? (
          <NativeSelect
            label="Facultad"
            value={facultyFilter}
            onChange={(event) => setFacultyFilter(event.currentTarget.value)}
            options={[
              { value: 'ALL', label: 'Todas las facultades' },
              ...facultyIds.map((id) => ({ value: String(id), label: `Facultad ${id}` })),
            ]}
          />
        ) : null}
        <NativeSelect
          label="Programa"
          value={programRef}
          disabled={!filteredPrograms.length}
          onChange={(event) => setProgramRef(event.currentTarget.value)}
          options={filteredPrograms.map((run) => ({ value: run.program_ref, label: programName(run.program_ref) }))}
        />
        {canGenerate ? (
          <>
            <NativeSelect
              label="Horizonte"
              value={String(horizon)}
              onChange={(event) => setHorizon(Number(event.currentTarget.value))}
              options={HORIZONS.map((n) => ({ value: String(n), label: `${n} periodos` }))}
            />
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={submitting || jobRunning}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {jobRunning ? <RefreshCw aria-hidden="true" className="size-4 animate-spin" /> : <Play aria-hidden="true" className="size-4" />}
              {jobRunning ? 'Generando…' : 'Generar pronóstico'}
            </button>
          </>
        ) : null}
      </FilterBar>

      {jobError ? (
        <StatusBanner title="Error al generar el pronóstico" description={jobError} />
      ) : null}

      {job && job.status === 'SUCCEEDED' ? (
        <p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">
          Pronóstico actualizado para {seriesInfo.label.toLowerCase()} ({cadence.toLowerCase()}, horizonte {horizon}).
        </p>
      ) : null}

      {listError ? (
        <StatusBanner title="No se pudieron cargar los pronósticos" description={listError} onRetry={() => setAttempt((n) => n + 1)} />
      ) : null}

      {programs !== null && programs.length === 0 && !listError ? (
        <EmptyState
          title={`No hay pronósticos de ${seriesInfo.noun} para tu alcance`}
          description="Los pronósticos se generan desde el portal de administración. Cuando exista uno para tus programas aparecerá aquí."
        />
      ) : null}

      {filteredPrograms.length > 0 ? (
        <ChartFrame
          title={`Comparativa apilada de ${seriesInfo.noun} por carrera`}
          description="Líneas apiladas con la evolución histórica y la proyección de todas las carreras visibles en tu alcance."
          loading={stackedLoading}
          empty={!stackedLoading && stackedSeries.length === 0 ? { title: 'Sin datos para graficar' } : undefined}
        >
          <ForecastStackedChart seriesList={stackedSeries} cadence={cadence} />
        </ChartFrame>
      ) : null}

      {programRef ? (
        <>
          <section aria-label="Indicadores del pronóstico" className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <KpiCard
              label={`Último periodo observado${lastObserved ? ` (${forecastPeriodLabel(lastObserved, cadence)})` : ''}`}
              value={lastObserved?.value}
              format={integer}
              loading={detailLoading}
            />
            <KpiCard
              label={`Proyección${nextProjected ? ` ${forecastPeriodLabel(nextProjected, cadence)}` : ''}`}
              value={nextProjected?.value}
              format={integer}
              loading={detailLoading}
              detail={band80 ? `Banda 80 %: ${integer(band80.lower)} – ${integer(band80.upper)}` : undefined}
            />
            <KpiCard
              label="Periodos proyectados"
              value={points.filter((point) => point.kind === 'FORECAST').length || null}
              format={integer}
              loading={detailLoading}
              detail={detail ? `Modelo: ${MODEL_LABEL[detail.model_kind] ?? detail.model_kind}` : undefined}
            />
          </section>

          <ChartFrame
            title={`${seriesInfo.label} de ${programName(programRef)}`}
            description="Línea continua: histórico. Línea discontinua: proyección. Las bandas muestran el rango probable."
            loading={detailLoading}
            error={detailError ? { message: detailError, onRetry: () => setDetailAttempt((n) => n + 1) } : undefined}
            empty={!detailLoading && !detailError && points.length === 0 ? { title: 'Sin datos para graficar' } : undefined}
          >
            <ForecastBandChart points={points} cadence={cadence} />
          </ChartFrame>

          {backtest ? (
            <section aria-label="Evaluación retrospectiva" className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card/50 p-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">MAE (backtest)</p>
                <p className="font-semibold">{backtest.mae != null ? decimal(backtest.mae) : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">RMSE (backtest)</p>
                <p className="font-semibold">{backtest.rmse != null ? decimal(backtest.rmse) : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">MAPE</p>
                <p className="font-semibold">{backtest.mape != null ? percent(backtest.mape) : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cortes evaluados</p>
                <p className="font-semibold">{backtest.folds != null ? integer(backtest.folds) : '—'}</p>
              </div>
            </section>
          ) : null}

          <p className="text-xs leading-5 text-muted-foreground">
            Un pronóstico es una estimación estadística basada en los periodos cerrados; no considera cambios de
            oferta, cupos ni normativa que aún no se reflejen en los datos.
            {detail ? ` Generado el ${new Date(detail.created_at).toLocaleString('es-BO')}.` : ''}
          </p>
        </>
      ) : null}
    </PageContainer>
  );
}
