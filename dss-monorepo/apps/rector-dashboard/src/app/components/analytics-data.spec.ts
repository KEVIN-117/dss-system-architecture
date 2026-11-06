import { describe, expect, it } from 'vitest';
import {
  readDimensionSeries,
  readDimensionSeriesByLevels,
  readMetric,
  readPublishedMembers,
  resolveAcademicCubePaths,
  sortAcademicPeriods,
} from './analytics-data';

const schema = {
  measures: {
    'enrollment attempts': { name: 'Enrollment Attempts', unit: 'intentos' },
    'average final grade': { name: 'Average Final Grade', unit: 'puntos' },
    'attempt count': { name: 'Attempt Count', visible: false },
  },
  dimensions: {
    'academic program': {
      name: 'Academic Program',
      hierarchies: {
        program: { name: 'Program', levels: { faculty: { name: 'Faculty' }, career: { name: 'Career' } } },
      },
    },
    'academic period': {
      name: 'Academic Period',
      hierarchies: {
        'academic period': { name: 'Academic Period', levels: { year: { name: 'Academic Year' }, period: { name: 'Period Number' } } },
      },
    },
  },
};

describe('Rector cube data mapping', () => {
  it('resolves measures and axes from the published schema, ignoring hidden measures', () => {
    expect(resolveAcademicCubePaths(schema)).toEqual({
      enrollmentAttempts: 'Enrollment Attempts',
      averageFinalGrade: 'Average Final Grade',
      enrollmentUnit: 'intentos',
      gradeUnit: 'puntos',
      academicYear: { dimension: 'Academic Period', hierarchy: 'Academic Period', level: 'Academic Year' },
      academicPeriod: { dimension: 'Academic Period', hierarchy: 'Academic Period', level: 'Period Number' },
      faculty: { dimension: 'Academic Program', hierarchy: 'Program', level: 'Faculty' },
    });
    expect(resolveAcademicCubePaths({ ...schema, dimensions: {} })).toBeNull();
  });

  it('maps aggregate OLAP cells and published member options without inventing values', () => {
    expect(readMetric([{ 'Enrollment Attempts': { value: '1280' } }], 'Enrollment Attempts')).toBe(1280);
    expect(readDimensionSeries([
      { Faculty: 'Ciencias Puras', 'Enrollment Attempts': { value: 18 } },
      { Faculty: 'Ingeniería', 'Enrollment Attempts': 35 },
    ], 'Faculty', 'Enrollment Attempts')).toEqual([
      { label: 'Ciencias Puras', value: 18 },
      { label: 'Ingeniería', value: 35 },
    ]);
    expect(readDimensionSeriesByLevels([
      { 'Academic Year': '2025', 'Period Number': 2, 'Enrollment Attempts': { value: 31 } },
    ], ['Academic Year', 'Period Number'], 'Enrollment Attempts')).toEqual([
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
