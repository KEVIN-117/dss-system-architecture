import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ObjectiveSelector } from './objective-selector';

afterEach(cleanup);

describe('ObjectiveSelector', () => {
  it('marks the selected objective and reports the chosen one', () => {
    const onChange = vi.fn();
    render(<ObjectiveSelector value="program_dropout" onChange={onChange} />);

    const options = screen.getAllByRole('radio');
    expect(options.map((option) => option.textContent)).toEqual(['Deserción', 'Rezago', 'PPA']);
    expect(screen.getByRole('radio', { name: 'Deserción' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'PPA' }).getAttribute('aria-checked')).toBe('false');

    fireEvent.click(screen.getByRole('radio', { name: 'PPA' }));
    expect(onChange).toHaveBeenCalledWith('student_gpa');
  });

  it('can be disabled while a request is in flight', () => {
    render(<ObjectiveSelector value="student_backlog" onChange={vi.fn()} disabled />);
    expect(screen.getAllByRole('radio').every((option) => (option as HTMLButtonElement).disabled)).toBe(true);
  });
});
