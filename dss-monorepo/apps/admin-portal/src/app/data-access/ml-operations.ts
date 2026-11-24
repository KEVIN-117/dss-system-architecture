const BFF_BASE_URL =
  process.env.NEXT_PUBLIC_BFF_URL?.trim().replace(/\/$/, '') ?? '';
const TRAINING_JOBS_URL = `${BFF_BASE_URL}/api/prediction/v1/training-jobs`;
const DATASETS_URL = `${BFF_BASE_URL}/api/prediction/v1/datasets`;

export type MlAlgorithm = 'random_forest' | 'xgboost' | 'ridge';
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

// ---------------------------------------------------------------------------
// Model registry: validation metrics, activation and deactivation.

const MODELS_URL = `${BFF_BASE_URL}/api/prediction/v1/models`;

/** Event code of a catalog task (PRED-101); the catalog is served by GET /v1/ml-tasks. */
export type ModelEventCode = string;
export type ModelCadence = 'SEMESTRAL' | 'ANUAL';

export interface ModelTestMetrics {
  recall: number | null;
  precision: number | null;
  f1_score: number | null;
  accuracy: number | null;
  roc_auc: number | null;
  pr_auc: number | null;
  alert_rate: number | null;
  macro_f1: number | null;
  test_row_count: number | null;
  positive_support: number | null;
  threshold_origin: string | null;
}

export interface ModelClassMetrics {
  class_name: string;
  precision: number | null;
  recall: number | null;
  f1_score: number | null;
  support: number | null;
}

export interface RegressionMetrics {
  mae: number | null;
  rmse: number | null;
  r2: number | null;
  mape: number | null;
  bias: number | null;
  interval_coverage: Record<string, number> | null;
  residuals_by_bucket: Array<{ observed_min: number; observed_max: number; count: number; mae: number; bias: number }> | null;
  test_row_count: number | null;
}

export interface ModelSummary {
  /** PRED-103: regression candidates carry regression_metrics instead of classification metrics. */
  task_kind?: 'classification' | 'regression';
  regression_metrics?: RegressionMetrics | null;
  target_unit?: string | null;
  model_id: string;
  version: string;
  algorithm: MlAlgorithm;
  created_at: string | null;
  lifecycle_state: string | null;
  event_code: ModelEventCode | null;
  cadence: ModelCadence | null;
  scope_key: string | null;
  is_active: boolean;
  decision_threshold: number | null;
  dataset: {
    dataset_id: string | null;
    dataset_ref: string | null;
    evidence_kind: string | null;
    target_definition_ref: string | null;
    population_definition_ref: string | null;
    target_definition: { horizon_years?: number } | null;
  };
  activatable: boolean;
  not_activatable_reason: string | null;
  test_metrics: ModelTestMetrics;
  per_class: ModelClassMetrics[];
  confusion_matrix: { label_names: string[]; values: number[][] } | null;
  validation: {
    mean_recall: number | null;
    mean_f1: number | null;
    mean_rmse?: number | null;
    mean_mae?: number | null;
    method: string | null;
    n_splits: number | null;
    candidate_count: number | null;
  };
  hyperparameters: Record<string, unknown> | null;
}

export interface ModelPointer {
  model_id: string;
  version: string;
  artifact_digest: string;
  activated_at: string;
  approved_by: string;
  activation_kind?: string;
}

export interface ModelRegistryEvent {
  action: 'PROMOTE' | 'ROLLBACK' | 'ACTIVATE' | 'DEACTIVATE';
  scope_key: string | null;
  previous: ModelPointer | null;
  active: ModelPointer | null;
  approved_by?: string;
  reason?: string;
  at?: string;
}

export interface ModelRegistrySnapshot {
  models: ModelSummary[];
  active_by_scope: Record<string, ModelPointer>;
  events: ModelRegistryEvent[];
}

export async function getModelRegistry(): Promise<ModelRegistrySnapshot> {
  const response = await fetch(MODELS_URL, {
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw await responseError(response);
  return (await response.json()) as ModelRegistrySnapshot;
}

export async function activateModel(input: {
  model_id: string;
  version: string;
  reason: string;
}): Promise<ModelPointer> {
  const response = await fetch(`${MODELS_URL}/activate`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await responseError(response);
  return ((await response.json()) as { active: ModelPointer }).active;
}

export async function deactivateModel(input: {
  event_code: ModelEventCode;
  cadence: ModelCadence;
  reason: string;
}): Promise<ModelRegistryEvent> {
  const response = await fetch(`${MODELS_URL}/deactivate`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await responseError(response);
  return ((await response.json()) as { event: ModelRegistryEvent }).event;
}

export function isMlAlgorithm(value: string): value is MlAlgorithm {
  return value === 'random_forest' || value === 'xgboost' || value === 'ridge';
}

export async function responseError(response: Response): Promise<Error> {
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
