import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getModelRegistry, activateModel, getModelHistory, rollbackModel } = vi.hoisted(() => ({
  getModelRegistry: vi.fn(),
  activateModel: vi.fn(),
  getModelHistory: vi.fn(),
  rollbackModel: vi.fn(),
}));

vi.mock('../../../data-access/ml-operations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../data-access/ml-operations')>()),
  getModelRegistry,
  activateModel,
}));
vi.mock('../../../data-access/ml-studio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../data-access/ml-studio')>()),
  getModelHistory,
  rollbackModel,
}));

import { ActivateStep } from './ActivateStep';
import { regressionModel } from './test-fixtures';

const candidate = regressionModel();
const active = regressionModel({ model_id: 'model-old', version: 'ridge-0', is_active: true });

beforeEach(() => {
  vi.clearAllMocks();
  getModelRegistry.mockResolvedValue({ models: [candidate, active], active_by_scope: {}, events: [] });
  getModelHistory.mockResolvedValue({
    model_id: 'model-ridge',
    events: [{ action: 'ACTIVATE', scope_key: candidate.scope_key, previous: null, active: null, approved_by: 'ana.admin', reason: 'primer modelo', at: '2026-11-20T10:00:00Z' }],
  });
});

describe('ActivateStep', () => {
  it('activates the candidate with a mandatory reason', async () => {
    activateModel.mockResolvedValue({ model_id: 'model-ridge', version: 'ridge-1' });
    render(<ActivateStep modelId="model-ridge" />);

    const button = await screen.findByRole('button', { name: /Activar modelo/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/^Motivo/, { selector: '#studio-activate-reason' }), { target: { value: 'menor RMSE' } });
    fireEvent.click(button);

    await waitFor(() => expect(activateModel).toHaveBeenCalledWith({ model_id: 'model-ridge', version: 'ridge-1', reason: 'menor RMSE' }));
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText('primer modelo')).toBeTruthy();
  });

  it('rolls the scope back to the previous version', async () => {
    rollbackModel.mockResolvedValue({ model_id: 'model-older', version: 'ridge-old' });
    render(<ActivateStep modelId="model-ridge" />);

    fireEvent.change(await screen.findByLabelText(/^Motivo/, { selector: '#studio-rollback-reason' }), { target: { value: 'empeoró' } });
    fireEvent.click(screen.getByRole('button', { name: /Hacer rollback/ }));

    await waitFor(() => expect(rollbackModel).toHaveBeenCalledWith({ event_code: 'STUDENT_GPA_NEXT_CUT', cadence: 'SEMESTRAL', reason: 'empeoró' }));
    expect((await screen.findByRole('status')).textContent).toContain('ridge-old');
  });

  it('explains why a candidate cannot be activated', async () => {
    getModelRegistry.mockResolvedValue({
      models: [regressionModel({ activatable: false, not_activatable_reason: 'Datos sintéticos.' })],
      active_by_scope: {},
      events: [],
    });
    render(<ActivateStep modelId="model-ridge" />);

    expect(await screen.findByText(/Datos sintéticos\./)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Activar modelo/ })).toBeNull();
    expect(screen.getByText('No hay un modelo activo que revertir.')).toBeTruthy();
  });

  it('shows the activation error returned by the service', async () => {
    activateModel.mockRejectedValue(new Error('El candidato no declara cadencia.'));
    render(<ActivateStep modelId="model-ridge" />);

    fireEvent.change(await screen.findByLabelText(/^Motivo/, { selector: '#studio-activate-reason' }), { target: { value: 'probar' } });
    fireEvent.click(screen.getByRole('button', { name: /Activar modelo/ }));

    expect((await screen.findByRole('alert')).textContent).toBe('El candidato no declara cadencia.');
  });
});
