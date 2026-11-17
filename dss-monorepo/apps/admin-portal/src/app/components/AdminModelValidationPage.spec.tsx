import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getModelRegistry, activateModel, deactivateModel } = vi.hoisted(() => ({
  getModelRegistry: vi.fn(),
  activateModel: vi.fn(),
  deactivateModel: vi.fn(),
}));

vi.mock('../data-access/ml-operations', () => ({ getModelRegistry, activateModel, deactivateModel }));
// ECharts needs a canvas; the charts are covered by the charts library.
vi.mock('./ml/model-charts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ml/model-charts')>();
  return {
    ...actual,
    MetricsComparisonChart: () => <div data-testid="metrics-chart" />,
    ValidationVsTestChart: () => <div data-testid="validation-chart" />,
    PerClassChart: () => <div data-testid="per-class-chart" />,
    ConfusionMatrixChart: () => <div data-testid="confusion-chart" />,
  };
});

import { AdminModelValidationPage } from './AdminModelValidationPage';

const SCOPE = 'PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE|SEMESTRAL';

function model(overrides: Record<string, unknown>) {
  return {
    model_id: 'rf-1',
    version: 'random_forest-1',
    algorithm: 'random_forest',
    created_at: '2026-11-16T12:14:51Z',
    lifecycle_state: 'CANDIDATE',
    event_code: 'PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE',
    cadence: 'SEMESTRAL',
    scope_key: SCOPE,
    is_active: false,
    decision_threshold: 0.638,
    dataset: {
      dataset_id: 'ds-1', dataset_ref: 'custom:ds-1', evidence_kind: 'institutional_unverified',
      target_definition_ref: 'dsa:objetivo:2026-001:v1', population_definition_ref: 'dsa:poblacion:2026-002:v1',
      target_definition: { horizon_years: 4 },
    },
    activatable: true,
    not_activatable_reason: null,
    test_metrics: {
      recall: 0.6445, precision: 0.4983, f1_score: 0.5621, accuracy: 0.87, roc_auc: 0.8789, pr_auc: 0.5313,
      alert_rate: 0.165, macro_f1: 0.74, test_row_count: 25188, positive_support: 3215,
      threshold_origin: 'approved_validation_alert_rate_policy',
    },
    per_class: [],
    confusion_matrix: { label_names: ['NO_RISK', 'RISK'], values: [[19887, 2086], [1143, 2072]] },
    validation: { mean_recall: 0.661, mean_f1: 0.58, method: 'StratifiedGroupKFold', n_splits: 5, candidate_count: 2 },
    hyperparameters: { max_depth: 8 },
    ...overrides,
  };
}

const rf = model({});
const xgb = model({ model_id: 'xgb-1', version: 'xgboost-1', algorithm: 'xgboost', created_at: '2026-11-16T12:20:00Z',
  test_metrics: { ...rf.test_metrics, recall: 0.6461, f1_score: 0.5600 } });
const exploratory = model({
  model_id: 'exp-1', version: 'xgboost-exp', algorithm: 'xgboost', activatable: false,
  dataset: { ...rf.dataset, evidence_kind: 'exploratory_unapproved' },
  not_activatable_reason: 'Entrenado con datos exploratorios sin aprobación del objetivo y la población.',
});

beforeEach(() => {
  vi.clearAllMocks();
  getModelRegistry.mockResolvedValue({ models: [xgb, rf, exploratory], active_by_scope: {}, events: [] });
  activateModel.mockResolvedValue({});
});

describe('AdminModelValidationPage', () => {
  it('lists approved candidates with recall and F1 and compares them', async () => {
    render(<AdminModelValidationPage />);
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2); // the exploratory candidate is hidden by default
    expect(within(table).getAllByText('64,5 %').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('56,2 %').length).toBeGreaterThan(0);
    expect(await screen.findByTestId('metrics-chart')).toBeTruthy();
    expect(await screen.findByTestId('confusion-chart')).toBeTruthy();
  });

  it('shows unapproved candidates as not activatable, with the reason', async () => {
    render(<AdminModelValidationPage />);
    await screen.findByRole('table');
    fireEvent.click(screen.getByLabelText('Solo candidatos con datos aprobados'));
    const row = (await screen.findByText('Exploratorio')).closest('tr') as HTMLElement;
    fireEvent.click(row);
    expect(await screen.findByText(/No se puede activar: Entrenado con datos exploratorios/)).toBeTruthy();
    expect(((await screen.findByRole('button', { name: /Activar este modelo/ })) as HTMLButtonElement).disabled).toBe(true);
  });

  it('activates the focused candidate with an audited reason and reloads', async () => {
    render(<AdminModelValidationPage />);
    await screen.findByRole('table');
    fireEvent.click(await screen.findByRole('button', { name: /Activar este modelo/ }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Activar modelo' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/Motivo/), { target: { value: 'Mejor recall en validación' } });
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(activateModel).toHaveBeenCalledWith({ model_id: 'xgb-1', version: 'xgboost-1', reason: 'Mejor recall en validación' }),
    );
    await waitFor(() => expect(getModelRegistry).toHaveBeenCalledTimes(2));
  });

  it('offers deactivation for the active model', async () => {
    getModelRegistry.mockResolvedValue({
      models: [{ ...rf, is_active: true }, xgb],
      active_by_scope: { [SCOPE]: { model_id: 'rf-1', version: 'random_forest-1', artifact_digest: 'd', activated_at: '2026-11-16T13:00:00Z', approved_by: 'admin' } },
      events: [],
    });
    deactivateModel.mockResolvedValue({});
    render(<AdminModelValidationPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Desactivar/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Motivo/), { target: { value: 'Revisión' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Desactivar' }));
    await waitFor(() =>
      expect(deactivateModel).toHaveBeenCalledWith({
        event_code: 'PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE', cadence: 'SEMESTRAL', reason: 'Revisión',
      }),
    );
  });
});
