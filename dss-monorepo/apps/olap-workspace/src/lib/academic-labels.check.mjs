import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { academicLabel, chartLabel, isUatfCube, measureDescription } from './academic-labels.ts';

test('shows Spanish identifiers as they are and keeps old English names readable', () => {
  assert.equal(academicLabel('Admisión'), 'Admisión');
  assert.equal(academicLabel('Tasa de admisión'), 'Tasa de admisión');
  assert.equal(academicLabel('Academic Admission'), 'Admisión');
  assert.equal(academicLabel('Applicant Profile - Gender'), 'Perfil del estudiante · Sexo');
  assert.equal(academicLabel('Admitted Applicants'), 'Admitidos');
  assert.equal(academicLabel('Colegio San Luis'), 'Colegio San Luis');
});

test('describes published measures in plain Spanish', () => {
  assert.match(measureDescription('Estudiantes nuevos') ?? '', /primera vez/);
  assert.equal(measureDescription('Medida desconocida'), null);
});

test('recognizes only the UATF catalog and schema and translates chart controls', () => {
  assert.equal(isUatfCube({ catalog: 'UATF_DW', schema: 'UATF_DW' }), true);
  assert.equal(isUatfCube({ catalog: 'Otro', schema: 'UATF_DW' }), false);
  assert.equal(chartLabel('Donut'), 'Dona');
});
