import {
  attentionFor,
  deltaOf,
  facultiesIn,
  facultyYearSeries,
  mergeCareers,
  previousYear,
} from '@dss-monorepo/academic-analytics/panel';

const F = '[Programa].[Facultad y carrera].[Facultad]';
const C = '[Programa].[Facultad y carrera].[Carrera]';
const Y = '[Periodo].[Gestión y periodo].[Gestión]';

describe('faculty summary data', () => {
  it('lists the faculties in scope, ignoring empty members', () => {
    const rows = [{ [F]: 'MEDICINA' }, { [F]: 'INGENIERIA' }, { [F]: '#null' }, { [F]: 'MEDICINA' }];
    expect(facultiesIn(rows, 'Facultad')).toEqual(['INGENIERIA', 'MEDICINA']);
  });

  it('keeps only the selected faculty when building its series', () => {
    const rows = [
      { [F]: 'MEDICINA', [Y]: '2020', Postulaciones: 100, 'Tasa de admisión': 0.5 },
      { [F]: 'MEDICINA', [Y]: '2021', Postulaciones: 120, 'Tasa de admisión': 0.6 },
      { [F]: 'INGENIERIA', [Y]: '2021', Postulaciones: 999, 'Tasa de admisión': 0.9 },
    ];
    const series = facultyYearSeries(rows, 'Admisión', 'MEDICINA', 'Facultad', 'Gestión');
    expect([...series.keys()]).toEqual(['2020', '2021']);
    expect(series.get('2021')).toMatchObject({ applications: 120, admissionRate: 0.6 });
  });

  it('merges careers of one faculty across cubes', () => {
    const careers = mergeCareers(
      [
        { cube: 'Admisión', rows: [{ [F]: 'MEDICINA', [C]: 'ENFERMERIA', Postulaciones: 40 }] },
        {
          cube: 'Rendimiento académico',
          rows: [
            { [F]: 'MEDICINA', [C]: 'ENFERMERIA', 'Tasa de aprobación': 0.7 },
            { [F]: 'INGENIERIA', [C]: 'CIVIL', 'Tasa de aprobación': 0.4 },
          ],
        },
      ],
      'MEDICINA',
      'Facultad',
      'Carrera',
    );
    expect(careers).toEqual([{ career: 'ENFERMERIA', values: expect.objectContaining({ applications: 40, passRate: 0.7 }) }]);
  });

  it('reports rate deltas in points and count deltas relative to the previous year', () => {
    expect(deltaOf(0.62, 0.6, 'percent')).toBeCloseTo(0.02);
    expect(deltaOf(120, 100, 'count')).toBeCloseTo(0.2);
    expect(deltaOf(120, 0, 'count')).toBeNull();
    expect(deltaOf(null, 100, 'count')).toBeNull();
    expect(previousYear(['2019', '2020', '2021'], '2021')).toBe('2020');
    expect(previousYear(['2019'], '2019')).toBeNull();
  });

  it('flags careers more than 5 points worse than the faculty and ignores missing data', () => {
    const faculty = { passRate: 0.7, dropoutRate: 0.1 };
    expect(attentionFor({ passRate: 0.64, dropoutRate: 0.16 }, faculty).map((f) => f.key)).toEqual(['passRate', 'dropoutRate']);
    expect(attentionFor({ passRate: 0.66, dropoutRate: 0.14 }, faculty)).toEqual([]);
    expect(attentionFor({ passRate: null, dropoutRate: undefined }, faculty)).toEqual([]);
  });
});
