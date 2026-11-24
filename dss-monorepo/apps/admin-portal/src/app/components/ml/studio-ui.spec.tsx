import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getMlJob } = vi.hoisted(() => ({ getMlJob: vi.fn() }));

vi.mock('../../data-access/ml-studio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data-access/ml-studio')>()),
  getMlJob,
}));

import { JobProgress, JobStatusBadge, jobError, useJobPolling } from './studio-ui';
import { job } from './studio/test-fixtures';

function Polled({ jobId }: { jobId: string | null }) {
  const { job: current, error } = useJobPolling(jobId, 10);
  return <p>{error ?? current?.status ?? 'sin job'}</p>;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe('studio ui', () => {
  it('labels job states in Spanish', () => {
    render(<JobStatusBadge status="RUNNING" />);
    expect(screen.getByText('En ejecución')).toBeTruthy();
  });

  it('shows progress only while the job runs', () => {
    const { rerender } = render(<JobProgress job={job({ status: 'RUNNING', progress: 0.42 })} />);
    expect(screen.getByText('42 %')).toBeTruthy();
    rerender(<JobProgress job={job({ status: 'SUCCEEDED', progress: 1 })} />);
    expect(screen.queryByText('100 %')).toBeNull();
  });

  it('explains failed jobs', () => {
    expect(jobError(job({ status: 'FAILED', error: { title: 'Falla', detail: 'Sin datos' } }))).toBe('Sin datos');
    expect(jobError(job({ status: 'FAILED', error: null }))).toBe('El job falló sin detalle.');
    expect(jobError(job())).toBeNull();
  });

  it('polls a job until it finishes', async () => {
    getMlJob
      .mockResolvedValueOnce(job({ status: 'QUEUED' }))
      .mockResolvedValueOnce(job({ status: 'RUNNING' }))
      .mockResolvedValue(job({ status: 'SUCCEEDED' }));
    render(<Polled jobId="j-1" />);

    expect(await screen.findByText('SUCCEEDED')).toBeTruthy();
    const calls = getMlJob.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(getMlJob.mock.calls.length).toBe(calls);
  });

  it('does nothing without a job and keeps retrying after an error', async () => {
    const { rerender } = render(<Polled jobId={null} />);
    expect(screen.getByText('sin job')).toBeTruthy();
    getMlJob.mockRejectedValueOnce(new Error('BFF caído')).mockResolvedValue(job());
    rerender(<Polled jobId="j-2" />);

    expect(await screen.findByText('BFF caído')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('SUCCEEDED')).toBeTruthy());
  });
});
