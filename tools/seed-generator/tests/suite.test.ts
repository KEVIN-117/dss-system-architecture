import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { loadAllCatalogs, resolveCatalogDirectory } from '../dist/loaders/catalogs.js';
import { initializeFaker } from '../dist/utils/discrete-cdf.js';
import { DemographicGenerator } from '../dist/generators/demographics.js';
import { SchoolGenerator } from '../dist/generators/schools.js';
import { AcademicGenerator } from '../dist/generators/academic.js';
import { LongitudinalCohortSimulator } from '../dist/generators/cohorts.js';
import { SqlEmitter } from '../dist/db/sql-emitter.js';
import { validateSafeEnvironment, createSeedMetadata } from '../dist/config/security.js';

describe('Suite de Pruebas Unitarias y de Integración — DATA-001', () => {
  const catalogDir = resolveCatalogDirectory();
  const catalogs = loadAllCatalogs(catalogDir);

  it('1. Determinismo Estricto: Misma semilla produce idéntico dataset', () => {
    // Corrida A
    initializeFaker(9999);
    const demoA = new DemographicGenerator(catalogs.demographic, catalogs.geographic);
    const schoolA = new SchoolGenerator(catalogs.schools);
    const academicA = new AcademicGenerator(catalogs.facultiesAndCareers, catalogs.studyPlansAndCourses, 'test');
    const simA = new LongitudinalCohortSimulator(demoA, schoolA, academicA, catalogs.lookups);
    const resA = simA.simulate(50, 2020, 2022);

    // Corrida B (misma semilla 9999)
    initializeFaker(9999);
    const demoB = new DemographicGenerator(catalogs.demographic, catalogs.geographic);
    const schoolB = new SchoolGenerator(catalogs.schools);
    const academicB = new AcademicGenerator(catalogs.facultiesAndCareers, catalogs.studyPlansAndCourses, 'test');
    const simB = new LongitudinalCohortSimulator(demoB, schoolB, academicB, catalogs.lookups);
    const resB = simB.simulate(50, 2020, 2022);

    assert.equal(resA.uatfDatos.length, resB.uatfDatos.length);
    assert.equal(resA.alumnos.length, resB.alumnos.length);
    assert.equal(resA.notasPlanilla.length, resB.notasPlanilla.length);

    // Comparar los primeros 10 estudiantes
    for (let i = 0; i < 10; i++) {
      assert.equal(resA.uatfDatos[i].id_ra, resB.uatfDatos[i].id_ra);
      assert.equal(resA.uatfDatos[i].nombres, resB.uatfDatos[i].nombres);
      assert.equal(resA.uatfDatos[i].paterno, resB.uatfDatos[i].paterno);
      assert.equal(resA.uatfDatos[i].materno, resB.uatfDatos[i].materno);
      assert.equal(resA.uatfDatos[i].nro_dip, resB.uatfDatos[i].nro_dip);
    }
  });

  it('2. Variabilidad: Diferentes semillas producen diferentes resultados', () => {
    initializeFaker(1111);
    const demo1 = new DemographicGenerator(catalogs.demographic, catalogs.geographic);
    const p1 = demo1.generatePerson('M', 2020);

    initializeFaker(2222);
    const demo2 = new DemographicGenerator(catalogs.demographic, catalogs.geographic);
    const p2 = demo2.generatePerson('M', 2020);

    // Nombres o DIP deben diferir
    assert.notEqual(p1.nro_dip, p2.nro_dip);
  });

  it('3. Guarda de Seguridad: Rechaza terminantemente conexiones a producción', () => {
    assert.throws(
      () => validateSafeEnvironment('db.uatf.edu.bo', 'jachasun'),
      /SECURITY GUARD/
    );
    assert.throws(
      () => validateSafeEnvironment('prod-db.rds.amazonaws.com', 'jachasun'),
      /SECURITY GUARD/
    );
    assert.throws(
      () => validateSafeEnvironment('production-postgres', 'jachasun'),
      /SECURITY GUARD/
    );

    // Entornos locales permitidos
    assert.doesNotThrow(() => validateSafeEnvironment('localhost', 'jachasun'));
    assert.doesNotThrow(() => validateSafeEnvironment('127.0.0.1', 'jachasun'));
    assert.doesNotThrow(() => validateSafeEnvironment('postgres', 'jachasun'));
  });

  it('4. Ausencia de Columnas Fantasma: El SQL no contiene columnas obsoletas', () => {
    initializeFaker(12345);
    const demo = new DemographicGenerator(catalogs.demographic, catalogs.geographic);
    const school = new SchoolGenerator(catalogs.schools);
    const academic = new AcademicGenerator(catalogs.facultiesAndCareers, catalogs.studyPlansAndCourses, 'test');
    const sim = new LongitudinalCohortSimulator(demo, school, academic, catalogs.lookups);
    const res = sim.simulate(30, 2022, 2023);

    const metadata = createSeedMetadata(12345, 'test', 30, 2022, 2023, {});
    const sql = SqlEmitter.generateSql(res, academic, school, metadata);

    // Verificar que las columnas fantasma identificadas NO aparezcan
    assert.ok(!sql.includes('tiempo_estudio smallint'), 'No debe existir tiempo_estudio en alm_programas');
    assert.ok(!sql.includes('estado_postulacion'), 'No debe existir estado_postulacion');
    assert.ok(!sql.includes('nro_impresiones'), 'No debe existir nro_impresiones');
    assert.ok(!sql.includes('id_colegio_sie varchar'), 'No debe existir id_colegio_sie en uatf_datos');
    assert.ok(!sql.includes('_hash varchar'), 'No debe existir _hash en notas_planilla');

    // Comprobar que _tipo_academico = 'CAR' está presente para Apache Hop
    assert.ok(sql.includes("'CAR'"), "Debe incluir '_tipo_academico = CAR' requerido por Apache Hop");

    const cleanSql = SqlEmitter.generateSql(res, academic, school, metadata, true);
    assert.ok(cleanSql.includes("current_database() <> 'jachasun_test'"));
  });

  it('5. Cronología Académica y Regla DSA de Abandono', () => {
    initializeFaker(54321);
    const demo = new DemographicGenerator(catalogs.demographic, catalogs.geographic);
    const school = new SchoolGenerator(catalogs.schools);
    const academic = new AcademicGenerator(catalogs.facultiesAndCareers, catalogs.studyPlansAndCourses, 'test');
    const sim = new LongitudinalCohortSimulator(demo, school, academic, catalogs.lookups);
    const res = sim.simulate(60, 2018, 2024);

    // Alumnos con abandono ('X')
    const dropouts = res.notasPlanilla.filter((n) => n.estado === 'X');
    assert.ok(dropouts.length > 0, 'Debe haber registros de abandono/deserción para alimentar PRED-002');

    // Comprobar que en los abandonos, sparcial es 0 (menos de 2 parciales según regla DSA)
    for (const d of dropouts) {
      assert.equal(d.sparcial, 0, 'En abandono según regla DSA no debe haber 2do parcial');
    }

    // Comprobar créditos > 0 en todas las materias
    for (const c of academic.allCourses) {
      assert.ok(c._creditos > 0, `Materia ${c.sigla} debe tener créditos mayores a 0`);
    }
  });

  it('5a. Ingresos por cohorte respetan el régimen anual y semestral', () => {
    initializeFaker(45678);
    const demo = new DemographicGenerator(catalogs.demographic, catalogs.geographic);
    const school = new SchoolGenerator(catalogs.schools);
    const academic = new AcademicGenerator(catalogs.facultiesAndCareers, catalogs.studyPlansAndCourses, 'test');
    const sim = new LongitudinalCohortSimulator(demo, school, academic, catalogs.lookups);
    const res = sim.simulate(100, 2020, 2020);
    const regimeByProgram = new Map(academic.programs.map((program) => [program.id_programa, program.regime]));
    const firstSemesterIntake = res.postulantes.filter((applicant) => applicant.id_periodo === 1);
    const secondSemesterIntake = res.postulantes.filter((applicant) => applicant.id_periodo === 2);
    const annualIntake = res.postulantes.filter((applicant) => applicant.id_periodo === 3);

    assert.equal(firstSemesterIntake.length, 100);
    assert.equal(secondSemesterIntake.length, 100);
    assert.equal(annualIntake.length, 100);
    assert.equal(new Set(res.uatfDatos.map((person) => person.nro_dip)).size, res.uatfDatos.length);
    assert.ok([...firstSemesterIntake, ...secondSemesterIntake].every((applicant) => regimeByProgram.get(applicant.id_programa) === 'S'));
    assert.ok(annualIntake.every((applicant) => regimeByProgram.get(applicant.id_programa) === 'A'));
    assert.ok(secondSemesterIntake.every((applicant) => applicant.fec_inscripcion.startsWith('2020-07-')));
    assert.ok(annualIntake.every((applicant) => applicant.fec_inscripcion.startsWith('2020-01-')));
  });

  it('6. Integridad Topológica: Materias Ciclo 1 no tienen padre y Ciclo 2+ tienen padre', () => {
    const academic = new AcademicGenerator(catalogs.facultiesAndCareers, catalogs.studyPlansAndCourses, 'test');

    for (const c of academic.coursesLevel1) {
      assert.equal(c.id_materia_padre, null, `Materia ciclo 1 ${c.sigla} debe tener id_materia_padre NULL`);
    }

    // En coursesLevel2Plus, al menos las materias que tienen prerrequisitos deben tener id_materia_padre asignado
    const withPrereqs = academic.coursesLevel2Plus.filter((c) => c.prerrequisitos && c.prerrequisitos.length > 0);
    assert.ok(withPrereqs.length > 0, 'Debe haber materias de ciclo superior con prerrequisitos asignados');
    for (const c of withPrereqs) {
      assert.ok(c.id_materia_padre !== null, `Materia ${c.sigla} debe tener id_materia_padre resuelto`);
    }
  });
});
