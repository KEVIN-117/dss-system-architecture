import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listForecasts, getProgramForecast, submitForecastJob, getMlJob } = vi.hoisted(() => ({
  listForecasts: vi.fn(),
  getProgramForecast: vi.fn(),
  submitForecastJob: vi.fn(),
  getMlJob: vi.fn(),
}));

vi.mock('../../data-access/ml-studio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data-access/ml-studio')>()),
  listForecasts,
  getProgramForecast,
  submitForecastJob,
  getMlJob,
}));
vi.mock('./studio-charts', () => ({
  ForecastChart: ({ points }: { points: unknown[] }) => <div data-testid="forecast-chart">{points.length} puntos</div>,
}));

import { MlForecastsPage } from './MlForecastsPage';
import { job } from './studio/test-fixtures';

const backtest = (model: string, mae: number) => ({
  model, origins: 4, evaluated_points: 10, mae, rmse: mae + 2, mape: 0.07, interval_coverage: { '0.8': 0.8, '0.95': 0.9 },
});
const run = (program: string) => ({
  run_id: `run-${program}`, job_id: 'forecast-1', series_code: 'APPLICATIONS_BY_PROGRAM', program_ref: program,
  cadence: 'SEMESTRAL', horizon: 2, model_kind: 'linear_trend', model: {}, selection: {},
  backtest: { selected: backtest('linear_trend', 12.5), candidates: [backtest('linear_trend', 12.5), backtest('seasonal_naive', 15)] },
  history_points: 8, created_at: '2026-11-24T10:00:00Z',
});

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/ml-forecasts');
  listForecasts.mockResolvedValue([run('INF'), run('SIS')]);
  getProgramForecast.mockImplementation((_series: string, program: string) => Promise.resolve({
    ...run(program),
    points: [
      { year: 2025, period: 2, kind: 'HISTORY', horizon: null, value: 120, interval: null },
      { year: 2026, period: 1, kind: 'FORECAST', horizon: 1, value: 130, interval: { '0.8': { lower: 110, upper: 150 }, '0.95': { lower: 100, upper: 160 } } },
    ],
  }));
});

describe('MlForecastsPage', () => {
  it('shows the latest forecast of the first program with its backtest', async () => {
    render(<MlForecastsPage />);

    expect(await screen.findByText('2 puntos')).toBeTruthy();
    expect(listForecasts).toHaveBeenCalledWith('APPLICATIONS_BY_PROGRAM', 'SEMESTRAL');
    expect(getProgramForecast).toHaveBeenCalledWith('APPLICATIONS_BY_PROGRAM', 'INF', 'SEMESTRAL');
    expect(screen.getByText('Postulaciones por carrera · INF')).toBeTruthy();
    expect(screen.getByText('Modelos evaluados')).toBeTruthy();
    expect(screen.getByText('Ingenuo estacional')).toBeTruthy();
  });

  it('switches program and series', async () => {
    render(<MlForecastsPage />);
    await screen.findByText('2 puntos');

    fireEvent.click(screen.getByRole('button', { name: /SIS/ }));
    await waitFor(() => expect(getProgramForecast).toHaveBeenLastCalledWith('APPLICATIONS_BY_PROGRAM', 'SIS', 'SEMESTRAL'));
    fireEvent.change(screen.getByLabelText('Serie'), { target: { value: 'ENROLLED_BY_PROGRAM' } });
    await waitFor(() => expect(listForecasts).toHaveBeenLastCalledWith('ENROLLED_BY_PROGRAM', 'SEMESTRAL'));
  });

  it('opens the series requested by ML Studio', async () => {
    window.history.replaceState(null, '', '/ml-forecasts?series=ADMITTED_BY_PROGRAM');
    render(<MlForecastsPage />);

    await waitFor(() => expect(listForecasts).toHaveBeenLastCalledWith('ADMITTED_BY_PROGRAM', 'SEMESTRAL'));
  });

  it('generates the forecast of the selected series and reloads it when done', async () => {
    submitForecastJob.mockResolvedValue(job({ job_id: 'forecast-2', job_kind: 'FORECAST', status: 'QUEUED' }));
    getMlJob.mockResolvedValue(job({ job_id: 'forecast-2', job_kind: 'FORECAST', status: 'SUCCEEDED' }));
    render(<MlForecastsPage />);
    await screen.findByText('2 puntos');

    fireEvent.change(screen.getByLabelText('Horizonte'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar pronóstico/ }));

    await waitFor(() => expect(submitForecastJob).toHaveBeenCalledWith({ cadence: 'SEMESTRAL', series_codes: ['APPLICATIONS_BY_PROGRAM'], horizon: 6 }));
    await waitFor(() => expect(listForecasts).toHaveBeenCalledTimes(2));
  });

  it('invites to generate the first forecast when none exists', async () => {
    listForecasts.mockResolvedValue([]);
    render(<MlForecastsPage />);

    expect(await screen.findByText(/Aún no hay pronósticos de postulaciones por carrera/)).toBeTruthy();
  });
});
