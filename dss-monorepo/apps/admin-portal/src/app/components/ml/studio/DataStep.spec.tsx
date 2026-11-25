import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listMlDatasets, submitDatasetExtraction, getMlJob } = vi.hoisted(() => ({
  listMlDatasets: vi.fn(),
  submitDatasetExtraction: vi.fn(),
  getMlJob: vi.fn(),
}));

vi.mock('../../../data-access/ml-studio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../data-access/ml-studio')>()),
  listMlDatasets,
  submitDatasetExtraction,
  getMlJob,
}));

import { DataStep, parsePrograms } from './DataStep';
import { TASKS, job, task } from './test-fixtures';

const DATASETS = [
  { dataset_ref: 'custom:old-gpa', dataset_id: 'old-gpa', label: 'PPA 2025', is_custom: true, row_count: 900, event_code: 'STUDENT_GPA_NEXT_CUT' },
  { dataset_ref: 'custom:dropout', dataset_id: 'dropout', label: 'Deserción', is_custom: true, row_count: 10, event_code: 'PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE' },
];

beforeEach(() => {
  vi.clearAllMocks();
  listMlDatasets.mockResolvedValue(DATASETS);
});

describe('DataStep', () => {
  it('launches an extraction with cadence and programs', async () => {
    submitDatasetExtraction.mockResolvedValue(job({ job_id: 'extract-1', status: 'QUEUED', job_kind: 'EXTRACT_DATASET' }));
    const onStarted = vi.fn();
    render(<DataStep task={task()} extractionJobId={null} datasetRef={null} onExtractionStarted={onStarted} onDataset={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Cadencia'), { target: { value: 'ANUAL' } });
    fireEvent.change(screen.getByLabelText('Carreras'), { target: { value: 'INF, SIS' } });
    fireEvent.click(screen.getByRole('button', { name: /Extraer dataset/ }));

    await waitFor(() => expect(onStarted).toHaveBeenCalledWith('extract-1'));
    expect(submitDatasetExtraction).toHaveBeenCalledWith({ task_code: 'STUDENT_GPA_NEXT_CUT', cadence: 'ANUAL', programs: ['INF', 'SIS'] });
  });

  it('asks for the horizon only for dropout and validates it', async () => {
    render(<DataStep task={TASKS[1]} extractionJobId={null} datasetRef={null} onExtractionStarted={vi.fn()} onDataset={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Horizonte (años)'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /Extraer dataset/ }));

    expect((await screen.findByRole('alert')).textContent).toContain('entre 1 y 10');
    expect(submitDatasetExtraction).not.toHaveBeenCalled();
  });

  it('rejects malformed program codes before calling the BFF', async () => {
    render(<DataStep task={task()} extractionJobId={null} datasetRef={null} onExtractionStarted={vi.fn()} onDataset={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Carreras'), { target: { value: 'INF, <script>' } });
    fireEvent.click(screen.getByRole('button', { name: /Extraer dataset/ }));

    expect((await screen.findByRole('alert')).textContent).toContain('códigos de carrera');
    expect(submitDatasetExtraction).not.toHaveBeenCalled();
    expect(parsePrograms('INF ; SIS,ELT')).toEqual(['INF', 'SIS', 'ELT']);
  });

  it('hands the new dataset to the wizard when the extraction finishes', async () => {
    getMlJob.mockResolvedValue(job({ job_id: 'extract-1', job_kind: 'EXTRACT_DATASET', result_ref: 'custom:new-gpa' }));
    const onDataset = vi.fn();
    render(<DataStep task={task()} extractionJobId="extract-1" datasetRef={null} onExtractionStarted={vi.fn()} onDataset={onDataset} />);

    await waitFor(() => expect(onDataset).toHaveBeenCalledWith('custom:new-gpa'));
    expect(screen.getByText('Completado')).toBeTruthy();
  });

  it('shows why an extraction failed', async () => {
    getMlJob.mockResolvedValue(job({ status: 'FAILED', job_kind: 'EXTRACT_DATASET', error: { title: 'DW_NOT_CONFIGURED' } }));
    render(<DataStep task={task()} extractionJobId="extract-1" datasetRef={null} onExtractionStarted={vi.fn()} onDataset={vi.fn()} />);

    expect(await screen.findByText('DW_NOT_CONFIGURED')).toBeTruthy();
  });

  it('offers only the existing datasets of the same target', async () => {
    const onDataset = vi.fn();
    render(<DataStep task={task()} extractionJobId={null} datasetRef={null} onExtractionStarted={vi.fn()} onDataset={onDataset} />);

    fireEvent.click(await screen.findByRole('button', { name: /PPA 2025/ }));
    expect(onDataset).toHaveBeenCalledWith('custom:old-gpa');
    expect(screen.queryByText('Deserción')).toBeNull();
  });
});
