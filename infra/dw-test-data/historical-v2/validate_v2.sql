-- Read-only, aggregate-only checks for a successfully loaded local v2 fixture.
-- Run only against local database jachasun_test. No PII/key-level rows are returned.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '2s';

SELECT 'source_row_counts' AS check_group,
       'uatf_datos' AS source_table,
       count(*)::bigint AS row_count
FROM public.uatf_datos WHERE id_ra LIKE 'TEST%'
UNION ALL SELECT 'source_row_counts','postulantes',count(*) FROM public.postulantes WHERE id_ra LIKE 'TEST%'
UNION ALL SELECT 'source_row_counts','alumnos',count(*) FROM academico.alumnos WHERE id_ra LIKE 'TEST%'
UNION ALL SELECT 'source_row_counts','pln_materias',count(*) FROM academico.pln_materias WHERE _obs='DW_TEST_SEED_V2'
UNION ALL SELECT 'source_row_counts','notas_planilla',count(*) FROM academico.notas_planilla WHERE _hash='DWTESTV2'
UNION ALL SELECT 'source_row_counts','alm_programaciones',count(*) FROM academico.alm_programaciones WHERE ult_usuario='DW_TEST_SEED'
UNION ALL SELECT 'source_row_counts','dct_asignaciones',count(*) FROM academico.dct_asignaciones WHERE observacion='DW_TEST_SYNTHETIC_ASSIGNMENT'
UNION ALL SELECT 'source_row_counts','period_catalogs',count(*) FROM academico.periodos WHERE des_periodo LIKE 'DW TEST SYNTHETIC PERIOD CODE %';

SELECT 'coverage' AS check_group,
       min(id_gestion) AS min_gestion,
       max(id_gestion) AS max_gestion,
       count(DISTINCT id_gestion) AS gestiones,
       count(DISTINCT id_periodo) AS distinct_period_codes,
       string_agg(DISTINCT id_periodo::text, ',' ORDER BY id_periodo::text) AS period_codes
FROM academico.notas_planilla WHERE _hash='DWTESTV2';

SELECT 'grade_and_partial_cases' AS check_group,
       count(*) FILTER (WHERE nota IS NULL) AS null_primary_grade,
       count(*) FILTER (WHERE nota < 0 OR nota > 100 OR nota_2da < 0 OR nota_2da > 100) AS out_of_range_grade_rows,
       count(*) FILTER (WHERE GREATEST(COALESCE(nota,0),COALESCE(nota_2da,0)) > 50) AS rule_approved_rows,
       count(*) FILTER (WHERE GREATEST(COALESCE(nota,0),COALESCE(nota_2da,0)) BETWEEN 1 AND 50) AS rule_failed_rows,
       count(*) FILTER (WHERE pparcial IS NOT NULL AND pparcial <> 0) AS at_least_one_partial,
       count(*) FILTER (WHERE pparcial IS NOT NULL AND pparcial <> 0
                         AND sparcial IS NOT NULL AND sparcial <> 0) AS at_least_two_partials,
       count(*) FILTER (WHERE (pparcial IS NULL OR pparcial = 0)
                         AND (sparcial IS NULL OR sparcial = 0)) AS fewer_than_two_nonzero_partials,
       count(*) FILTER (WHERE id_periodo <= 0) AS unsupported_dw_period_rows
FROM academico.notas_planilla WHERE _hash='DWTESTV2';

SELECT 'year_coverage' AS check_group,
       expected.id_gestion,
       EXISTS (
           SELECT 1 FROM academico.notas_planilla actual
           WHERE actual._hash='DWTESTV2' AND actual.id_gestion=expected.id_gestion
       ) AS has_course_rows
FROM generate_series(2000,2025) AS expected(id_gestion)
ORDER BY expected.id_gestion;

SELECT 'admission_states' AS check_group, estado, count(*)::bigint AS row_count
FROM public.postulantes WHERE id_ra LIKE 'TEST%'
GROUP BY estado ORDER BY estado;

SELECT 'program_active_codes' AS check_group, activo, count(*)::bigint AS row_count
FROM academico.alm_programas GROUP BY activo ORDER BY activo;

SELECT 'source_pair_reconciliation' AS check_group,
       (SELECT count(*) FROM (
           SELECT DISTINCT id_gestion,id_periodo FROM academico.notas_planilla WHERE _hash='DWTESTV2'
       ) n) AS notes_period_pairs,
       (SELECT count(*) FROM (
           SELECT DISTINCT id_gestion,id_periodo FROM academico.dct_asignaciones
           WHERE observacion='DW_TEST_SYNTHETIC_ASSIGNMENT'
       ) d) AS dct_period_pairs,
       (SELECT count(*) FROM (
           SELECT DISTINCT id_gestion,id_periodo FROM academico.notas_planilla WHERE _hash='DWTESTV2'
           EXCEPT
           SELECT DISTINCT id_gestion,id_periodo FROM academico.dct_asignaciones
           WHERE observacion='DW_TEST_SYNTHETIC_ASSIGNMENT'
       ) x) AS notes_pairs_missing_dct;

SELECT 'orphan_checks' AS check_group,
       (SELECT count(*)
        FROM academico.notas_planilla n
        WHERE n._hash='DWTESTV2'
          AND NOT EXISTS (SELECT 1 FROM academico.alumnos a WHERE a.id_alumno=n.id_alumno))
           AS notes_without_student,
       (SELECT count(*)
        FROM academico.notas_planilla n
        WHERE n._hash='DWTESTV2'
          AND NOT EXISTS (SELECT 1 FROM academico.pln_materias m WHERE m.id_materia=n.id_materia))
           AS notes_without_subject;

SELECT 'personal_fields_populated' AS check_group,
       count(*) FILTER (WHERE nro_dip IS NOT NULL OR paterno IS NOT NULL OR materno IS NOT NULL
                         OR nombres IS NOT NULL OR id_sexo IS NOT NULL OR fec_nacimiento IS NOT NULL
                         OR direccion IS NOT NULL OR telefono IS NOT NULL OR tel_per IS NOT NULL
                         OR tel_urg IS NOT NULL OR email IS NOT NULL OR zona IS NOT NULL
                         OR idfacebook IS NOT NULL OR tdni IS NOT NULL OR dip_bach IS NOT NULL)
           AS synthetic_rows_with_personal_fields,
       count(*) AS synthetic_identity_rows
FROM public.uatf_datos WHERE id_ra LIKE 'TEST%';

COMMIT;
