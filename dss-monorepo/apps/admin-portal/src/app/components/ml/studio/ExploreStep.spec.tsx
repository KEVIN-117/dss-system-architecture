import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDatasetProfile, getDatasetSample } = vi.hoisted(() => ({
  getDatasetProfile: vi.fn(),
  getDatasetSample: vi.fn(),
}));

vi.mock('../../../data-access/ml-studio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../data-access/ml-studio')>()),
  getDatasetProfile,
  getDatasetSample,
}));
// ECharts needs a canvas; the charts library covers rendering.
vi.mock('../studio-charts', () => ({
  CountBarChart: ({ ariaLabel }: { ariaLabel: string }) => <div data-testid="count-chart">{ariaLabel}</div>,
  HistogramChart: ({ ariaLabel }: { ariaLabel: string }) => <div data-testid="histogram">{ariaLabel}</div>,
  CorrelationChart: () => <div data-testid="correlation-chart" />,
}));

import { ExploreStep } from './ExploreStep';
import { PROFILE } from './test-fixtures';

beforeEach(() => {
  vi.clearAllMocks();
  getDatasetProfile.mockResolvedValue(PROFILE);
  getDatasetSample.mockResolvedValue({
    row_count: 1250,
    columns: ['student_ref', 'ppa_acumulado', 'next_gpa'],
    rows: [{ student_ref: 'a1b2', ppa_acumulado: 61.25, next_gpa: null }],
  });
});

describe('ExploreStep', () => {
  it('summarises the dataset profile and its warnings', async () => {
    render(<ExploreStep datasetRef="custom:gpa" />);

    expect(await screen.findByText(/^1\.?250$/)).toBeTruthy();
    expect(screen.getByText('2 periodos · 1 carreras')).toBeTruthy();
    expect(screen.getByText('Posible fuga del objetivo')).toBeTruthy();
    expect(screen.getByText('Histograma del objetivo')).toBeTruthy();
    expect(getDatasetProfile).toHaveBeenCalledWith('custom:gpa');
    expect(getDatasetSample).toHaveBeenCalledWith('custom:gpa', 20);
  });

  it('lists features and shows the histogram of the chosen one', async () => {
    render(<ExploreStep datasetRef="custom:gpa" />);

    expect(await screen.findByText('Histograma de ppa_acumulado')).toBeTruthy();
    expect(screen.getByText('20,0 %')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'materias_arrastradas' }));
    expect(screen.getByText('Sin distribución para esta variable.')).toBeTruthy();
  });

  it('shows a pseudonymised sample with placeholders for empty values', async () => {
    render(<ExploreStep datasetRef="custom:gpa" />);

    expect(await screen.findByText('a1b2')).toBeTruthy();
    expect(screen.getByText(/^1 de 1\.?250 filas\. Los identificadores están seudonimizados\.$/)).toBeTruthy();
  });

  it('reports a profile that cannot be read', async () => {
    getDatasetProfile.mockRejectedValue(new Error('El dataset no tiene perfil.'));
    render(<ExploreStep datasetRef="custom:gpa" />);

    expect((await screen.findByRole('alert')).textContent).toBe('El dataset no tiene perfil.');
  });
});
