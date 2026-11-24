/** Shared fixtures of the ML Studio specs (PRED-107). Not imported by the application. */
import type { ModelSummary } from '../../../data-access/ml-operations';
import type { DatasetProfile, MlJob, MlTask } from '../../../data-access/ml-studio';

export function task(overrides: Partial<MlTask> = {}): MlTask {
  return {
    code: 'STUDENT_GPA_NEXT_CUT',
    kind: 'regression',
    subject: 'student',
    grain: 'student_program_cut',
    title: 'PPA del próximo corte',
    description: 'Estima el PPA acumulado del estudiante en el siguiente corte.',
    target_field: 'next_gpa',
    target_label: 'PPA acumulado',
    population_label: 'Estudiantes activos',
    algorithms: ['ridge', 'random_forest', 'xgboost'],
    primary_metric: 'rmse',
    cadences: ['SEMESTRAL', 'ANUAL'],
    servable: true,
    extractable: true,
    target_unit: 'puntos',
    ...overrides,
  };
}

export const TASKS: MlTask[] = [
  task(),
  task({
    code: 'PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE',
    kind: 'classification',
    title: 'Deserción de carrera',
    description: 'Riesgo de abandonar la carrera antes del cierre esperado.',
    algorithms: ['random_forest', 'xgboost'],
    primary_metric: 'recall',
    target_unit: null,
  }),
  task({
    code: 'COURSE_FAILURE',
    kind: 'classification',
    subject: 'enrollment',
    title: 'Reprobación de materia',
    description: 'Riesgo de reprobar una materia inscrita.',
    algorithms: ['random_forest', 'xgboost'],
  }),
  task({
    code: 'APPLICATIONS_BY_PROGRAM',
    kind: 'forecast',
    subject: 'series',
    title: 'Postulaciones por carrera',
    description: 'Proyección de postulaciones.',
    algorithms: [],
    servable: false,
    extractable: false,
  }),
];

export function job(overrides: Partial<MlJob> = {}): MlJob {
  return {
    job_id: '6f1c5d2a-1111-4c8b-9f9c-2f5e3d4c6b01',
    dataset_ref: 'custom:gpa',
    algorithm: 'ridge',
    status: 'SUCCEEDED',
    created_at: '2026-11-24T10:00:00Z',
    submitted_by: 'ana.admin',
    job_kind: 'TRAIN',
    params: {},
    study_id: 'study-1',
    model_candidate: { model_id: 'model-ridge', version: 'ridge-1' },
    ...overrides,
  };
}

export function regressionModel(overrides: Partial<ModelSummary> = {}): ModelSummary {
  return {
    task_kind: 'regression',
    target_unit: 'puntos',
    regression_metrics: {
      mae: 4.1, rmse: 5.6, r2: 0.62, mape: 0.08, bias: 0.3,
      interval_coverage: { '0.8': 0.81, '0.95': 0.94 },
      residuals_by_bucket: [{ observed_min: 0, observed_max: 50, count: 40, mae: 5, bias: 1 }],
      test_row_count: 120,
    },
    model_id: 'model-ridge',
    version: 'ridge-1',
    algorithm: 'ridge',
    created_at: '2026-11-24T10:05:00Z',
    lifecycle_state: 'CANDIDATE',
    event_code: 'STUDENT_GPA_NEXT_CUT',
    cadence: 'SEMESTRAL',
    scope_key: 'STUDENT_GPA_NEXT_CUT|SEMESTRAL',
    is_active: false,
    decision_threshold: null,
    dataset: {
      dataset_id: 'gpa', dataset_ref: 'custom:gpa', evidence_kind: 'institutional_unverified',
      target_definition_ref: null, population_definition_ref: null, target_definition: null,
    },
    activatable: true,
    not_activatable_reason: null,
    test_metrics: {
      recall: null, precision: null, f1_score: null, accuracy: null, roc_auc: null, pr_auc: null,
      alert_rate: null, macro_f1: null, test_row_count: 120, positive_support: null, threshold_origin: null,
    },
    per_class: [],
    confusion_matrix: null,
    validation: { mean_recall: null, mean_f1: null, mean_rmse: 5.4, mean_mae: 4, method: 'GroupKFold', n_splits: 5, candidate_count: 4 },
    hyperparameters: { alpha: 1 },
    ...overrides,
  };
}

export const PROFILE: DatasetProfile = {
  profile_version: '1.0',
  generated_at: '2026-11-24T10:00:00Z',
  dataset_id: 'gpa',
  event_code: 'STUDENT_GPA_NEXT_CUT',
  task_kind: 'regression',
  row_count: 1250,
  feature_count: 2,
  coverage: {
    rows_by_period: [{ key: '2024-1', count: 600 }, { key: '2024-2', count: 650 }],
    rows_by_program: [{ key: 'INF', count: 1250 }],
  },
  target: {
    kind: 'regression',
    field: 'next_gpa',
    missing: 0,
    summary: {
      count: 1250, min: 20, max: 95, mean: 61.5, std: 12.2, p25: 52, median: 62, p75: 70, distinct: 70,
      histogram: [{ start: 20, end: 57.5, count: 500 }, { start: 57.5, end: 95, count: 750 }],
    },
  },
  features: [
    {
      name: 'ppa_acumulado', logical_type: 'number', missing: 0, missing_ratio: 0, target_correlation: 0.97,
      summary: {
        count: 1250, min: 20, max: 95, mean: 60, std: 12, p25: 50, median: 60, p75: 70, distinct: 70,
        histogram: [{ start: 20, end: 95, count: 1250 }],
      },
    },
    { name: 'materias_arrastradas', logical_type: 'number', missing: 250, missing_ratio: 0.2, target_correlation: -0.4 },
  ],
  target_correlations: [{ field: 'ppa_acumulado', correlation: 0.97 }, { field: 'materias_arrastradas', correlation: -0.4 }],
  warnings: [
    { code: 'POSSIBLE_LEAKAGE', field: 'ppa_acumulado', message: 'La variable tiene correlación 0.97 con el objetivo.' },
  ],
};
