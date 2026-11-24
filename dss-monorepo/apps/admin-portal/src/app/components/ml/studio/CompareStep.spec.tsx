import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getModelRegistry, compareModels } = vi.hoisted(() => ({
  getModelRegistry: vi.fn(),
  compareModels: vi.fn(),
}));

vi.mock('../../../data-access/ml-operations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../data-access/ml-operations')>()),
  getModelRegistry,
}));
vi.mock('../../../data-access/ml-studio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../data-access/ml-studio')>()),
  compareModels,
}));
vi.mock('../studio-charts', () => ({ ResidualsChart: () => <div data-testid="residuals-chart" /> }));
vi.mock('../model-charts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../model-charts')>()),
  MetricsComparisonChart: () => <div data-testid="metrics-chart" />,
  ConfusionMatrixChart: () => <div data-testid="confusion-chart" />,
}));

import { CompareStep, studyCandidateIds } from './CompareStep';
import { job, regressionModel } from './test-fixtures';

const ridge = regressionModel();
const xgb = regressionModel({
  model_id: 'model-xgb', version: 'xgboost-1', algorithm: 'xgboost',
  regression_metrics: { ...ridge.regression_metrics!, rmse: 6.4, r2: 0.5 },
});
const JOBS = [
  job(),
  job({ job_id: 'j-xgb', algorithm: 'xgboost', model_candidate: { model_id: 'model-xgb', version: 'xgboost-1' } }),
  job({ job_id: 'j-rf', algorithm: 'random_forest', status: 'FAILED', model_candidate: null }),
];

beforeEach(() => {
  vi.clearAllMocks();
  getModelRegistry.mockResolvedValue({ models: [ridge, xgb, regressionModel({ model_id: 'other' })], active_by_scope: {}, events: [] });
  compareModels.mockResolvedValue({
    task_kind: 'regression', decision_status: 'APTO', decision_reason: 'Ridge tiene el menor RMSE de validación.',
    selection_rule: 'min OOF RMSE', candidate_selection_status: 'SELECTED_BY_VALIDATION',
    selected_candidate_by_validation: 'model-ridge', top_candidates_by_validation: ['model-ridge'],
  });
});

describe('CompareStep', () => {
  it('compares the succeeded candidates of the study and preselects the recommended one', async () => {
    const onSelect = vi.fn();
    render(<CompareStep jobs={JOBS} selectedModelId={null} onSelect={onSelect} />);

    expect(await screen.findByText('Hay un candidato recomendado')).toBeTruthy();
    expect(compareModels).toHaveBeenCalledWith(['model-ridge', 'model-xgb']);
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith('model-ridge'));
    expect(screen.getByText('RMSE validación')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByTestId('residuals-chart')).toBeTruthy();
  });

  it('lets the operator pick another candidate', async () => {
    const onSelect = vi.fn();
    render(<CompareStep jobs={JOBS} selectedModelId="model-ridge" onSelect={onSelect} />);

    fireEvent.click(await screen.findByRole('radio', { name: 'Elegir XGBoost' }));
    expect(onSelect).toHaveBeenCalledWith('model-xgb');
  });

  it('skips the comparison with a single candidate and selects it', async () => {
    const onSelect = vi.fn();
    render(<CompareStep jobs={[job()]} selectedModelId={null} onSelect={onSelect} />);

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith('model-ridge'));
    expect(compareModels).not.toHaveBeenCalled();
  });

  it('explains when no training succeeded', () => {
    render(<CompareStep jobs={[job({ status: 'FAILED', model_candidate: null })]} selectedModelId={null} onSelect={vi.fn()} />);

    expect(screen.getByText(/Ningún entrenamiento del estudio terminó con éxito/)).toBeTruthy();
    expect(studyCandidateIds([job({ status: 'RUNNING' })])).toEqual([]);
  });
});
