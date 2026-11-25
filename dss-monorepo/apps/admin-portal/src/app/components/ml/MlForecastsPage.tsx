'use client';

import * as React from 'react';
import { Button, Loader } from '@dss-monorepo/design-system';
import { LineChart, Play, RefreshCw } from 'lucide-react';

import type { ModelCadence } from '../../data-access/ml-operations';
import {
  FORECAST_SERIES,
  getProgramForecast,
  listForecasts,
  submitForecastJob,
  type ForecastRun,
  type ForecastSeries,
} from '../../data-access/ml-studio';
import { dateTime, decimal, percent } from './model-charts';
import { ForecastChart } from './studio-charts';
import { ErrorAlert, JobProgress, Kpi, Notice, Panel, errorMessage, jobError, useJobPolling } from './studio-ui';

export const SERIES_LABELS: Record<ForecastSeries, string> = {
  APPLICATIONS_BY_PROGRAM: 'Postulaciones por carrera',
  ADMITTED_BY_PROGRAM: 'Admitidos por carrera',
  ENROLLED_BY_PROGRAM: 'Matriculados por carrera',
};

const MODEL_LABELS: Record<string, string> = {
  linear_trend: 'Tendencia lineal',
  linear_trend_lag: 'Tendencia lineal con rezago',
  seasonal_naive: 'Ingenuo estacional',
};

function isForecastSeries(value: string | null): value is ForecastSeries {
  return value !== null && (FORECAST_SERIES as readonly string[]).includes(value);
}

/**
 * Program forecasts (PRED-104/107): latest run per program, history and projection with 80/95 %
 * bands, the rolling-origin backtest of the chosen model, and a button to regenerate the series.
 */
export function MlForecastsPage() {
  const [series, setSeries] = React.useState<ForecastSeries>('APPLICATIONS_BY_PROGRAM');
  const [cadence, setCadence] = React.useState<ModelCadence>('SEMESTRAL');
  const [horizon, setHorizon] = React.useState(4);
  const [runs, setRuns] = React.useState<ForecastRun[] | null>(null);
  const [program, setProgram] = React.useState<string | null>(null);
  /** undefined while loading; null when the program has no forecast yet. */
  const [detail, setDetail] = React.useState<ForecastRun | null | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const { job, error: jobPollError } = useJobPolling(jobId);

  React.useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('series');
    if (isForecastSeries(requested)) setSeries(requested);
  }, []);

  const loadRuns = React.useCallback(async () => {
    setError(null);
    setRuns(null);
    try {
      const latest = await listForecasts(series, cadence);
      setRuns(latest);
      setProgram((current) => (current && latest.some((run) => run.program_ref === current) ? current : latest[0]?.program_ref ?? null));
    } catch (cause) {
      setRuns([]);
      setError(errorMessage(cause, 'No se pudo leer los pronósticos.'));
    }
  }, [series, cadence]);
  React.useEffect(() => void loadRuns(), [loadRuns]);

  React.useEffect(() => {
    if (job?.status === 'SUCCEEDED') void loadRuns();
  }, [job?.status, loadRuns]);

  React.useEffect(() => {
    let cancelled = false;
    setDetail(undefined);
    if (!program) return undefined;
    getProgramForecast(series, program, cadence)
      .then((run) => {
        if (!cancelled) setDetail(run);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setDetail(null);
        setError(errorMessage(cause, 'No se pudo leer el pronóstico de la carrera.'));
      });
    return () => {
      cancelled = true;
    };
  }, [series, cadence, program, runs]);

  async function generate() {
    setSubmitting(true);
    setError(null);
    try {
      const created = await submitForecastJob({ cadence, series_codes: [series], horizon });
      setJobId(created.job_id);
    } catch (cause) {
      setError(errorMessage(cause, 'No se pudo generar el pronóstico.'));
    } finally {
      setSubmitting(false);
    }
  }

  const backtest = detail?.backtest.selected;
  const running = job?.status === 'QUEUED' || job?.status === 'RUNNING';

  return (
    <section className="mx-auto w-full max-w-7xl space-y-7 p-5 sm:p-7" aria-labelledby="ml-forecasts-title">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-border pb-6">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <LineChart aria-hidden="true" className="size-4" /> DSS · aprendizaje automático
          </p>
          <h1 id="ml-forecasts-title" className="text-3xl font-semibold tracking-tight">Pronósticos</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Postulaciones, admitidos y matriculados por carrera, proyectados con regresión lineal sobre los periodos cerrados.
            El modelo de cada carrera se elige por backtest con origen móvil.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadRuns()}>
          <RefreshCw aria-hidden="true" className="mr-2 size-4" /> Actualizar
        </Button>
      </header>

      <div className="flex flex-wrap items-end gap-5">
        <label className="space-y-2 text-sm font-medium">
          Serie
          <select
            aria-label="Serie"
            value={series}
            onChange={(event) => setSeries(event.target.value as ForecastSeries)}
            className="h-10 min-w-60 rounded-md border border-input bg-background px-3"
          >
            {FORECAST_SERIES.map((item) => (
              <option key={item} value={item}>{SERIES_LABELS[item]}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          Cadencia
          <select
            aria-label="Cadencia"
            value={cadence}
            onChange={(event) => setCadence(event.target.value as ModelCadence)}
            className="h-10 min-w-40 rounded-md border border-input bg-background px-3"
          >
            <option value="SEMESTRAL">Semestral</option>
            <option value="ANUAL">Anual</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          Horizonte (periodos)
          <select
            aria-label="Horizonte"
            value={horizon}
            onChange={(event) => setHorizon(Number(event.target.value))}
            className="h-10 min-w-32 rounded-md border border-input bg-background px-3"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <Button onClick={() => void generate()} disabled={submitting || running}>
          <Play aria-hidden="true" className="mr-2 size-4" /> {running ? 'Generando…' : 'Generar pronóstico'}
        </Button>
      </div>

      {job && (
        <div className="space-y-2">
          <JobProgress job={job} />
          <ErrorAlert message={jobError(job)} />
        </div>
      )}
      <ErrorAlert message={error ?? jobPollError} />

      {runs === null && <Loader text="Cargando pronósticos…" fullScreen={false} className="py-16" />}
      {runs !== null && runs.length === 0 && !error && (
        <Notice>Aún no hay pronósticos de {SERIES_LABELS[series].toLowerCase()} ({cadence.toLowerCase()}). Usa «Generar pronóstico».</Notice>
      )}

      {runs !== null && runs.length > 0 && (
        <div className="grid gap-6 xl:grid-cols-[18rem_1fr]">
          <nav aria-label="Carreras" className="max-h-[36rem] overflow-y-auto rounded-xl border border-border bg-card">
            <ul className="divide-y divide-border">
              {runs.map((run) => (
                <li key={run.run_id}>
                  <button
                    type="button"
                    aria-pressed={run.program_ref === program}
                    onClick={() => setProgram(run.program_ref)}
                    className={`w-full px-4 py-3 text-left text-sm hover:bg-muted/40 ${run.program_ref === program ? 'bg-primary/5 font-semibold' : ''}`}
                  >
                    <span className="block">{run.program_ref}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {MODEL_LABELS[run.model_kind] ?? run.model_kind} · {run.history_points} periodos
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-6">
            {detail === undefined ? (
              <Loader text="Cargando la serie…" fullScreen={false} className="py-16" />
            ) : detail === null ? (
              <Notice>No hay pronóstico para {program}.</Notice>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Kpi label="Modelo" value={<span className="text-lg">{MODEL_LABELS[detail.model_kind] ?? detail.model_kind}</span>} hint={`Generado ${dateTime(detail.created_at)}`} />
                  <Kpi label="MAE backtest" value={decimal(backtest?.mae, 1)} hint={`${backtest?.origins ?? 0} orígenes · ${backtest?.evaluated_points ?? 0} puntos`} />
                  <Kpi label="MAPE backtest" value={percent(backtest?.mape)} />
                  <Kpi
                    label="Cobertura 80 %"
                    value={percent(backtest?.interval_coverage?.['0.8'])}
                    hint={`95 %: ${percent(backtest?.interval_coverage?.['0.95'])}`}
                  />
                </div>
                <Panel
                  title={`${SERIES_LABELS[series]} · ${detail.program_ref}`}
                  description="Línea continua: periodos cerrados. Línea discontinua: proyección. Sombras: bandas del 80 % y 95 % estimadas con los errores del backtest."
                >
                  <ForecastChart points={detail.points ?? []} cadence={detail.cadence} />
                </Panel>
                {(detail.backtest.candidates?.length ?? 0) > 1 && (
                  <Panel title="Modelos evaluados" description="Se elige el de menor MAE; ante un empate (1 %) gana el más simple.">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="py-2">Modelo</th>
                          <th className="py-2 text-right">MAE</th>
                          <th className="py-2 text-right">RMSE</th>
                          <th className="py-2 text-right">MAPE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {detail.backtest.candidates?.map((candidate) => (
                          <tr key={candidate.model} className={candidate.model === detail.model_kind ? 'font-semibold' : ''}>
                            <td className="py-2">{MODEL_LABELS[candidate.model] ?? candidate.model}</td>
                            <td className="py-2 text-right tabular-nums">{decimal(candidate.mae, 1)}</td>
                            <td className="py-2 text-right tabular-nums">{decimal(candidate.rmse, 1)}</td>
                            <td className="py-2 text-right tabular-nums">{percent(candidate.mape)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Panel>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
