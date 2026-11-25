/** Program forecasts for the academic dashboards (PRED-108), read through the BFF prediction facade. */
import type { ForecastBandPoint } from '@dss-monorepo/charts';

/** Series shown to academic authorities: applications, admitted and enrolled students per program. */
export type ForecastSeriesCode = 'APPLICATIONS_BY_PROGRAM' | 'ADMITTED_BY_PROGRAM' | 'ENROLLED_BY_PROGRAM';
export type ForecastCadence = 'ANUAL' | 'SEMESTRAL';

export const FORECAST_SERIES: { code: ForecastSeriesCode; label: string; noun: string }[] = [
  { code: 'APPLICATIONS_BY_PROGRAM', label: 'Postulaciones', noun: 'postulaciones' },
  { code: 'ADMITTED_BY_PROGRAM', label: 'Admitidos', noun: 'admitidos' },
  { code: 'ENROLLED_BY_PROGRAM', label: 'Matriculados', noun: 'matriculados' },
];

export interface ForecastBacktestSummary {
  model?: string;
  mae?: number | null;
  rmse?: number | null;
  mape?: number | null;
  folds?: number | null;
}

/** Latest forecast of one program; the listing omits ``points``. */
export interface ProgramForecast {
  run_id: string;
  series_code: string;
  program_ref: string;
  cadence: ForecastCadence;
  horizon: number;
  model_kind: string;
  history_points: number;
  created_at: string;
  backtest?: { selected?: ForecastBacktestSummary | null } | null;
  points?: ForecastBandPoint[];
}

export interface ForecastJobStatus {
  job_id: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  error?: { detail?: string; title?: string; code?: string } | null;
  result_ref?: string | null;
}

export class ForecastRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ForecastRequestError';
  }
}

function bffUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BFF_URL?.replace(/\/$/, '');
  if (!base) throw new ForecastRequestError('No se ha configurado la conexión del portal.', 0);
  return `${base}/api/prediction/${path}`;
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(bffUrl(path), { credentials: 'include', cache: 'no-store', signal });
  } catch (error) {
    if (error instanceof ForecastRequestError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ForecastRequestError('No se pudo conectar con el servicio de pronósticos.', 0);
  }
  if (!response.ok) {
    const message =
      response.status === 403
        ? 'El programa está fuera de tu alcance académico o tu cuenta no puede leer pronósticos.'
        : response.status === 404
          ? 'Aún no hay un pronóstico generado para este programa.'
          : 'No se pudieron cargar los pronósticos.';
    throw new ForecastRequestError(message, response.status);
  }
  return (await response.json()) as T;
}

/** Latest forecast summary of every program the caller may read (Prediction Service applies the scope). */
export async function listProgramForecasts(series: ForecastSeriesCode, cadence: ForecastCadence,
  signal?: AbortSignal): Promise<ProgramForecast[]> {
  const query = new URLSearchParams({ series, cadence });
  const payload = await getJson<{ forecasts?: ProgramForecast[] }>(`v1/forecasts?${query}`, signal);
  return Array.isArray(payload.forecasts) ? payload.forecasts : [];
}

/** History and projection of one program. */
export async function getProgramForecast(series: ForecastSeriesCode, programRef: string, cadence: ForecastCadence,
  signal?: AbortSignal): Promise<ProgramForecast> {
  const query = new URLSearchParams({ series, program_ref: programRef, cadence });
  return getJson<ProgramForecast>(`v1/forecasts?${query}`, signal);
}

/** Program names and faculty ids within the caller's scope; best effort. */
export async function getProgramCatalog(signal?: AbortSignal): Promise<{
  names: Record<string, string>;
  faculties: Record<string, number>;
}> {
  const payload = await getJson<{ programs?: { program_ref: string; name: string; faculty_id?: number }[] }>(
    'v1/academic-options',
    signal,
  );
  const names: Record<string, string> = {};
  const faculties: Record<string, number> = {};
  for (const program of payload.programs ?? []) {
    names[program.program_ref] = program.name;
    if (typeof program.faculty_id === 'number') faculties[program.program_ref] = program.faculty_id;
  }
  return { names, faculties };
}

/** Program names within the caller's scope; best effort (names fall back to the program code). */
export async function getProgramNames(signal?: AbortSignal): Promise<Record<string, string>> {
  const { names } = await getProgramCatalog(signal);
  return names;
}

/** Submit a scoped forecast job for the selected series, cadence and horizon. */
export async function submitForecastJob(input: {
  cadence: ForecastCadence;
  series_codes: ForecastSeriesCode[];
  horizon: number;
  programs?: string[];
}): Promise<ForecastJobStatus> {
  let response: Response;
  try {
    response = await fetch(bffUrl('v1/forecast-jobs'), {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        cadence: input.cadence,
        series_codes: input.series_codes,
        horizon: input.horizon,
        programs: input.programs ?? [],
      }),
    });
  } catch {
    throw new ForecastRequestError('No se pudo conectar con el servicio de pronósticos.', 0);
  }
  const payload = (await response.json().catch(() => ({}))) as { detail?: string; error?: string } & Partial<ForecastJobStatus>;
  if (!response.ok) {
    throw new ForecastRequestError(
      payload.detail ?? payload.error ?? 'No se pudo iniciar la generación del pronóstico.',
      response.status,
    );
  }
  return payload as ForecastJobStatus;
}

/** Poll a forecast job submitted from the portal. */
export async function getForecastJob(jobId: string, signal?: AbortSignal): Promise<ForecastJobStatus> {
  return getJson<ForecastJobStatus>(`v1/jobs/${encodeURIComponent(jobId)}`, signal);
}

/** Last observed point and first projected point of a series. */
export function forecastHighlights(points: ForecastBandPoint[]): {
  lastObserved: ForecastBandPoint | null;
  nextProjected: ForecastBandPoint | null;
} {
  const history = points.filter((point) => point.kind === 'HISTORY');
  const projected = points.filter((point) => point.kind === 'FORECAST');
  return { lastObserved: history[history.length - 1] ?? null, nextProjected: projected[0] ?? null };
}
