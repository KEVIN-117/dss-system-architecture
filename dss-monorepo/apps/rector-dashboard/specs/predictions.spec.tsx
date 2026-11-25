import React, { act } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@dss-monorepo/design-system', () => ({ AccessDenied: () => null }));
vi.mock('@dss-monorepo/auth', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@dss-monorepo/rbac', () => ({
  RoleGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import PredictionsPage from '../src/app/predictions/page';

function jsonResponse(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

function mockBffResponses(...responses: Array<{ payload: unknown; status?: number }>) {
  let responseIndex = 0;
  vi.mocked(fetch).mockImplementation(async (input) => {
    if (String(input).includes('/v1/academic-options')) {
      return jsonResponse({
        programs: [{ program_ref: 'P01', name: 'Programa de prueba', faculty_id: 1 }],
        cuts: [{ program_ref: 'P01', cut_id: '42', academic_year: 2026, academic_period: 1, cadence: 'SEMESTRAL' }],
      }) as Response;
    }

    const nextResponse = responses[responseIndex++];
    return jsonResponse(nextResponse?.payload ?? {}, nextResponse?.status ?? 200) as Response;
  });
}

async function fillScope() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  fireEvent.change(screen.getByLabelText('Programa'), { target: { value: 'P01' } });
  fireEvent.change(screen.getByLabelText('Cierre académico'), { target: { value: '42' } });
}

describe('Rector prediction publication states', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_BFF_URL', 'http://localhost:3006');
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('crypto', { randomUUID: () => 'test-idempotency-key' });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows an explicit empty state when no complete publication exists', async () => {
    mockBffResponses({ payload: { data: { predictionPublication: { publication: null } } } });
    render(<PredictionsPage />);
    await fillScope();
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));

    expect(await screen.findByText('No hay una publicación completa para este programa y corte.')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith('http://localhost:3006/api/graphql', expect.objectContaining({ credentials: 'include' }));
  });

  it('renders a published row when its probability is unavailable', async () => {
    mockBffResponses({ payload: { data: { predictionPublication: { publication: {
      batch_id: 'batch-1', status: 'PUBLISHED', program_ref: 'P01', closure_id: 42,
      model_id: 'faker-model', model_version: 'test-v1', result_count: 1,
      result_offset: 0, results: [{ subject_ref: '90001', program_ref: 'P01', closure_id: 42,
        predicted_class: 'NEGATIVE_EVENT', event_probability: null, model_id: 'faker-model',
        model_version: 'test-v1', generated_at: '2026-11-03T00:00:00Z' }],
    } } } } });
    render(<PredictionsPage />);
    await fillScope();
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));

    expect(await screen.findByText('No disponible')).toBeTruthy();
    // PRED-108: results are worded for the selected objective (dropout by default).
    expect(screen.getByText('Sin riesgo previsto')).toBeTruthy();
  });

  it('reads and renders the publication of the selected objective (PRED-108)', async () => {
    mockBffResponses({ payload: { data: { predictionPublication: { publication: {
      batch_id: 'batch-3', status: 'PUBLISHED', program_ref: 'P01', closure_id: 42,
      model_id: 'gpa-model', model_version: 'v1', result_count: 1, result_offset: 0,
      results: [{ subject_ref: '90002', program_ref: 'P01', closure_id: 42, predicted_class: null,
        event_probability: null, predicted_value: 63.4, prediction_interval: { '0.8': { lower: 58, upper: 69 } },
        model_id: 'gpa-model', model_version: 'v1', generated_at: '2026-11-03T00:00:00Z' }],
    } } } } });
    render(<PredictionsPage />);
    await fillScope();
    fireEvent.click(screen.getByRole('radio', { name: 'PPA' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Promedio ponderado acumulado proyectado');
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));

    expect(await screen.findByText('PPA proyectado')).toBeTruthy();
    expect(screen.getByText('63,4')).toBeTruthy();
    expect(screen.getByText('80 %: 58,0 – 69,0')).toBeTruthy();
    const graphqlCall = vi.mocked(fetch).mock.calls.find(([input]) => String(input).endsWith('/api/graphql'));
    const body = JSON.parse(String((graphqlCall?.[1] as RequestInit).body));
    expect(body.variables).toMatchObject({ programRef: 'P01', cutId: '42', eventType: 'student_gpa' });
  });

  it('starts the population batch of the selected objective', async () => {
    mockBffResponses({ payload: { batch_id: 'batch-4', status: 'QUEUED', program_ref: 'P01', closure_id: '42', model_id: 'm', model_version: 'v1', result_count: 0 }, status: 202 });
    render(<PredictionsPage />);
    await fillScope();
    fireEvent.click(screen.getByRole('radio', { name: 'Rezago' }));
    fireEvent.click(screen.getByRole('button', { name: 'Calcular y publicar' }));

    expect(await screen.findByText('QUEUED')).toBeTruthy();
    const batchCall = vi.mocked(fetch).mock.calls.find(([input]) => String(input).endsWith('/v1/prediction-batches'));
    expect(JSON.parse(String((batchCall?.[1] as RequestInit).body)).event_type).toBe('student_backlog');
  });

  it('shows a failed batch as unpublished and explains that partial rows are not exposed', async () => {
    vi.useFakeTimers();
    mockBffResponses(
      { payload: { batch_id: 'batch-2', status: 'QUEUED', program_ref: 'P01', closure_id: '42', model_id: 'faker-model', model_version: 'test-v1', result_count: 0 }, status: 202 },
      { payload: { batch_id: 'batch-2', status: 'FAILED', program_ref: 'P01', closure_id: '42', model_id: 'faker-model', model_version: 'test-v1', result_count: 0, error: { detail: 'No se publicó un lote parcial.' } } },
    );
    render(<PredictionsPage />);
    await fillScope();
    fireEvent.click(screen.getByRole('button', { name: 'Calcular y publicar' }));
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText('QUEUED')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith('http://localhost:3006/api/prediction/v1/prediction-batches', expect.objectContaining({ credentials: 'include' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });

    expect(screen.getByText('FAILED')).toBeTruthy();
    expect(screen.getByText(/El lote falló y no se considera una publicación completa/)).toBeTruthy();
    expect(screen.getByText('No se publicó un lote parcial.')).toBeTruthy();
  });
});
