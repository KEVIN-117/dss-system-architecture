\set ON_ERROR_STOP on
DO $$
BEGIN
    IF current_database() <> 'jachasun' THEN
        RAISE EXCEPTION 'Expected the local jachasun database';
    END IF;
    IF (SELECT count(*) FROM public.uatf_datos WHERE id_ra LIKE 'TEST%') <> 6000 THEN
        RAISE EXCEPTION 'Expected 6000 synthetic identity rows';
    END IF;
    IF (SELECT count(*) FROM academico.alm_programas) <> 85 OR
       (SELECT count(*) FROM academico.alm_programas_facultades) <> 13 THEN
        RAISE EXCEPTION 'Career/faculty catalog counts do not match the approved synthetic catalog';
    END IF;
    IF (SELECT count(*) FROM academico.alm_programas WHERE activo='S') <> 73 OR
       (SELECT count(*) FROM academico.alm_programas WHERE activo='N') <> 12 OR
       EXISTS (SELECT 1 FROM academico.alm_programas WHERE activo NOT IN ('S','N')) THEN
        RAISE EXCEPTION 'Synthetic program active flags are not normalized to the DW-001 contract domain';
    END IF;
    IF (SELECT count(*) FROM public.fac_programas) <> 85 OR
       (SELECT count(*) FROM public.fac_programas WHERE tipo_c='A') <> 21 OR
       (SELECT count(*) FROM public.fac_programas WHERE tipo_c='S') <> 64 OR
       EXISTS (SELECT 1 FROM public.fac_programas GROUP BY id_programa HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Annual/semester schedule catalog is incomplete or ambiguous';
    END IF;
    IF (SELECT min(id_gestion) FROM public.postulantes WHERE _id_usuario='DWTEST_V1') <> 2000 OR
       (SELECT max(id_gestion) FROM public.postulantes WHERE _id_usuario='DWTEST_V1') <> 2025 THEN
        RAISE EXCEPTION 'Admissions do not cover exactly the requested historical endpoints';
    END IF;
    IF (SELECT min(fec_inscripcion) FROM academico.alumnos WHERE id_ra LIKE 'TEST%') >= DATE '2001-01-01' OR
       (SELECT max(fec_inscripcion) FROM academico.alumnos WHERE id_ra LIKE 'TEST%') < DATE '2025-01-01' THEN
        RAISE EXCEPTION 'Student enrollment dates do not span 2000 through 2025';
    END IF;
    IF (SELECT min(id_gestion) FROM academico.notas_planilla) <> 2000 OR
       (SELECT max(id_gestion) FROM academico.notas_planilla) <> 2025 THEN
        RAISE EXCEPTION 'Course attempts do not cover exactly the requested historical endpoints';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.uatf_datos
        WHERE id_ra LIKE 'TEST%' AND (
            nro_dip IS NOT NULL OR paterno IS NOT NULL OR materno IS NOT NULL OR nombres IS NOT NULL OR
            fec_nacimiento IS NOT NULL OR direccion IS NOT NULL OR telefono IS NOT NULL OR email IS NOT NULL OR
            nacionalidad IS NOT NULL
        )
    ) THEN RAISE EXCEPTION 'Synthetic person rows contain a personal attribute'; END IF;
    IF EXISTS (
        SELECT 1 FROM academico.notas_planilla n
        LEFT JOIN academico.alumnos a ON a.id_alumno=n.id_alumno
        LEFT JOIN academico.pln_materias m ON m.id_materia=n.id_materia
        WHERE a.id_alumno IS NULL OR m.id_materia IS NULL OR a.id_ra NOT LIKE 'TEST%'
           OR m.id_programa IS DISTINCT FROM a.id_programa
    ) THEN RAISE EXCEPTION 'An academic fact fixture has an orphaned source key'; END IF;
    IF EXISTS (
        SELECT 1 FROM public.postulantes p
        LEFT JOIN public.uatf_datos u ON u.id_ra=p.id_ra
        LEFT JOIN academico.alm_programas c ON c.id_programa=p.id_programa
        WHERE p._id_usuario='DWTEST_V1' AND (u.id_ra IS NULL OR c.id_programa IS NULL)
    ) THEN RAISE EXCEPTION 'An admission fixture has an orphaned identity/program'; END IF;
    IF EXISTS (
        SELECT 1 FROM academico.notas_planilla n
        JOIN academico.alumnos a ON a.id_alumno=n.id_alumno
        JOIN public.fac_programas p ON p.id_programa=a.id_programa
        WHERE p.tipo_c='A' AND n.id_periodo<>1
    ) THEN RAISE EXCEPTION 'Annualized career has a semester-2 course attempt'; END IF;
    IF EXISTS (SELECT 1 FROM academico.alumnos WHERE id_ra LIKE 'TEST%' AND fec_egreso IS NOT NULL) THEN
        RAISE EXCEPTION 'Synthetic seed must not fabricate graduation/egress';
    END IF;
    IF EXISTS (
        SELECT id_ra FROM academico.alumnos WHERE id_ra LIKE 'TEST%'
        GROUP BY id_ra HAVING count(*)<>1
    ) THEN RAISE EXCEPTION 'Synthetic person maps to more than one academic student row'; END IF;
    IF EXISTS (
        SELECT 1 FROM academico.notas_planilla
        WHERE nota < 0 OR nota > 100 OR pparcial < 0 OR pparcial > 100 OR
              sparcial < 0 OR sparcial > 100 OR tparcial < 0 OR tparcial > 100 OR
              cparcial < 0 OR cparcial > 100 OR nota_2da < 0 OR nota_2da > 100 OR
              nota_ex_mesa < 0 OR nota_ex_mesa > 100
    ) THEN RAISE EXCEPTION 'A synthetic score falls outside the source score range'; END IF;
    IF (SELECT count(*) FROM academico.notas_planilla
        WHERE observacion LIKE 'DW_TEST_SEED_V1:abandono_lt2_parciales_%'
          AND ((pparcial IS NOT NULL)::integer + (sparcial IS NOT NULL)::integer +
               (tparcial IS NOT NULL)::integer + (cparcial IS NOT NULL)::integer) >= 2) > 0
    THEN RAISE EXCEPTION 'A dropout test case has two or more attended partials'; END IF;
    IF (SELECT count(*) FROM academico.notas_planilla
        WHERE observacion IN ('DW_TEST_SEED_V1:abandono_lt2_parciales_0',
                              'DW_TEST_SEED_V1:abandono_lt2_parciales_1')) = 0
    THEN RAISE EXCEPTION 'Expected the explicit zero/one-partial test cases'; END IF;
    IF NOT EXISTS (SELECT 1 FROM academico.notas_planilla WHERE observacion='DW_TEST_SEED_V1:reintento') THEN
        RAISE EXCEPTION 'Expected at least one controlled failed-subject retry';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM academico.notas_planilla retry
        JOIN academico.notas_planilla prior
          ON prior.id_alumno=retry.id_alumno AND prior.id_materia=retry.id_materia
         AND (prior.id_gestion,prior.id_periodo) < (retry.id_gestion,retry.id_periodo)
        WHERE retry.observacion='DW_TEST_SEED_V1:reintento'
          AND prior.nota IS NOT NULL AND prior.nota < 51
    ) THEN RAISE EXCEPTION 'A retry is not traceable to a previous failed attempt'; END IF;
END $$;

SELECT 'historical dataset validation passed' AS result,
       (SELECT count(*) FROM public.uatf_datos WHERE id_ra LIKE 'TEST%') AS persons,
       (SELECT count(*) FROM public.postulantes WHERE _id_usuario='DWTEST_V1') AS applications,
       (SELECT count(*) FROM academico.alumnos WHERE id_ra LIKE 'TEST%') AS students,
       (SELECT count(*) FROM academico.notas_planilla WHERE observacion LIKE 'DW_TEST_SEED_V1:%') AS course_attempts,
       (SELECT count(*) FROM academico.notas_planilla WHERE observacion LIKE 'DW_TEST_SEED_V1:reintento') AS retries,
       (SELECT count(*) FROM academico.notas_planilla WHERE observacion LIKE 'DW_TEST_SEED_V1:abandono_lt2_parciales_%') AS abandonment_test_cases,
       (SELECT count(*) FILTER (WHERE tipo_c='A')||' annual / '||count(*) FILTER (WHERE tipo_c='S')||' semester'
        FROM public.fac_programas) AS career_calendar_mix,
       (SELECT min(id_gestion)||'–'||max(id_gestion) FROM academico.notas_planilla) AS course_year_range,
       (SELECT min(id_periodo)||'–'||max(id_periodo) FROM academico.notas_planilla) AS period_range,
       (SELECT count(*) FROM academico.pln_materias WHERE _obs='DW_TEST_SEED_V1') AS synthetic_subjects;

SELECT id_gestion, id_periodo, count(*) AS course_rows,
       count(*) FILTER (WHERE nota IS NULL) AS missing_final_grade,
       count(*) FILTER (WHERE estado='X') AS synthetic_unmapped_status
FROM academico.notas_planilla
GROUP BY id_gestion, id_periodo
ORDER BY id_gestion, id_periodo;
