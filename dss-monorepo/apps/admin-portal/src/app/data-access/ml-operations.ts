const BFF_BASE_URL =
  process.env.NEXT_PUBLIC_BFF_URL?.trim().replace(/\/$/, '') ?? '';
const TRAINING_JOBS_URL = `${BFF_BASE_URL}/api/prediction/v1/training-jobs`;
const DATASETS_URL = `${BFF_BASE_URL}/api/prediction/v1/datasets`;

export type MlAlgorithm = 'random_forest' | 'xgboost';
export interface TrainingJobRequest {
  dataset_ref: string;
  algorithm: MlAlgorithm;
  configuration_ref?: string;
}
export interface TrainingJob {
  job_id: string;
  dataset_ref: string;
  algorithm: MlAlgorithm;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  created_at: string;
  model_candidate?: { model_id: string; version: string } | null;
  error?: { title?: string } | null;
}

export interface DatasetOption {
  dataset_ref: string;
  dataset_id: string;
  label: string;
  description?: string | null;
  is_custom: boolean;
  row_count: number;
  target_field?: string | null;
  event_code?: string | null;
  created_at?: string | null;
}

export interface DatasetUploadResult {
  message: string;
  dataset_ref: string;
  dataset_id: string;
  row_count: number;
  content_digest: string;
  target_field: string;
  event_code?: string | null;
}

export async function getAvailableDatasets(): Promise<DatasetOption[]> {
  const response = await fetch(DATASETS_URL, {
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw await responseError(response);
  return (await response.json()) as DatasetOption[];
}

export async function uploadCustomDataset(
  file: File,
): Promise<DatasetUploadResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${DATASETS_URL}/upload`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
    body: formData,
  });
  if (!response.ok) throw await responseError(response);
  return (await response.json()) as DatasetUploadResult;
}

export async function submitMlTrainingJob(
  input: TrainingJobRequest,
): Promise<TrainingJob> {
  const response = await fetch(TRAINING_JOBS_URL, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await responseError(response);
  return (await response.json()) as TrainingJob;
}

export async function getMlTrainingJob(jobId: string): Promise<TrainingJob> {
  const response = await fetch(
    `${TRAINING_JOBS_URL}/${encodeURIComponent(jobId)}`,
    {
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    },
  );
  if (!response.ok) throw await responseError(response);
  return (await response.json()) as TrainingJob;
}

export function isMlAlgorithm(value: string): value is MlAlgorithm {
  return value === 'random_forest' || value === 'xgboost';
}

async function responseError(response: Response): Promise<Error> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body)) {
      if (typeof body.detail === 'string') return new Error(body.detail);
      if (typeof body.error === 'string') return new Error(body.error);
      if (typeof body.title === 'string') return new Error(body.title);
    }
  } catch {
    // Use the status fallback for non-JSON responses.
  }
  if (response.status === 401)
    return new Error(
      'La sesión no es válida o venció. Inicia sesión otra vez.',
    );
  if (response.status === 403)
    return new Error('Tu cuenta no tiene el rol de administración de ML.');
  return new Error(`La operación de ML respondió HTTP ${response.status}.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
