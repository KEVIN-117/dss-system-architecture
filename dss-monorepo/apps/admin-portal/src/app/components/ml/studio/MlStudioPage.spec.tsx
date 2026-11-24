import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { listMlTasks, listMlJobs, listMlDatasets, getDatasetProfile, getDatasetSample } = vi.hoisted(() => ({
  listMlTasks: vi.fn(),
  listMlJobs: vi.fn(),
  listMlDatasets: vi.fn(),
  getDatasetProfile: vi.fn(),
  getDatasetSample: vi.fn(),
}));

vi.mock('../../../data-access/ml-studio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../data-access/ml-studio')>()),
  listMlTasks,
  listMlJobs,
  listMlDatasets,
  getDatasetProfile,
  getDatasetSample,
}));
vi.mock('../studio-charts', () => ({
  CountBarChart: () => <div />,
  HistogramChart: () => <div />,
  CorrelationChart: () => <div />,
  ResidualsChart: () => <div />,
}));

import { MlStudioPage, stepAvailable, type StudioState } from './MlStudioPage';
import { PROFILE, TASKS, job } from './test-fixtures';

const STORAGE_KEY = 'dss.admin.ml-studio.v1';

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/ml-studio');
  listMlTasks.mockResolvedValue(TASKS);
  listMlJobs.mockResolvedValue([]);
  listMlDatasets.mockResolvedValue([]);
  getDatasetProfile.mockResolvedValue(PROFILE);
  getDatasetSample.mockResolvedValue({ row_count: 0, columns: [], rows: [] });
});
afterEach(() => window.sessionStorage.clear());

function stepButton(name: string) {
  return screen.getByRole('button', { name: new RegExp(name) }) as HTMLButtonElement;
}

describe('MlStudioPage', () => {
  it('starts at the target step with later steps locked', async () => {
    render(<MlStudioPage />);

    expect(await screen.findByText('PPA del próximo corte')).toBeTruthy();
    const steps = screen.getByRole('navigation', { name: 'Pasos de ML Studio' });
    expect(steps.querySelector('[aria-current="step"]')?.textContent).toContain('Objetivo');
    expect(stepButton('^2Datos$').disabled).toBe(true);
    expect(stepButton('^6Activar$').disabled).toBe(true);
  });

  it('moves to the data step when a target is chosen and remembers it', async () => {
    render(<MlStudioPage />);

    fireEvent.click(await screen.findByRole('button', { name: /PPA del próximo corte/ }));

    expect(await screen.findByText('Extraer del almacén de datos')).toBeTruthy();
    await waitFor(() => expect(JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({
      step: 'data', taskCode: 'STUDENT_GPA_NEXT_CUT',
    }));
  });

  it('opens a dataset uploaded from Operaciones ML in the explore step', async () => {
    window.history.replaceState(null, '', '/ml-studio?task=STUDENT_GPA_NEXT_CUT&dataset=custom%3Agpa');
    render(<MlStudioPage />);

    expect(await screen.findByText('Posible fuga del objetivo')).toBeTruthy();
    expect(getDatasetProfile).toHaveBeenCalledWith('custom:gpa');
  });

  it('restores a study and follows its jobs', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      step: 'train', taskCode: 'STUDENT_GPA_NEXT_CUT', datasetRef: 'custom:gpa', studyId: 'study-1', extractionJobId: null, modelId: null,
    }));
    listMlJobs.mockResolvedValue([job()]);
    render(<MlStudioPage />);

    expect(await screen.findByText('Entrenamientos del estudio')).toBeTruthy();
    await waitFor(() => expect(listMlJobs).toHaveBeenCalledWith({ studyId: 'study-1', kind: 'TRAIN', limit: 20 }));
    await waitFor(() => expect(stepButton('^Comparar$').disabled).toBe(false));
  });

  it('reports a catalog that cannot be read', async () => {
    listMlTasks.mockRejectedValue(new Error('Tu cuenta no tiene el rol de administración de ML.'));
    render(<MlStudioPage />);

    expect((await screen.findByRole('alert')).textContent).toBe('Tu cuenta no tiene el rol de administración de ML.');
  });

  it('unlocks each step only with the choices it needs', () => {
    const base: StudioState = { step: 'task', taskCode: null, extractionJobId: null, datasetRef: null, studyId: null, modelId: null };
    expect(stepAvailable('data', base, 0)).toBe(false);
    expect(stepAvailable('data', { ...base, taskCode: 'X' }, 0)).toBe(true);
    expect(stepAvailable('explore', { ...base, taskCode: 'X' }, 0)).toBe(false);
    expect(stepAvailable('train', { ...base, taskCode: 'X', datasetRef: 'd' }, 0)).toBe(true);
    expect(stepAvailable('compare', { ...base, studyId: 's' }, 0)).toBe(false);
    expect(stepAvailable('compare', { ...base, studyId: 's' }, 1)).toBe(true);
    expect(stepAvailable('activate', { ...base, modelId: 'm' }, 0)).toBe(true);
  });
});
