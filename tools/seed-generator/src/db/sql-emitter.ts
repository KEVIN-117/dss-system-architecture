import fs from 'node:fs';
import path from 'node:path';
import type { SimulationResult } from '../generators/cohorts.js';
import type { AcademicGenerator } from '../generators/academic.js';
import type { SchoolGenerator } from '../generators/schools.js';
import type { SeedMetadata } from '../config/security.js';

export class SqlEmitter {
  /**
   * Genera el contenido SQL completo estructurado en 8 niveles topológicos.
   */
  public static generateSql(
    simulation: SimulationResult,
    academicGen: AcademicGenerator,
    schoolGen: SchoolGenerator,
    metadata: SeedMetadata,
    clean = false
  ): string {
    const lines: string[] = [];

    lines.push('-- ============================================================================');
    lines.push(`-- UATF SYNTHETIC SEED DATASET (DATA-001 / Issue #206)`);
    lines.push(`-- Generated At: ${metadata.generated_at}`);
    lines.push(`-- Seed: ${metadata.seed} | Profile: ${metadata.profile} | Faker: v${metadata.faker_version}`);
    lines.push(`-- Notice: ${metadata.notice}`);
    lines.push('-- ============================================================================');
    lines.push('');
    lines.push('BEGIN;');
    lines.push('');

    if (clean) {
      lines.push('-- ----------------------------------------------------------------------------');
      lines.push('-- LIMPIEZA CONTROLADA DE TABLAS OLTP (Orden inverso de dependencias)');
      lines.push('-- ----------------------------------------------------------------------------');
      lines.push(`DO $$ BEGIN
  IF current_database() <> 'jachasun_test' THEN
    RAISE EXCEPTION 'La opción --clean solo puede ejecutarse en jachasun_test (base actual: %)', current_database();
  END IF;
END $$;`);
      lines.push('TRUNCATE TABLE actas_graduacion.graduados CASCADE;');
      lines.push('TRUNCATE TABLE academico.notas_planilla CASCADE;');
      lines.push('TRUNCATE TABLE academico.alm_programaciones CASCADE;');
      lines.push('TRUNCATE TABLE public.valores_transacciones CASCADE;');
      lines.push('TRUNCATE TABLE public.cajas_transacciones CASCADE;');
      lines.push('TRUNCATE TABLE public.matriculas CASCADE;');
      lines.push('TRUNCATE TABLE academico.alumnos CASCADE;');
      lines.push('TRUNCATE TABLE public.postulantes CASCADE;');
      lines.push('TRUNCATE TABLE public.uatf_datos CASCADE;');
      lines.push('TRUNCATE TABLE academico.dct_asignaciones CASCADE;');
      lines.push('TRUNCATE TABLE academico.docentes CASCADE;');
      lines.push('TRUNCATE TABLE academico.pln_materias CASCADE;');
      lines.push('TRUNCATE TABLE public.prs_colegios CASCADE;');
      lines.push('TRUNCATE TABLE public.fac_programas CASCADE;');
      lines.push('TRUNCATE TABLE academico.alm_programas CASCADE;');
      lines.push('');
    }

    // =========================================================================
    // NIVEL 0: CATÁLOGOS RAÍZ
    // =========================================================================
    lines.push('-- ----------------------------------------------------------------------------');
    lines.push('-- NIVEL 0: CATÁLOGOS RAÍZ INDEPENDIENTES');
    lines.push('-- ----------------------------------------------------------------------------');
    lines.push(`
INSERT INTO public.prs_pais_v2 (id_pais, cod_pais, pais, sigla, nacionalidad, cod_numerico, _registrado, _modificado, _estado)
VALUES (27, '01', 'BOLIVIA', 'BOL', 'BOLIVIANA', 68, now(), now(), 'A')
ON CONFLICT (id_pais) DO NOTHING;

INSERT INTO public._bp_estados_civiles (id_estado_civil, estado_civil, _registrado, _modificado, _estado)
VALUES
  (1, 'SOLTERO/A', now(), now(), 'A'),
  (2, 'CASADO/A', now(), now(), 'A'),
  (3, 'DIVORCIADO/A', now(), now(), 'A'),
  (4, 'VIUDO/A', now(), now(), 'A')
ON CONFLICT (id_estado_civil) DO NOTHING;

INSERT INTO public.prs_calificacion (id_calificacion, calificacion, _registrado, _modificado, _estado)
VALUES
  ('1', 'FISCAL', now(), now(), 'A'),
  ('2', 'PARTICULAR', now(), now(), 'A'),
  ('3', 'CONVENIO', now(), now(), 'A'),
  ('4', 'INSTITUTO', now(), now(), 'A')
ON CONFLICT (id_calificacion) DO NOTHING;

INSERT INTO public.prs_examen (id_examen, examen)
VALUES
  (1, 'PRUEBA DE SUFICIENCIA ACADEMICA (PSA)'),
  (2, 'CURSO PREUNIVERSITARIO'),
  (3, 'EXCELENCIA ACADEMICA'),
  (5, 'BECA BACHILLER')
ON CONFLICT (id_examen) DO NOTHING;

INSERT INTO academico.carreras_tipos (tipo_c, tipo)
VALUES ('C', 'CARRERA'), ('P', 'PROGRAMA')
ON CONFLICT (tipo_c) DO NOTHING;

INSERT INTO academico.sedes (id_sede, sede, tipo, nom_sede)
VALUES
  ('1', 'POTOSI', 'C', 'POTOSI'),
  ('2', 'VILLAZON', 'P', 'VILLAZON'),
  ('3', 'TUPIZA', 'P', 'TUPIZA'),
  ('4', 'UYUNI', 'P', 'UYUNI'),
  ('5', 'UNCIA', 'P', 'UNCIA'),
  ('6', 'BETANZOS', 'P', 'BETANZOS'),
  ('7', 'COTAGAITA', 'P', 'COTAGAITA'),
  ('8', 'SAN CRISTOBAL', 'P', 'SAN CRISTOBAL')
ON CONFLICT (id_sede) DO NOTHING;

INSERT INTO academico.alumnos_estados (estado, descripcion, visible, estado_original)
VALUES
  ('P', 'REGULAR/ACTIVO', true, 'REG'),
  ('A', 'EGRESADO', true, 'EGR'),
  ('T', 'TITULADO', true, 'TIT'),
  ('B', 'BLOQUEADO', false, 'BLO'),
  ('X', 'ANULADO/DESERTOR', false, 'ANU')
ON CONFLICT (estado) DO NOTHING;

INSERT INTO academico.periodos (id_periodo, periodo)
VALUES
  (0, 'CURSO DE VERANO'),
  (1, 'PRIMER SEMESTRE'),
  (2, 'SEGUNDO SEMESTRE'),
  (3, 'ANUAL')
ON CONFLICT (id_periodo) DO NOTHING;

INSERT INTO academico.docentes_tiempo (tiempo, descripcion)
VALUES
  ('TC', 'TIEMPO COMPLETO'),
  ('MT', 'MEDIO TIEMPO'),
  ('TH', 'TIEMPO HORARIO')
ON CONFLICT (tiempo) DO NOTHING;
`);

    // Facultades
    lines.push('-- Facultades UATF');
    const facRows = academicGen.faculties
      .map((f) => `(${f.id_facultad}, '${f.facultad.replace(/'/g, "''")}', '${f.facu_abre.replace(/'/g, "''")}')`)
      .join(',\n  ');
    lines.push(`
INSERT INTO academico.alm_programas_facultades (id_facultad, facultad, facu_abre)
VALUES
  ${facRows}
ON CONFLICT (id_facultad) DO NOTHING;
`);

    // =========================================================================
    // NIVEL 1: DEPARTAMENTOS, PERIODOS REFLEXIVOS Y PROGRAMAS ACADÉMICOS
    // =========================================================================
    lines.push('-- ----------------------------------------------------------------------------');
    lines.push('-- NIVEL 1: DEPARTAMENTOS, PERIODOS REFLEXIVOS Y PROGRAMAS ACADÉMICOS');
    lines.push('-- ----------------------------------------------------------------------------');
    lines.push(`
INSERT INTO public.lugar_departamento (cod_dep, departamento, sigla, cod_pais)
VALUES
  (1, 'CHUQUISACA', 'CH', 27),
  (2, 'LA PAZ', 'LP', 27),
  (3, 'COCHABAMBA', 'CB', 27),
  (4, 'ORURO', 'OR', 27),
  (5, 'POTOSI', 'PT', 27),
  (6, 'TARIJA', 'TJ', 27),
  (7, 'SANTA CRUZ', 'SC', 27),
  (8, 'BENI', 'BN', 27),
  (9, 'PANDO', 'PA', 27)
ON CONFLICT (cod_dep) DO NOTHING;

INSERT INTO academico.alm_periodos (id_periodo, periodo, id_periodo_relacion, _unique)
VALUES
  (1, 'PRIMER SEMESTRE', 1, 1),
  (2, 'SEGUNDO SEMESTRE', 2, 2),
  (3, 'GESTION ANUAL', 3, 1)
ON CONFLICT (id_periodo) DO NOTHING;
`);

    // Carreras / Programas en academico.alm_programas y public.fac_programas
    const progRowsAlm: string[] = [];
    const progRowsFac: string[] = [];
    for (const p of academicGen.programs) {
      const progName = p.name || p.programa;
      const idFac = p.id_facultad_numeric || 1;
      const sede = p.id_sede ? p.id_sede.toString() : '1';
      const regimen = p.regime || 'S';

      progRowsAlm.push(
        `('${p.id_programa}', '${progName.replace(/'/g, "''")}', ${idFac}, ${idFac}, 'A', 'CAR', '${sede}', '${p.id_programa}', 4, 51, 40, 1, 2, 'NORMAL', true, 1)`
      );
      progRowsFac.push(
        `('${p.id_programa}', '${progName.replace(/'/g, "''")}', '${idFac}', '${regimen}', ${p.duration_years || 5}, 'A', ${parseInt(sede, 10) || 1})`
      );
    }

    lines.push(`
INSERT INTO academico.alm_programas (
  id_programa, programa, facultad, id_facultad, activo, _tipo_academico,
  sede, pabreviacion, num_parc, nota_minima, nota_2do_habilitacion,
  id_edificio, nro_max_arrastres, tipo_cobro, _tiene_examen_mesa, moodle
) VALUES
  ${progRowsAlm.join(',\n  ')}
ON CONFLICT (id_programa) DO NOTHING;

INSERT INTO public.fac_programas (id_programa, programa, id_facultad, tipo_c, tiempo_estudio, activo, id_sede)
VALUES
  ${progRowsFac.join(',\n  ')}
ON CONFLICT (id_programa) DO NOTHING;
`);

    // =========================================================================
    // NIVEL 2: PROVINCIAS, DOCENTES Y MATERIAS NIVEL 1 (id_materia_padre = NULL)
    // =========================================================================
    lines.push('-- ----------------------------------------------------------------------------');
    lines.push('-- NIVEL 2: PROVINCIAS, DOCENTES Y MATERIAS CICLO 1');
    lines.push('-- ----------------------------------------------------------------------------');
    lines.push(`
INSERT INTO public.lugar_provincia (cod_prov, cod_dep, provincia, cod_pais, cod_prov_2)
VALUES
  (1, 5, 'TOMAS FRIAS', 27, 1),
  (2, 5, 'RAFAEL BUSTILLO', 27, 2),
  (3, 5, 'SUD CHICHAS', 27, 3),
  (4, 5, 'NOR CHICHAS', 27, 4),
  (5, 5, 'ANTONIO QUIJARRO', 27, 5),
  (6, 5, 'CORNELIO SAAVEDRA', 27, 6),
  (7, 5, 'CHARCAS', 27, 7),
  (8, 5, 'CHAYANTA', 27, 8)
ON CONFLICT (cod_prov) DO NOTHING;
`);

    // Docentes
    const docRows = academicGen.teachers
      .map(
        (d) =>
          `(${d.id_docente}, '${d.nombres}', '${d.paterno}', '${d.materno}', '${d.clave}', '${d.estado}', '${d.ci}', '${d.id_programa}', '${d.tiempo}', '${d.usuario}')`
      )
      .join(',\n  ');
    lines.push(`
INSERT INTO academico.docentes (id_docente, nombres, paterno, materno, clave, estado, ci, id_programa, tiempo, usuario)
VALUES
  ${docRows}
ON CONFLICT (id_docente) DO NOTHING;
`);

    // Materias Ciclo 1
    const m1Rows = academicGen.coursesLevel1
      .map(
        (m) =>
          `(${m.id_materia}, '${m.sigla}', '${m.materia.replace(/'/g, "''")}', ${m.hrs_teoricas}, ${m.hrs_practicas}, ${m.ciclo}, '${m.id_programa}', 2018, ${m._creditos}, NULL, 51, '${m.materia_graduacion}', 'REGISTRADO')`
      )
      .join(',\n  ');
    lines.push(`
INSERT INTO academico.pln_materias (
  id_materia, sigla, materia, hrs_teoricas, hrs_practicas, ciclo,
  id_programa, id_plan, _creditos, id_materia_padre, nota_minima, materia_graduacion, _estado
) VALUES
  ${m1Rows}
ON CONFLICT (id_materia) DO NOTHING;
`);

    // =========================================================================
    // NIVEL 3: LOCALIDADES Y MATERIAS CICLO 2+ (id_materia_padre vinculado)
    // =========================================================================
    lines.push('-- ----------------------------------------------------------------------------');
    lines.push('-- NIVEL 3: LOCALIDADES Y MATERIAS CICLOS 2 AL 10 (CON PRERREQUISITOS)');
    lines.push('-- ----------------------------------------------------------------------------');
    lines.push(`
INSERT INTO public.lugar_localidad (cod_loc, cod_prov, cod_dep, cod_pais, localidad, _registrado, _estado)
VALUES
  (1, 1, 5, 27, 'POTOSI', now(), 'A'),
  (2, 5, 5, 27, 'UYUNI', now(), 'A'),
  (3, 3, 5, 27, 'TUPIZA', now(), 'A'),
  (4, 3, 5, 27, 'VILLAZON', now(), 'A'),
  (5, 6, 5, 27, 'BETANZOS', now(), 'A'),
  (6, 2, 5, 27, 'UNCIA', now(), 'A'),
  (7, 2, 5, 27, 'LLALLAGUA', now(), 'A')
ON CONFLICT (cod_loc) DO NOTHING;
`);

    if (academicGen.coursesLevel2Plus.length > 0) {
      const m2Rows = academicGen.coursesLevel2Plus
        .map(
          (m) =>
            `(${m.id_materia}, '${m.sigla}', '${m.materia.replace(/'/g, "''")}', ${m.hrs_teoricas}, ${m.hrs_practicas}, ${m.ciclo}, '${m.id_programa}', 2018, ${m._creditos}, ${m.id_materia_padre ? m.id_materia_padre : 'NULL'}, 51, '${m.materia_graduacion}', 'REGISTRADO')`
        )
        .join(',\n  ');
      lines.push(`
INSERT INTO academico.pln_materias (
  id_materia, sigla, materia, hrs_teoricas, hrs_practicas, ciclo,
  id_programa, id_plan, _creditos, id_materia_padre, nota_minima, materia_graduacion, _estado
) VALUES
  ${m2Rows}
ON CONFLICT (id_materia) DO NOTHING;
`);
    }

    // =========================================================================
    // NIVEL 4: COLEGIOS (SIE) Y ASIGNACIONES DOCENTES
    // =========================================================================
    lines.push('-- ----------------------------------------------------------------------------');
    lines.push('-- NIVEL 4: COLEGIOS Y ASIGNACIONES DOCENTES');
    lines.push('-- ----------------------------------------------------------------------------');
    const schRows = schoolGen
      .getAllSchools()
      .map(
        (s) =>
          `(${s.id_colegio}, ${s.id_colegio}, '${s.colegio.replace(/'/g, "''")}', '${s.tipo}', '${s.turno}', '${s.area}', ${s.cod_dep}, ${s.cod_prov}, ${s.cod_loc}, '${s.cod_ue || '81980001'}', 'A')`
      )
      .join(',\n  ');
    lines.push(`
INSERT INTO public.prs_colegios (
  id_colegio, id_colegio_original, colegio, tipo, turno, area,
  cod_dep, cod_prov, cod_loc, cod_ue, _estado
) VALUES
  ${schRows}
ON CONFLICT (id_colegio) DO NOTHING;
`);

    if (academicGen.teacherAssignments.length > 0) {
      const asigRows = academicGen.teacherAssignments
        .map(
          (a) =>
            `(${a.id_dct_asignaciones}, ${a.id_docente}, '${a.id_programa}', ${a.id_materia}, ${a.id_grupo}, ${a.id_gestion}, ${a.id_periodo}, 'N', 'N', 60, 'A')`
        )
        .join(',\n  ');
      lines.push(`
INSERT INTO academico.dct_asignaciones (
  id_dct_asignaciones, id_docente, id_programa, id_materia, id_grupo,
  id_gestion, id_periodo, tipo_calificacion, se_elegido, cupo_max, _estado
) VALUES
  ${asigRows}
ON CONFLICT (id_dct_asignaciones) DO NOTHING;
`);
    }

    // =========================================================================
    // NIVEL 5: IDENTIDAD DEMOGRÁFICA (public.uatf_datos)
    // =========================================================================
    lines.push('-- ----------------------------------------------------------------------------');
    lines.push(`-- NIVEL 5: IDENTIDAD DEMOGRÁFICA (uatf_datos: ${simulation.uatfDatos.length} registros)`);
    lines.push('-- ----------------------------------------------------------------------------');
    SqlEmitter.appendBatchedInserts(
      lines,
      'public.uatf_datos',
      [
        'id_ra', 'nro_dip', 'paterno', 'materno', 'nombres', 'id_sexo',
        'fec_nacimiento', 'nac_pais', 'id_dep', 'id_prov_original', 'id_loc',
        'direccion', 'telefono', 'id_colegio', 'egr_gestion', 'fec_registro',
        'id_calificacion', 'tel_per', 'zona', 'estado_civil', 'tdni',
        'email', 'nacionalidad', 'tipo_nro_dip'
      ],
      simulation.uatfDatos.map((d) => [
        `'${d.id_ra}'`,
        `'${d.nro_dip}'`,
        `'${d.paterno.replace(/'/g, "''")}'`,
        `'${d.materno.replace(/'/g, "''")}'`,
        `'${d.nombres.replace(/'/g, "''")}'`,
        `'${d.id_sexo}'`,
        `'${d.fec_nacimiento}'`,
        d.nac_pais,
        d.id_dep,
        d.id_prov_original,
        d.id_loc,
        `'${d.direccion.replace(/'/g, "''")}'`,
        `'${d.telefono}'`,
        d.id_colegio,
        d.egr_gestion,
        `'${d.fec_registro}'`,
        `'${d.id_calificacion}'`,
        `'${d.tel_per}'`,
        `'${d.zona.replace(/'/g, "''")}'`,
        d.estado_civil,
        `'${d.tdni}'`,
        `'${d.email.replace(/'/g, "''")}'`,
        `'${d.nacionalidad}'`,
        `'${d.tipo_nro_dip}'`,
      ])
    );

    // =========================================================================
    // NIVEL 6: POSTULANTES Y ALUMNOS
    // =========================================================================
    lines.push('-- ----------------------------------------------------------------------------');
    lines.push(`-- NIVEL 6: POSTULACIONES Y ALUMNOS (Postulantes: ${simulation.postulantes.length}, Alumnos: ${simulation.alumnos.length})`);
    lines.push('-- ----------------------------------------------------------------------------');
    SqlEmitter.appendBatchedInserts(
      lines,
      'public.postulantes',
      [
        'id_alumno', 'id_programa', 'id_ra', 'fec_inscripcion', 'id_plan',
        'id_grado', 'estado', 'id_calificacion', 'promedio', 'nro_dip',
        'examen', 'id_acceso', 'id_periodo', 'id_gestion', 'nota',
        '_estado', '_id_usuario'
      ],
      simulation.postulantes.map((p) => [
        p.id_alumno,
        `'${p.id_programa}'`,
        `'${p.id_ra}'`,
        `'${p.fec_inscripcion}'`,
        p.id_plan,
        `'${p.id_grado}'`,
        `'${p.estado}'`,
        `'${p.id_calificacion}'`,
        p.promedio,
        `'${p.nro_dip}'`,
        p.examen,
        `'${p.id_acceso}'`,
        p.id_periodo,
        p.id_gestion,
        p.nota,
        `'${p._estado}'`,
        `'${p._id_usuario}'`,
      ])
    );

    SqlEmitter.appendBatchedInserts(
      lines,
      'academico.alumnos',
      [
        'id_alumno', 'id_programa', 'id_ra', 'fec_inscripcion', 'fec_egreso',
        'id_plan', 'id_grado', 'estado', 'tipo_alumno', 'id_tipo_aprobacion',
        'carrera', 'ssu', '_fecha_registro'
      ],
      simulation.alumnos.map((a) => [
        a.id_alumno,
        `'${a.id_programa}'`,
        `'${a.id_ra}'`,
        `'${a.fec_inscripcion}'`,
        a.fec_egreso ? `'${a.fec_egreso}'` : 'NULL',
        a.id_plan,
        `'${a.id_grado}'`,
        `'${a.estado}'`,
        `'${a.tipo_alumno}'`,
        a.id_tipo_aprobacion,
        a.carrera,
        `'${a.ssu}'`,
        `'${a._fecha_registro}'`,
      ])
    );

    // =========================================================================
    // NIVEL 6b: COMPRAS DE MATRÍCULA Y PERIODOS CUBIERTOS
    // =========================================================================
    lines.push('-- ----------------------------------------------------------------------------');
    lines.push(`-- NIVEL 6b: COMPRAS DE MATRÍCULA (${simulation.cajasTransacciones.length} eventos)`);
    lines.push('-- Una transacción semestral del período 1 puede cubrir dos filas académicas.');
    lines.push('-- ----------------------------------------------------------------------------');
    SqlEmitter.appendBatchedInserts(
      lines,
      'public.matriculas',
      [
        'id_matricula', 'id_gestion', 'id_periodo', 'id_alumno', 'clave',
        'fec_registro', 'ult_usuario', 'estado', 'tramite', 'tipo',
        '_registrado', 'id_tipo_matricula'
      ],
      simulation.matriculas.map((m) => [
        m.id_matricula,
        m.id_gestion,
        m.id_periodo,
        m.id_alumno,
        `'${m.clave}'`,
        `'${m.fec_registro}'`,
        `'${m.ult_usuario}'`,
        `'${m.estado}'`,
        `'${m.tramite}'`,
        `'${m.tipo}'`,
        `'${m.registrado}'`,
        `'${m.id_tipo_matricula}'`,
      ])
    );

    SqlEmitter.appendBatchedInserts(
      lines,
      'public.cajas_transacciones',
      [
        'id_transaccion', 'id_ra', 'id_alumno', 'id_cargo', 'fec_transaccion',
        'envia', 'id_tipo_transaccion', 'estado', 'fec_pago', 'costo',
        'id_gestion', 'id_periodo'
      ],
      simulation.cajasTransacciones.map((t) => [
        t.id_transaccion,
        `'${t.id_ra}'`,
        t.id_alumno,
        `'${t.id_cargo}'`,
        `'${t.fec_transaccion}'`,
        `'${t.envia}'`,
        t.id_tipo_transaccion,
        `'${t.estado}'`,
        `'${t.fec_pago}'`,
        t.costo,
        t.id_gestion,
        t.id_periodo,
      ])
    );

    SqlEmitter.appendBatchedInserts(
      lines,
      'public.valores_transacciones',
      [
        'id_transaccion', 'id_alumno', 'id_programa', 'id_cargo', 'id_concepto',
        'costo', 'fecha', 'id_gestion', 'id_periodo', 'ult_usuario', 'estado',
        'id_ra', 'envia', 'id_tipo_transaccion', 'sistema', 'id_caja_tran'
      ],
      simulation.valoresTransacciones.map((v) => [
        v.id_transaccion,
        v.id_alumno,
        `'${v.id_programa}'`,
        `'${v.id_cargo}'`,
        `'${v.id_concepto}'`,
        v.costo,
        `'${v.fecha}'`,
        v.id_gestion,
        v.id_periodo,
        `'${v.ult_usuario}'`,
        `'${v.estado}'`,
        `'${v.id_ra}'`,
        `'${v.envia}'`,
        v.id_tipo_transaccion,
        `'${v.sistema}'`,
        v.id_caja_tran,
      ])
    );

    // =========================================================================
    // NIVEL 7: PROGRAMACIONES, NOTAS Y GRADUADOS
    // =========================================================================
    lines.push('-- ----------------------------------------------------------------------------');
    lines.push(`-- NIVEL 7: TRANSACCIONES ACADÉMICAS (Notas: ${simulation.notasPlanilla.length}, Graduados: ${simulation.graduados.length})`);
    lines.push('-- ----------------------------------------------------------------------------');

    SqlEmitter.appendBatchedInserts(
      lines,
      'academico.alm_programaciones',
      [
        'id', 'id_alumno', 'id_materia', 'id_gestion', 'id_periodo',
        'id_grupo', 'fecha', 'ult_usuario', 'estado', 'pparcial',
        'sparcial', 'tparcial', 'cparcial', 'nota', 'nota_2da',
        'nota_ex_mesa', '_estado', 'tipo_programacion'
      ],
      simulation.programaciones.map((pr) => [
        pr.id,
        pr.id_alumno,
        pr.id_materia,
        pr.id_gestion,
        pr.id_periodo,
        pr.id_grupo,
        `'${pr.fecha}'`,
        `'${pr.ult_usuario}'`,
        `'${pr.estado}'`,
        pr.pparcial,
        pr.sparcial,
        pr.tparcial,
        pr.cparcial,
        pr.nota,
        pr.nota_2da,
        pr.nota_ex_mesa,
        `'${pr._estado}'`,
        `'${pr.tipo_programacion}'`,
      ])
    );

    SqlEmitter.appendBatchedInserts(
      lines,
      'academico.notas_planilla',
      [
        'id_matricula', 'id_gestion', 'id_periodo', 'id_alumno', 'id_materia',
        'grupo', 'nota', 'ult_usuario', 'estado', 'observacion',
        'nota_2da', 'nota_ex_mesa', 'pparcial', 'sparcial', 'tparcial',
        'cparcial', 'promparcial', 'pract', 'prompract', 'lab',
        'promlab', 'notapres', 'exfinal', 'promexfinal', 'tipo',
        '_fecha_creacion', '_unique', '__estado', '__obsv'
      ],
      simulation.notasPlanilla.map((n) => [
        n.id_matricula,
        n.id_gestion,
        n.id_periodo,
        n.id_alumno,
        n.id_materia,
        n.grupo,
        n.nota,
        `'${n.ult_usuario}'`,
        `'${n.estado}'`,
        `'${n.observacion.replace(/'/g, "''")}'`,
        n.nota_2da,
        n.nota_ex_mesa,
        n.pparcial,
        n.sparcial,
        n.tparcial,
        n.cparcial,
        n.promparcial,
        n.pract,
        n.prompract,
        n.lab,
        n.promlab,
        n.notapres,
        n.exfinal,
        n.promexfinal,
        `'${n.tipo}'`,
        `'${n._fecha_creacion}'`,
        n._unique,
        `'${n.__estado}'`,
        `'${n.__obsv}'`,
      ])
    );

    if (simulation.graduados.length > 0) {
      SqlEmitter.appendBatchedInserts(
        lines,
        'actas_graduacion.graduados',
        [
          'id', 'id_alumno', 'id_programa', 'id_gestion',
          'fecha_graduacion', 'nota_graduacion', '_registrado'
        ],
        simulation.graduados.map((g) => [
          g.id,
          g.id_alumno,
          `'${g.id_programa}'`,
          g.id_gestion,
          `'${g.fecha_graduacion}'`,
          g.nota_defensa,
          `'${g._registrado}'`,
        ])
      );
    }

    lines.push('');
    lines.push('COMMIT;');
    lines.push('');

    return lines.join('\n');
  }

  private static appendBatchedInserts(
    lines: string[],
    tableName: string,
    columns: string[],
    rows: (string | number)[][],
    batchSize = 250
  ): void {
    if (rows.length === 0) return;

    const colList = columns.join(', ');

    for (let i = 0; i < rows.length; i += batchSize) {
      const slice = rows.slice(i, i + batchSize);
      const valuesList = slice.map((r) => `(${r.join(', ')})`).join(',\n  ');

      lines.push(`INSERT INTO ${tableName} (${colList}) VALUES\n  ${valuesList}\nON CONFLICT DO NOTHING;\n`);
    }
  }

  /**
   * Guarda el contenido SQL en un archivo local
   */
  public static saveToFile(filePath: string, sqlContent: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, sqlContent, 'utf-8');
  }
}
