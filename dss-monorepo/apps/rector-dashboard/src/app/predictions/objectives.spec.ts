import { describe, expect, it } from 'vitest';

import { PREDICTION_OBJECTIVES, describeResult, objectiveFor } from './objectives';

describe('prediction objectives (PRED-108)', () => {
  it('offers dropout, backlog and GPA with the event types Prediction Service accepts', () => {
    expect(PREDICTION_OBJECTIVES.map((objective) => [objective.label, objective.eventType, objective.kind])).toEqual([
      ['Deserción', 'program_dropout', 'classification'],
      ['Rezago', 'student_backlog', 'classification'],
      ['PPA', 'student_gpa', 'regression'],
    ]);
  });

  it('words classification results for the selected objective', () => {
    const backlog = objectiveFor('student_backlog');
    expect(describeResult({ predicted_class: 'POSITIVE_EVENT', event_probability: 0.734 }, backlog)).toEqual({
      outcome: 'Riesgo de rezago',
      detail: '73.4%',
    });
    expect(describeResult({ predicted_class: 'NEGATIVE_EVENT', event_probability: null }, objectiveFor('program_dropout')))
      .toEqual({ outcome: 'Sin riesgo previsto', detail: 'No disponible' });
  });

  it('shows the projected GPA with its 80 % interval', () => {
    const gpa = objectiveFor('student_gpa');
    const row = {
      predicted_class: null,
      event_probability: null,
      predicted_value: 61.25,
      prediction_interval: { '0.8': { lower: 55.5, upper: 67.04 }, '0.95': { lower: 51, upper: 71 } },
    };
    const result = describeResult(row, gpa);
    expect(result.outcome).toBe('61,3');
    expect(result.detail).toBe('80 %: 55,5 – 67,0');
    expect(describeResult({ predicted_value: null }, gpa)).toEqual({ outcome: 'No disponible', detail: '—' });
  });
});
