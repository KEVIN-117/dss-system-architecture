import fs from 'node:fs';
import path from 'node:path';
import type { SimulationResult } from '../generators/cohorts.js';
import type { AcademicGenerator } from '../generators/academic.js';
import type { SchoolGenerator } from '../generators/schools.js';
import type { SeedMetadata } from '../config/security.js';

export class SqlEmitter {
  /** id_sede del catálogo → academico.sedes.id_sede (código de una letra en Jachasun). */
  private static readonly SEDE_CODE: Record<number, string> = {
    1: 'C', 2: 'L', 3: 'S', 4: 'T', 5: 'N', 6: 'U', 7: 'V', 8: 'R',
  };

  private static readonly DEGREE_TITLE: Record<string, string> = {
    LIC: 'LICENCIATURA',
    TUS: 'TECNICO UNIVERSITARIO SUPERIOR',
    TUM: 'TECNICO UNIVERSITARIO MEDIO',
  };

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
INSERT INTO public.prs_pais_v2 (id_pais, pais, estado)
VALUES (27, 'BOLIVIA', 'A')
ON CONFLICT (id_pais) DO NOTHING;

INSERT INTO public._bp_estados_civiles (id_estado_civil, cod_estado_civil, estado_civil, _registrado, _modificado, _estado)
VALUES
  (1, 'S', 'SOLTERO/A', now(), now(), 'A'),
  (2, 'C', 'CASADO/A', now(), now(), 'A'),
  (3, 'D', 'DIVORCIADO/A', now(), now(), 'A'),
  (4, 'V', 'VIUDO/A', now(), now(), 'A')
ON CONFLICT (id_estado_civil) DO NOTHING;

INSERT INTO public.prs_calificacion (id_calificacion, calificacion)
VALUES
  ('1', 'Plan Fiscal'),
  ('2', 'Plan Particular'),
  ('3', 'Desconocido'),
  ('Z', 'Otros')
ON CONFLICT (id_calificacion) DO NOTHING;

INSERT INTO public.prs_examen (id_examen, examen, abreviacion)
VALUES
  (0, 'OTRAS MODALIDADES', 'OM'),
  (1, 'EXAMEN P.S.A.', 'P.S.A.'),
  (2, 'CURSO PRE - UNIVERSITARIO', 'CPU'),
  (5, 'INGRESO DIRECTO', 'ING. DIRECTO'),
  (6, 'ADMISION POR EXCELENCIA ACADEMICA', 'EXCELENCIA'),
  (7, 'ADMISION EXTRAORDINARIA DEPORTIVA', 'DEPORTIVA'),
  (8, 'ADMISION ESPECIAL (PROFESIONALES)', 'PROFESIONAL'),
  (9, 'CONVENIO C.A.O.P.', 'C.A.O.P.'),
  (10, 'CARRERA SIMULTANEA', 'SIMULTANEA'),
  (15, 'CAMBIO DE CARRERA', 'CAMBIO'),
  (29, 'TRANSFERENCIAS (SUB SEDES)', 'TRANSF. SUBSEDES'),
  (32, 'ADMISION OLIMPIADAS CIENTIFICAS', 'OLIMP. CIENTIFICAS'),
  (36, 'TRASPASO DE UNIVERSIDADES', 'TRASPASO'),
  (42, 'ADMISION ESTUDIANTES INDIGENAS ORIGINARIOS CAMPESINOS', 'INDIGENAS ORIG.'),
  (43, 'ADMISION PERSONAS CON CAPACIDADES DIFERENTES O DISCAPACIDAD', 'AEPD')
ON CONFLICT (id_examen) DO NOTHING;

INSERT INTO academico.carreras_tipos (tipo, descripcion, semanas)
VALUES ('A', 'Anual', 40), ('S', 'Semestral', 20), ('P', 'Programa', 40)
ON CONFLICT (tipo) DO NOTHING;

INSERT INTO academico.sedes (id_sede, sede)
VALUES
  ('C', 'CENTRAL'),
  ('L', 'LLICA'),
  ('S', 'SACACA'),
  ('T', 'TUPIZA'),
  ('N', 'UNCIA'),
  ('U', 'UYUNI'),
  ('V', 'VILLAZON'),
  ('R', 'SAN CRISTOBAL')
ON CONFLICT (id_sede) DO NOTHING;

INSERT INTO academico.alumnos_estados (estado, descripcion)
VALUES
  ('P', 'Profesional'),
  ('A', 'Activo (Realizo su Acta de Graduacion)'),
  ('T', 'Titulado'),
  ('B', 'Bloqueado'),
  ('X', 'Anulado'),
  ('S', 'Simultanea')
ON CONFLICT (estado) DO NOTHING;

-- academico.periodos no tiene PK en Jachasun: inserción idempotente explícita.
INSERT INTO academico.periodos (id_periodo, des_periodo, orden, tipo)
SELECT v.id_periodo, v.des_periodo, v.orden, v.tipo::varchar[]
FROM (VALUES
  (1, 'GESTION', 1, '{A}'),
  (1, 'SEMESTRE', 2, '{S}'),
  (2, 'SEMESTRE', 5, '{S}'),
  (3, 'CURSO DE VERANO', 6, '{A,S}'),
  (4, 'MESA DE EXAMEN', 1, '{A,S}')
) AS v(id_periodo, des_periodo, orden, tipo)
WHERE NOT EXISTS (
  SELECT 1 FROM academico.periodos p WHERE p.id_periodo = v.id_periodo AND p.des_periodo = v.des_periodo
);

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
INSERT INTO public.lugar_departamento (cod_dep, departamento, expedido, cod_pais)
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

INSERT INTO academico.alm_periodos (id_periodo, descripcion, id_periodo_relacion)
VALUES
  (1, 'PRIMERO', 1),
  (2, 'SEGUNDO', 2),
  (3, 'VERANO', 3),
  (4, 'EXAMEN DE MESA', 1),
  (5, 'EXAMEN DE MESA', 2),
  (6, 'INVIERNO', 6)
ON CONFLICT (id_periodo) DO NOTHING;
`);

    // Carreras / Programas en academico.alm_programas (DDL Jachasun)
    const progRowsAlm: string[] = [];
    for (const p of academicGen.programs) {
      const progName = String(p.name || p.programa).substring(0, 50).replace(/'/g, "''");
      const idFac = p.id_facultad_numeric || 1;
      const sede = SqlEmitter.SEDE_CODE[p.id_sede || 1] || 'C';
      const regimen = p.regime === 'A' ? 'A' : 'S';
      const titulo = SqlEmitter.DEGREE_TITLE[p.degree_level] || 'LICENCIATURA';
      progRowsAlm.push(
        `('${p.id_programa}', '${progName}', ${idFac}, 0, '${titulo}', 'A', '${regimen}', 'CAR', '${sede}', '${p.id_programa}', 3, 51, 40, 1, 2, 'NORMAL', true, 1, 2018)`
      );
    }

    lines.push(`
INSERT INTO academico.alm_programas (
  id_programa, programa, id_facultad, id_nivel, titulo, activo, tipo, _tipo_academico,
  sede, pabreviacion, num_parc, nota_minima, nota_2do_habilitacion,
  id_edificio, nro_max_arrastres, tipo_cobro, _tiene_examen_mesa, moodle, id_plan
) VALUES
  ${progRowsAlm.join(',\n  ')}
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
      const modalityId: Record<string, number> = {
        'TESIS DE GRADO': 1, 'PROYECTO DE GRADO': 2, 'TRABAJO DIRIGIDO': 3, 'EXCELENCIA ACADEMICA': 4,
      };
      const programs = new Map<string, any>(academicGen.programs.map((p: any) => [p.id_programa, p]));
      SqlEmitter.appendBatchedInserts(
        lines,
        'actas_graduacion.graduados',
        [
          'id', 'id_alumno', 'titulo', 'id_modalidad', 'fecha_graduacion', 'id_gestion',
          'nota_graduacion', '_registrado', '_estado', '_id_usuario', 'nro_dip', 'id_programa'
        ],
        simulation.graduados.map((g) => {
          const program = programs.get(g.id_programa);
          const degree = SqlEmitter.DEGREE_TITLE[program?.degree_level] || 'LICENCIATURA';
          const titulo = `${degree} EN ${String(program?.name || g.id_programa)}`.replace(/'/g, "''");
          return [
            g.id,
            g.id_alumno,
            `'${titulo}'`,
            modalityId[g.modalidad_graduacion] ?? 1,
            `'${g.fecha_graduacion}'`,
            g.id_gestion,
            g.nota_defensa,
            `'${g._registrado}'`,
            `'A'`,
            `'seed_titulacion'`,
            `'${g.nro_dip}'`,
            `'${g.id_programa}'`,
          ];
        })
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
