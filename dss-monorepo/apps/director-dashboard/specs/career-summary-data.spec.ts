import { CAREER_RULES, attentionFor, facultyYearSeries, mergeCareers } from '@dss-monorepo/academic-analytics/panel';

const C = '[Programa].[Facultad y carrera].[Carrera]';
const M = '[Materia].[Nivel y materia].[Materia]';
const Y = '[Periodo].[Gestión y periodo].[Gestión]';

describe('career summary data', () => {
  it('keeps only the selected career when the director governs several', () => {
    const rows = [
      { [C]: 'INGENIERIA CIVIL', [Y]: '2021', 'Tasa de aprobación': 0.6 },
      { [C]: 'INGENIERIA MINERA', [Y]: '2021', 'Tasa de aprobación': 0.9 },
    ];
    const series = facultyYearSeries(rows, 'Rendimiento académico', 'INGENIERIA CIVIL', 'Carrera', 'Gestión');
    expect(series.get('2021')).toMatchObject({ passRate: 0.6 });
  });

  it('lists the subjects of one career and keeps homonymous subjects apart', () => {
    const subjects = mergeCareers(
      [
        {
          cube: 'Rendimiento académico',
          rows: [
            { [C]: 'INGENIERIA CIVIL', [M]: 'FISICA I', 'Tasa de reprobación': 0.7 },
            { [C]: 'INGENIERIA CIVIL', [M]: 'FISICA I', 'Tasa de reprobación': 0.5 },
            { [C]: 'INGENIERIA MINERA', [M]: 'GEOLOGIA', 'Tasa de reprobación': 0.2 },
          ],
        },
      ],
      'INGENIERIA CIVIL',
      'Carrera',
      'Materia',
    );
    expect(subjects.map((s) => [s.career, s.values.failRate])).toEqual([
      ['FISICA I', 0.7],
      ['FISICA I (2)', 0.5],
    ]);
  });

  it('flags subjects whose failure or repetition exceeds the career by more than 5 points', () => {
    const career = { failRate: 0.3, repetitionRate: 0.2 };
    expect(attentionFor({ failRate: 0.36, repetitionRate: 0.26 }, career, CAREER_RULES).map((f) => f.key)).toEqual([
      'failRate',
      'repetitionRate',
    ]);
    expect(attentionFor({ failRate: 0.34, repetitionRate: 0.1 }, career, CAREER_RULES)).toEqual([]);
  });
});
