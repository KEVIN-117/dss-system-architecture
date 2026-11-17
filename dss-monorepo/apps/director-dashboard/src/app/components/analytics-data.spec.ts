import { describe, expect, it } from 'vitest';
import {
  readMetric,
  readPeriodSeries,
  resolveDirectorCubePaths,
} from './analytics-data';

const schema = {
  measures: {
    attempts: { name: 'Inscripciones en materias', unit: 'intentos de cursado' },
    average: { name: 'Nota promedio', unit: 'puntos' },
    graded: { name: 'Inscripciones con resultado', unit: 'calificaciones' },
    privacy: { name: 'Conteo de privacidad', visible: false },
  },
  dimensions: {
    period: {
      name: 'Periodo',
      hierarchies: {
        period: {
          name: 'Gestión y periodo',
          levels: {
            year: { name: 'Gestión' },
            number: { name: 'Periodo' },
          },
        },
      },
    },
  },
};

describe('director analytics mapping', () => {
  it('resolves only the published measures and period levels needed by the dashboard', () => {
    expect(resolveDirectorCubePaths(schema)).toEqual({
      enrollmentAttempts: 'Inscripciones en materias',
      averageFinalGrade: 'Nota promedio',
      gradedAttempts: 'Inscripciones con resultado',
      enrollmentUnit: 'intentos de cursado',
      gradeUnit: 'puntos',
      academicYear: {
        dimension: 'Periodo',
        hierarchy: 'Gestión y periodo',
        level: 'Gestión',
      },
      academicPeriod: {
        dimension: 'Periodo',
        hierarchy: 'Gestión y periodo',
        level: 'Periodo',
      },
    });
    expect(resolveDirectorCubePaths({ ...schema, dimensions: {} })).toBeNull();
  });

  it('maps aggregate cells and sorts period series chronologically', () => {
    expect(
      readMetric(
        [{ 'Inscripciones en materias': { value: '125' } }],
        'Inscripciones en materias',
      ),
    ).toBe(125);
    expect(
      readPeriodSeries(
        [
          {
            'Gestión': '2025',
            'Periodo': 2,
            'Inscripciones en materias': { value: 9 },
          },
          {
            'Gestión': '2025',
            'Periodo': 1,
            'Inscripciones en materias': { value: 5 },
          },
        ],
        'Gestión',
        'Periodo',
        'Inscripciones en materias',
      ),
    ).toEqual([
      { label: '2025 · Periodo 1', value: 5 },
      { label: '2025 · Periodo 2', value: 9 },
    ]);
    expect(readMetric([], 'Inscripciones en materias')).toBeNull();
  });

  it('filters a selected year from the scoped result without adding an OLAP hierarchy filter', () => {
    expect(
      readPeriodSeries(
        [
          {
            'Gestión': '2025',
            'Periodo': 1,
            'Inscripciones en materias': { value: 5 },
          },
          {
            'Gestión': '2026',
            'Periodo': 1,
            'Inscripciones en materias': { value: 8 },
          },
        ],
        'Gestión',
        'Periodo',
        'Inscripciones en materias',
        '2026',
      ),
    ).toEqual([{ label: '2026 · Periodo 1', value: 8 }]);
  });
});
