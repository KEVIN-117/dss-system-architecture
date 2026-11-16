import { describe, expect, it } from 'vitest';
import {
  readDimensionSeries,
  readDimensionSeriesByLevels,
  readMetric,
  readPublishedMembers,
  resolveAcademicCubePaths,
  resolveRetentionPaths,
  sortAcademicPeriods,
} from './analytics-data';

const schema = {
  measures: {
    'enrollment attempts': { name: 'Inscripciones en materias', unit: 'intentos' },
    'average final grade': { name: 'Nota promedio', unit: 'puntos' },
    'attempt count': { name: 'Conteo de privacidad', visible: false },
  },
  dimensions: {
    'academic program': {
      name: 'Programa',
      hierarchies: {
        program: { name: 'Facultad y carrera', levels: { faculty: { name: 'Facultad' }, career: { name: 'Carrera' } } },
      },
    },
    'academic period': {
      name: 'Periodo',
      hierarchies: {
        'academic period': { name: 'Gestión y periodo', levels: { year: { name: 'Gestión' }, period: { name: 'Periodo' } } },
      },
    },
  },
};

describe('Rector cube data mapping', () => {
  it('resolves measures and axes from the published schema, ignoring hidden measures', () => {
    expect(resolveAcademicCubePaths(schema)).toEqual({
      enrollmentAttempts: 'Inscripciones en materias',
      averageFinalGrade: 'Nota promedio',
      enrollmentUnit: 'intentos',
      gradeUnit: 'puntos',
      academicYear: { dimension: 'Periodo', hierarchy: 'Gestión y periodo', level: 'Gestión' },
      academicPeriod: { dimension: 'Periodo', hierarchy: 'Gestión y periodo', level: 'Periodo' },
      faculty: { dimension: 'Programa', hierarchy: 'Facultad y carrera', level: 'Facultad' },
    });
    expect(resolveAcademicCubePaths({ ...schema, dimensions: {} })).toBeNull();
  });

  it('resolves the permanence cube on the published Gestión y periodo hierarchy', () => {
    const retentionSchema = {
      ...schema,
      measures: {
        evaluated: { name: 'Estudiantes evaluados' },
        retained: { name: 'Permanecen' },
        privacy: { name: 'Conteo de privacidad', visible: false },
      },
    };
    expect(resolveRetentionPaths(retentionSchema)).toEqual({
      year: { dimension: 'Periodo', hierarchy: 'Gestión y periodo', level: 'Gestión' },
      retained: 'Permanecen',
      evaluable: 'Estudiantes evaluados',
    });
    expect(resolveRetentionPaths({ ...retentionSchema, measures: {} })).toBeNull();
  });

  it('maps aggregate OLAP cells and published member options without inventing values', () => {
    expect(readMetric([{ 'Inscripciones en materias': { value: '1280' } }], 'Inscripciones en materias')).toBe(1280);
    expect(readDimensionSeries([
      { Faculty: 'Ciencias Puras', 'Inscripciones en materias': { value: 18 } },
      { Faculty: 'Ingeniería', 'Inscripciones en materias': 35 },
    ], 'Faculty', 'Inscripciones en materias')).toEqual([
      { label: 'Ciencias Puras', value: 18 },
      { label: 'Ingeniería', value: 35 },
    ]);
    expect(readDimensionSeriesByLevels([
      { 'Gestión': '2025', 'Periodo': 2, 'Inscripciones en materias': { value: 31 } },
    ], ['Gestión', 'Periodo'], 'Inscripciones en materias')).toEqual([
      { label: '2025 · 2', value: 31 },
    ]);
    expect(sortAcademicPeriods([{ label: '2025 · 2', value: 1 }, { label: '2025 · 1', value: 2 }]).map(({ label }) => label))
      .toEqual(['2025 · 1', '2025 · 2']);
    expect(readPublishedMembers([
      { name: '2025', uniqueName: '[Year].&[2025]', caption: 'Gestión 2025' },
      { name: 'unsafe' },
    ])).toEqual([{ name: '2025', uniqueName: '[Year].&[2025]', caption: 'Gestión 2025' }]);
  });
});
