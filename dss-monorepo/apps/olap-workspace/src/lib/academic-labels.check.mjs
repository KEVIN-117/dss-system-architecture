import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { academicLabel, chartLabel, isUatfCube } from './academic-labels.ts';

test('translates known academic captions without changing unknown values or identifiers', () => {
  assert.equal(academicLabel('Academic Admission'), 'Admisión académica');
  assert.equal(
    academicLabel('Applicant Profile - Gender'),
    'Perfil del postulante · Género',
  );
  assert.equal(academicLabel('Admitted Applicants'), 'Postulantes admitidos');
  assert.equal(
    academicLabel('All By School Types'),
    'Todos los tipos de colegio',
  );
  assert.equal(
    academicLabel('[Academic Program].[Program]'),
    '[Academic Program].[Program]',
  );
  assert.equal(academicLabel('Colegio San Luis'), 'Colegio San Luis');
});

test('recognizes only the UATF catalog and schema and translates chart controls', () => {
  assert.equal(isUatfCube({ catalog: 'UATF_DW', schema: 'UATF_DW' }), true);
  assert.equal(isUatfCube({ catalog: 'Otro', schema: 'UATF_DW' }), false);
  assert.equal(chartLabel('Donut'), 'Dona');
});
