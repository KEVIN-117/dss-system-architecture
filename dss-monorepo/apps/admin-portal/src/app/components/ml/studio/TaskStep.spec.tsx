import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TaskStep } from './TaskStep';
import { TASKS } from './test-fixtures';

describe('TaskStep', () => {
  it('groups the catalog by what each row describes', () => {
    render(<TaskStep tasks={TASKS} selectedCode={null} onSelect={vi.fn()} />);

    const student = screen.getByRole('region', { name: 'Estudiante' });
    expect(within(student).getByText('PPA del próximo corte')).toBeTruthy();
    expect(within(student).getByText('Deserción de carrera')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Matrícula' })).getByText('Reprobación de materia')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Pronóstico' })).getByText('Postulaciones por carrera')).toBeTruthy();
  });

  it('selects a classification or regression target', () => {
    const onSelect = vi.fn();
    render(<TaskStep tasks={TASKS} selectedCode="COURSE_FAILURE" onSelect={onSelect} />);

    expect(screen.getByRole('button', { name: /Reprobación de materia/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /PPA del próximo corte/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ code: 'STUDENT_GPA_NEXT_CUT' }));
  });

  it('sends forecast targets to the forecasts page', () => {
    render(<TaskStep tasks={TASKS} selectedCode={null} onSelect={vi.fn()} />);

    expect(screen.getByRole('link', { name: /Postulaciones por carrera/ }).getAttribute('href'))
      .toBe('/ml-forecasts?series=APPLICATIONS_BY_PROGRAM');
  });
});
