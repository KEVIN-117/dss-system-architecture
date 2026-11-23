import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { getEtlStatus } = vi.hoisted(() => ({ getEtlStatus: vi.fn() }));

vi.mock('../../data-access/load-manager', () => ({ getEtlStatus }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { EtlRunningIndicator } from './EtlRunningIndicator';

const running = {
  id: '11111111-1111-4111-8111-111111111111',
  processCode: 'VERTICAL_LOAD',
  trigger: 'SCHEDULED',
  scheduleId: 3,
  closureId: 7,
  runId: null,
  parameters: {},
  status: 'RUNNING',
  active: true,
  hopExecutionId: null,
  requestedBy: 'scheduler:Carga nocturna',
  requestedAt: new Date(Date.now() - 120_000).toISOString(),
  submittedAt: null,
  startedAt: null,
  finishedAt: null,
  stopRequestedBy: null,
  stopRequestedAt: null,
  resultSummary: null,
  rowVersion: 2,
};

afterEach(() => vi.clearAllMocks());

describe('EtlRunningIndicator', () => {
  it('links to the running launch with its process and elapsed time', async () => {
    getEtlStatus.mockResolvedValue({ running: true, active: [running] });

    render(<EtlRunningIndicator enabled />);

    const link = await screen.findByRole('link');
    expect(link.getAttribute('href')).toBe(`/etl/launches/${running.id}`);
    expect(link.textContent).toContain('ETL en ejecución · Carga vertical del DW');
    expect(link.textContent).toMatch(/2 min/);
  });

  it('stays hidden when nothing runs or the status cannot be read', async () => {
    getEtlStatus.mockResolvedValueOnce({ running: false, active: [] });
    const { container, rerender } = render(<EtlRunningIndicator enabled />);
    await waitFor(() => expect(getEtlStatus).toHaveBeenCalled());
    expect(container.textContent).toBe('');

    getEtlStatus.mockRejectedValueOnce(new Error('403'));
    rerender(<EtlRunningIndicator enabled={false} />);
    rerender(<EtlRunningIndicator enabled />);
    await waitFor(() => expect(getEtlStatus).toHaveBeenCalledTimes(2));
    expect(container.textContent).toBe('');
  });

  it('does not poll without the monitor permission', () => {
    render(<EtlRunningIndicator enabled={false} />);
    expect(getEtlStatus).not.toHaveBeenCalled();
  });
});
