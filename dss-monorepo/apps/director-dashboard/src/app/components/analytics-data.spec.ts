import { describe, expect, it } from 'vitest';
import {
  readMetric,
  readPeriodSeries,
  resolveDirectorCubePaths,
} from './analytics-data';

const schema = {
  measures: {
    attempts: { name: 'Enrollment Attempts', unit: 'intentos de cursado' },
    average: { name: 'Average Final Grade', unit: 'puntos' },
    graded: { name: 'Graded Attempts', unit: 'calificaciones' },
    privacy: { name: 'Attempt Count', visible: false },
  },
  dimensions: {
    period: {
      name: 'Academic Period',
      hierarchies: {
        period: {
          name: 'Academic Period',
          levels: {
            year: { name: 'Academic Year' },
            number: { name: 'Period Number' },
          },
        },
      },
    },
  },
};

describe('director analytics mapping', () => {
  it('resolves only the published measures and period levels needed by the dashboard', () => {
    expect(resolveDirectorCubePaths(schema)).toEqual({
      enrollmentAttempts: 'Enrollment Attempts',
      averageFinalGrade: 'Average Final Grade',
      gradedAttempts: 'Graded Attempts',
      enrollmentUnit: 'intentos de cursado',
      gradeUnit: 'puntos',
      academicYear: {
        dimension: 'Academic Period',
        hierarchy: 'Academic Period',
        level: 'Academic Year',
      },
      academicPeriod: {
        dimension: 'Academic Period',
        hierarchy: 'Academic Period',
        level: 'Period Number',
      },
    });
    expect(resolveDirectorCubePaths({ ...schema, dimensions: {} })).toBeNull();
  });

  it('maps aggregate cells and sorts period series chronologically', () => {
    expect(
      readMetric(
        [{ 'Enrollment Attempts': { value: '125' } }],
        'Enrollment Attempts',
      ),
    ).toBe(125);
    expect(
      readPeriodSeries(
        [
          {
            'Academic Year': '2025',
            'Period Number': 2,
            'Enrollment Attempts': { value: 9 },
          },
          {
            'Academic Year': '2025',
            'Period Number': 1,
            'Enrollment Attempts': { value: 5 },
          },
        ],
        'Academic Year',
        'Period Number',
        'Enrollment Attempts',
      ),
    ).toEqual([
      { label: '2025 · Periodo 1', value: 5 },
      { label: '2025 · Periodo 2', value: 9 },
    ]);
    expect(readMetric([], 'Enrollment Attempts')).toBeNull();
  });

  it('filters a selected year from the scoped result without adding an OLAP hierarchy filter', () => {
    expect(
      readPeriodSeries(
        [
          {
            'Academic Year': '2025',
            'Period Number': 1,
            'Enrollment Attempts': { value: 5 },
          },
          {
            'Academic Year': '2026',
            'Period Number': 1,
            'Enrollment Attempts': { value: 8 },
          },
        ],
        'Academic Year',
        'Period Number',
        'Enrollment Attempts',
        '2026',
      ),
    ).toEqual([{ label: '2026 · Periodo 1', value: 8 }]);
  });
});
