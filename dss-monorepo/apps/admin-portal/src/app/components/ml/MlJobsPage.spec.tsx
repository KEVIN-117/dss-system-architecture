import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listMlJobs, cancelMlJob } = vi.hoisted(() => ({ listMlJobs: vi.fn(), cancelMlJob: vi.fn() }));

vi.mock('../../data-access/ml-studio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data-access/ml-studio')>()),
  listMlJobs,
  cancelMlJob,
}));

import { MlJobsPage, jobSubject } from './MlJobsPage';
import { job } from './studio/test-fixtures';

const extraction = job({
  job_id: 'extract-1', job_kind: 'EXTRACT_DATASET', algorithm: '', status: 'RUNNING', model_candidate: null,
  params: { task_code: 'COURSE_FAILURE' },
});
const forecast = job({
  job_id: 'forecast-1', job_kind: 'FORECAST', algorithm: '', status: 'FAILED', model_candidate: null,
  params: { series_codes: ['ENROLLED_BY_PROGRAM'], cadence: 'SEMESTRAL' }, error: { title: 'DW_NOT_CONFIGURED' },
});

beforeEach(() => {
  vi.clearAllMocks();
  listMlJobs.mockResolvedValue([extraction, job(), forecast]);
});

describe('MlJobsPage', () => {
  it('lists every kind of job with its subject and result', async () => {
    render(<MlJobsPage />);

    expect(await screen.findByText('COURSE_FAILURE')).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Extracción de datos' })).toBeTruthy();
    expect(screen.getByText('Modelo model-ridge')).toBeTruthy();
    expect(screen.getByText('DW_NOT_CONFIGURED')).toBeTruthy();
    expect(listMlJobs).toHaveBeenCalledWith({ kind: undefined, status: undefined, limit: 100 });
    expect(jobSubject(forecast)).toBe('ENROLLED_BY_PROGRAM · SEMESTRAL');
  });

  it('filters by kind and status', async () => {
    render(<MlJobsPage />);
    await screen.findByText('COURSE_FAILURE');

    fireEvent.change(screen.getByLabelText('Tipo de job'), { target: { value: 'FORECAST' } });
    fireEvent.change(screen.getByLabelText('Estado del job'), { target: { value: 'FAILED' } });

    await waitFor(() => expect(listMlJobs).toHaveBeenLastCalledWith({ kind: 'FORECAST', status: 'FAILED', limit: 100 }));
  });

  it('cancels only active jobs', async () => {
    cancelMlJob.mockResolvedValue({ ...extraction, status: 'CANCELLED' });
    render(<MlJobsPage />);

    const buttons = await screen.findAllByRole('button', { name: /Cancelar job/ });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);

    await waitFor(() => expect(cancelMlJob).toHaveBeenCalledWith('extract-1'));
    expect(await screen.findByRole('cell', { name: 'Cancelado' })).toBeTruthy();
  });

  it('reports a list that cannot be read', async () => {
    listMlJobs.mockRejectedValue(new Error('La sesión no es válida o venció.'));
    render(<MlJobsPage />);

    expect((await screen.findByRole('alert')).textContent).toBe('La sesión no es válida o venció.');
  });
});
