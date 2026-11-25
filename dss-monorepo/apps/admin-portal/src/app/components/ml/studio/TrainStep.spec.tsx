import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { submitTrainingStudy } = vi.hoisted(() => ({ submitTrainingStudy: vi.fn() }));

vi.mock('../../../data-access/ml-studio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../data-access/ml-studio')>()),
  submitTrainingStudy,
}));

import { TrainStep, buildSearchSpaces } from './TrainStep';
import { job, task } from './test-fixtures';

beforeEach(() => vi.clearAllMocks());

describe('TrainStep', () => {
  it('trains the selected algorithms as one study', async () => {
    submitTrainingStudy.mockResolvedValue({ study_id: 'study-1', dataset_ref: 'custom:gpa', jobs: [] });
    const onStudy = vi.fn();
    render(<TrainStep task={task()} datasetRef="custom:gpa" studyId={null} jobs={[]} jobsError={null} onStudy={onStudy} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Random Forest' }));
    fireEvent.click(screen.getByRole('button', { name: /Entrenar candidatos/ }));

    await waitFor(() => expect(onStudy).toHaveBeenCalledWith('study-1'));
    expect(submitTrainingStudy).toHaveBeenCalledWith({ dataset_ref: 'custom:gpa', algorithms: ['ridge', 'xgboost'] });
  });

  it('sends custom hyperparameter grids', async () => {
    submitTrainingStudy.mockResolvedValue({ study_id: 'study-2', dataset_ref: 'custom:gpa', jobs: [] });
    render(<TrainStep task={task({ algorithms: ['ridge'] })} datasetRef="custom:gpa" studyId={null} jobs={[]} jobsError={null} onStudy={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Ajustar hiperparámetros/ }));
    fireEvent.change(screen.getByLabelText('Regresión Ridge alpha'), { target: { value: '0.1, 1, 10' } });
    fireEvent.click(screen.getByRole('button', { name: /Entrenar candidatos/ }));

    await waitFor(() => expect(submitTrainingStudy).toHaveBeenCalledWith({
      dataset_ref: 'custom:gpa',
      algorithms: ['ridge'],
      search_spaces: { ridge: { alpha: [0.1, 1, 10] } },
    }));
  });

  it('rejects invalid grids and empty selections without calling the BFF', async () => {
    render(<TrainStep task={task({ algorithms: ['ridge'] })} datasetRef="custom:gpa" studyId={null} jobs={[]} jobsError={null} onStudy={vi.fn()} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Regresión Ridge' }));
    expect((screen.getByRole('button', { name: /Entrenar candidatos/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(buildSearchSpaces(['ridge'], { ridge: { alpha: 'mucho' } })).toContain('alpha');
    expect(buildSearchSpaces(['ridge'], { ridge: { alpha: ' ' } })).toEqual({});
    expect(submitTrainingStudy).not.toHaveBeenCalled();
  });

  it('shows the state of every job of the study', () => {
    render(
      <TrainStep
        task={task()}
        datasetRef="custom:gpa"
        studyId="study-1"
        jobs={[job(), job({ job_id: 'j-2', algorithm: 'xgboost', status: 'FAILED', error: { title: 'Grilla inválida' } })]}
        jobsError={null}
        onStudy={vi.fn()}
      />,
    );

    expect(screen.getByText('Completado')).toBeTruthy();
    expect(screen.getByText('Falló')).toBeTruthy();
    expect(screen.getByText('Grilla inválida')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Entrenar otra vez/ })).toBeTruthy();
  });
});
