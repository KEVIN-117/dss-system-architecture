DO $$
DECLARE
    v_run_id CONSTANT UUID := 'a1300000-0000-0000-0000-000000000001';
    v_execution etl_control.etl_execution;
    v_expected RECORD;
    v_manifest etl_control.etl_source_manifest;
BEGIN
    SELECT * INTO STRICT v_execution FROM etl_control.etl_execution WHERE run_id=v_run_id;
    IF v_execution.status <> 'FALLIDA' OR v_execution.requested_by <> 'hop_vertical_test' THEN
        RAISE EXCEPTION 'Nine-source smoke must remain audited as FALLIDA by restricted Hop login';
    END IF;

    FOR v_expected IN
        SELECT * FROM (VALUES
          ('public.uatf_datos',2002,NULL::text),
          ('academico.alumnos',3,'9bfd57a5fab36ac19e6c20cb49495effbc85434d8e1c1570e6fbc907ef1923f8'),
          ('public.postulantes',3,'996751a46c044c8ea1c8e86213f6115ea207f0a9d4a1cd14d892bfb42219d52e'),
          ('academico.alm_programas',2,'d0703dc2a7bc8712d9ad09f889608589dedfca53ccba762bd0d2e21e71517d23'),
          ('academico.pln_materias',3,'04816fa6cf7a3e594d478a8b162cbf895683748fc1586712e41447fc02941d23'),
          ('academico.notas_planilla',6,'4a591f9e237952dfb0b4fe6a9dc3308590dfb2563776c40a8f27d598d7ce41ca'),
          ('academico.alm_programas_facultades',2,'a93cbdaf85c233554a0c0ed50fa9dbf363cb6467292e8e14284d5c8652a07913'),
          ('public.prs_colegios',2,'6d0db6e71f8563de984eea72d0dc7ef67fde5cd2e474059d145a176c3d51a7fa'),
          ('public.lugar_localidad',2,'8d2a1b895d3755d0a5b45f128b711ad58f3f0ab496278bd3c0ca3ce9b4b1b71a')
        ) AS e(contract_id, expected_count, query_hash)
    LOOP
        SELECT * INTO STRICT v_manifest FROM etl_control.etl_source_manifest
         WHERE run_id=v_run_id AND source_contract_id=v_expected.contract_id;
        IF v_manifest.status <> 'COMPLETO' OR v_manifest.record_count <> v_expected.expected_count
           OR (v_expected.query_hash IS NOT NULL AND v_manifest.source_query_sha256 <> v_expected.query_hash)
           OR v_manifest.source_schema_sha256 !~ '^[0-9a-f]{64}$' THEN
            RAISE EXCEPTION 'Manifest validation failed for %',v_expected.contract_id;
        END IF;
    END LOOP;

    IF (SELECT count(*) FROM etl_control.etl_source_manifest WHERE run_id=v_run_id) <> 9
       OR (SELECT count(*) FROM etl_control.etl_execution_metric
           WHERE run_id=v_run_id AND metric_name='source_rows_observed') <> 9
       OR (SELECT count(*) FROM etl_control.etl_execution_step
           WHERE run_id=v_run_id AND step_code LIKE 'source_%' AND status='EXITOSO') <> 9
       OR (SELECT count(*) FROM etl_control.etl_execution_step
           WHERE run_id=v_run_id AND step_code LIKE 'dimension_%' AND status='EXITOSO') <> 5
       OR (SELECT count(*) FROM etl_control.etl_execution_step
           WHERE run_id=v_run_id AND step_code IN ('fact_admision','fact_cursado') AND status='EXITOSO') <> 2
       OR (SELECT count(*) FROM etl_work.hop_publication_batch
           WHERE run_id=v_run_id AND (target_code,expected_rows) IN
             (('DIM_PROGRAMA',2),('DIM_MATERIA',3),('DIM_PERIODO_ACADEMICO',3),('DIM_ADMISION',2),('DIM_ESTUDIANTE',3))) <> 5
       OR (SELECT count(*) FROM etl_work.hop_publication_batch
           WHERE run_id=v_run_id AND target_code IN ('FACT_ADMISION','FACT_CURSADO')
             AND sealed_at IS NOT NULL
             AND ((target_code='FACT_ADMISION' AND expected_rows=1)
               OR (target_code='FACT_CURSADO' AND expected_rows=3))) <> 2
       OR (SELECT count(*) FROM etl_work.hop_publication_row WHERE run_id=v_run_id) <> 17
       OR (SELECT count(*) FROM etl_work.hop_publication_row
           WHERE run_id=v_run_id AND target_code='FACT_ADMISION'
             AND natural_key='1003' AND record_data->>'es_admitido'='true'
             AND record_data->>'puntaje_examen'='76') <> 1
       OR (SELECT count(*) FROM etl_work.hop_publication_row
           WHERE run_id=v_run_id AND target_code='FACT_CURSADO'
             AND natural_key IN ('9003','9004','9005')
             AND (record_data->>'conteo_intento')::integer=1
             AND record_data->'es_aprobado'='null'::jsonb) <> 3
       OR (SELECT count(*) FROM etl_work.hop_publication_row
           WHERE run_id=v_run_id AND target_code='DIM_ESTUDIANTE' AND operation='INSERT'
             AND (record_data->>'valid_from')::timestamptz=(SELECT effective_at FROM etl_control.academic_period_closure
                 WHERE gestion=2025 AND periodo=2)
             AND record_data->>'is_current'='true'
             AND record_data->>'attribute_hash_scd2' ~ '^[0-9a-f]{64}$') <> 3
       OR (SELECT count(*) FROM etl_work.hop_publication_row
           WHERE run_id=v_run_id AND target_code='DIM_ESTUDIANTE' AND operation='CLOSE') <> 0
       OR (SELECT count(*) FROM etl_control.etl_execution_step
           WHERE run_id=v_run_id AND step_code='mvp_completion_gate' AND status='FALLIDO'
             AND details->>'observed_source_manifests'='9'
             AND details->>'prepared_dimension_batches'='5'
             AND details->>'prepared_fact_batches'='2'
             AND details->>'missing_target'='FACT_RETENCION_DESERCION') <> 1
       OR (SELECT count(*) FROM etl_control.etl_execution_error
           WHERE run_id=v_run_id AND error_code='MVP_VERTICAL_ONLY' AND is_blocking) <> 1 THEN
        RAISE EXCEPTION 'Source audit, five dimension batches, two fact batches, or incomplete-run gate is wrong';
    END IF;

    IF (SELECT count(*) FROM dw.dim_programa WHERE member_type='STANDARD')
       +(SELECT count(*) FROM dw.dim_materia WHERE member_type='STANDARD')
       +(SELECT count(*) FROM dw.dim_periodo_academico WHERE member_type='STANDARD')
       +(SELECT count(*) FROM dw.dim_admision WHERE member_type='STANDARD')
       +(SELECT count(*) FROM dw.dim_estudiante WHERE member_type='STANDARD') <> 0 THEN
        RAISE EXCEPTION 'Dimension rows were published before the atomic publisher gate';
    END IF;

    IF (SELECT count(*) FROM etl_control.academic_period_closure
        WHERE gestion=2025 AND periodo IN (1,2) AND status='CERRADO') <> 2
       OR (SELECT count(*) FROM etl_control.academic_period_closure_event
        WHERE closure_id IN (SELECT closure_id FROM etl_control.academic_period_closure
                             WHERE gestion=2025 AND periodo IN (1,2))
          AND to_status='CERRADO' AND actor_subject='dsa:integration-fixture') <> 2 THEN
        RAISE EXCEPTION 'Synthetic closure fixture was not auditable';
    END IF;

    IF (SELECT count(*) FROM etl_control.etl_execution_event
        WHERE run_id=v_run_id AND new_status IN ('SOLICITADA','EN_EJECUCION','FALLIDA')) <> 3 THEN
        RAISE EXCEPTION 'Expected requested -> running -> failed state history';
    END IF;
    IF (SELECT count(*) FROM dw.fact_admision)+(SELECT count(*) FROM dw.fact_cursado)
       +(SELECT count(*) FROM dw.fact_retencion_desercion)
       +(SELECT count(*) FROM staging.raw_uatf_datos) <> 0 THEN
        RAISE EXCEPTION 'Smoke wrote published or legacy RAW rows';
    END IF;
    IF has_table_privilege('hop_vertical_test','dw.fact_admision','INSERT')
       OR has_table_privilege('hop_vertical_test','etl_control.etl_execution','INSERT') THEN
        RAISE EXCEPTION 'Hop test principal unexpectedly has direct DML grants';
    END IF;
END;
$$;

-- The accepted 2025/2 load has valid coursework scores. Independently verify
-- the 6.5 database gate rejects an out-of-range row for a later synthetic cut.
BEGIN;
SET SESSION AUTHORIZATION hop_vertical_test;
DO $$
DECLARE
    v_closure etl_control.academic_period_closure;
    v_run UUID := 'a1300000-0000-0000-0000-000000000099';
BEGIN
    SELECT * INTO STRICT v_closure FROM etl_control.academic_period_closure
    WHERE gestion=2025 AND periodo=3 AND status='CERRADO';
    PERFORM etl_control.create_hop_etl_execution(
        v_run,'CIERRE_ACADEMICO',v_closure.closure_id,v_closure.gestion,
        v_closure.periodo,v_closure.effective_at,NULL,'Reversible test of coursework grade range'
    );
    PERFORM etl_control.start_hop_etl_execution(v_run,'Begin invalid grade check');
    BEGIN
        PERFORM etl_control.stage_hop_fact_coursework(
            v_run,1,
            '{"id_matricula":9006,"id_gestion":2025,"id_periodo":3,"id_alumno":1001,"id_ra":"RA-T001","id_programa":"P01","id_materia":501,"grupo":1,"nota":101,"estado":"A"}'::jsonb
        );
        RAISE EXCEPTION 'Out-of-range grade should have been rejected';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
END;
$$;
RESET SESSION AUTHORIZATION;
ROLLBACK;

-- Exercise student SCD2 initial version, same-hash no-op, changed attributes,
-- id conflict, and out-of-order protection with wholly reversible test rows.
BEGIN;
DO $$
DECLARE
    v_closure_1 BIGINT;
    v_closure_2 BIGINT;
    v_closure_3 BIGINT;
    v_effective_1 TIMESTAMPTZ;
    v_effective_2 TIMESTAMPTZ;
    v_run_1 UUID := 'a1300000-0000-0000-0000-000000000011';
    v_run_2 UUID := 'a1300000-0000-0000-0000-000000000012';
    v_run_3 UUID := 'a1300000-0000-0000-0000-000000000013';
    v_run_4 UUID := 'a1300000-0000-0000-0000-000000000014';
    v_run_5 UUID := 'a1300000-0000-0000-0000-000000000015';
    v_student JSONB := jsonb_build_object(
        'id_ra','SCD2-TEST1','id_alumno',99001,'id_sexo','F','estado_civil',1,
        'nac_pais',591,'id_colegio',10,'colegio','Colegio de prueba','tipo_colegio','P',
        'turno_colegio','D','area_colegio','U','cod_localidad',100,'localidad','Localidad de prueba',
        'cod_pais',591,'cod_departamento',1,'cod_provincia',1,'gestion_egreso_colegio',2020,
        'fec_inscripcion','2025-02-03','fec_egreso',NULL,'estado_academico','A','tipo_alumno','R',
        '_demographic_match',TRUE
    );
    v_changed JSONB;
    v_insert JSONB;
    v_sk BIGINT;
    v_result SMALLINT;
    v_close_count BIGINT;
    v_insert_count BIGINT;
    v_target TEXT;
    v_source RECORD;
    v_batch_count BIGINT;
    v_lock etl_control.etl_execution_lock;
BEGIN
    SELECT closure_id, effective_at INTO STRICT v_closure_1, v_effective_1
    FROM etl_control.academic_period_closure WHERE gestion=2025 AND periodo=1;
    SELECT closure_id, effective_at INTO STRICT v_closure_2, v_effective_2
    FROM etl_control.academic_period_closure WHERE gestion=2025 AND periodo=2;
    SELECT closure_id INTO STRICT v_closure_3
    FROM etl_control.academic_period_closure WHERE gestion=2025 AND periodo=3;

    PERFORM etl_control.create_hop_etl_execution(
        v_run_1,'CIERRE_ACADEMICO',v_closure_1,NULL,NULL,NULL,NULL,'SCD2 reversible integration test'
    );
    PERFORM etl_control.start_hop_etl_execution(v_run_1,'SCD2 test initial observation');
    IF etl_control.prepare_hop_student_scd2(v_run_1,v_student) <> 1 THEN
        RAISE EXCEPTION 'Initial valid student must stage one INSERT';
    END IF;
    SELECT record_data INTO STRICT v_insert FROM etl_work.hop_publication_row
    WHERE run_id=v_run_1 AND target_code='DIM_ESTUDIANTE' AND operation='INSERT';
    INSERT INTO dw.dim_estudiante (
        estudiante_sk, member_type, technical_label, id_ra, id_alumno, id_sexo, estado_civil,
        nac_pais, id_colegio, colegio, tipo_colegio, turno_colegio, area_colegio,
        cod_localidad, localidad, cod_pais, cod_departamento, cod_provincia,
        gestion_egreso_colegio, fec_inscripcion, fec_egreso, estado_academico, tipo_alumno,
        source_run_id, created_at, updated_at, valid_from, valid_to, is_current, attribute_hash_scd2
    )
    SELECT x.estudiante_sk, x.member_type, x.technical_label, x.id_ra, x.id_alumno, x.id_sexo,
        x.estado_civil, x.nac_pais, x.id_colegio, x.colegio, x.tipo_colegio, x.turno_colegio,
        x.area_colegio, x.cod_localidad, x.localidad, x.cod_pais, x.cod_departamento,
        x.cod_provincia, x.gestion_egreso_colegio, x.fec_inscripcion, x.fec_egreso,
        x.estado_academico, x.tipo_alumno, x.source_run_id, x.created_at, x.updated_at,
        x.valid_from, x.valid_to, x.is_current, x.attribute_hash_scd2
    FROM jsonb_populate_record(NULL::dw.dim_estudiante,v_insert) x;
    SELECT estudiante_sk INTO STRICT v_sk FROM dw.dim_estudiante
    WHERE id_alumno=99001 AND is_current;

    IF etl_control.prepare_hop_student_scd2(v_run_1,v_student) <> 0
       OR (SELECT count(*) FROM etl_work.hop_publication_row WHERE run_id=v_run_1 AND target_code='DIM_ESTUDIANTE') <> 1 THEN
        RAISE EXCEPTION 'An identical snapshot must not create another SCD2 version';
    END IF;
    PERFORM etl_control.fail_hop_etl_execution(v_run_1,'End reversible initial SCD2 test');

    v_changed := jsonb_set(v_student,'{estado_academico}','"I"'::jsonb);
    PERFORM etl_control.create_hop_etl_execution(
        v_run_2,'CIERRE_ACADEMICO',v_closure_2,NULL,NULL,NULL,NULL,'SCD2 changed-observation integration test'
    );
    PERFORM etl_control.start_hop_etl_execution(v_run_2,'SCD2 test changed observation');
    v_result := etl_control.prepare_hop_student_scd2(v_run_2,v_changed);
    SELECT count(*) FILTER (WHERE operation='CLOSE'),
           count(*) FILTER (WHERE operation='INSERT')
      INTO v_close_count, v_insert_count
    FROM etl_work.hop_publication_row
    WHERE run_id=v_run_2 AND target_code='DIM_ESTUDIANTE';
    IF v_result <> 2 OR v_close_count <> 1 OR v_insert_count <> 1 THEN
        RAISE EXCEPTION 'Changed SCD2 must stage CLOSE+INSERT (result %, close %, insert %)',
            v_result, v_close_count, v_insert_count;
    END IF;
    IF (SELECT (record_data->>'valid_to')::timestamptz FROM etl_work.hop_publication_row
        WHERE run_id=v_run_2 AND target_code='DIM_ESTUDIANTE' AND operation='CLOSE') <> v_effective_2
       OR (SELECT record_data->>'attribute_hash_scd2' FROM etl_work.hop_publication_row
           WHERE run_id=v_run_2 AND target_code='DIM_ESTUDIANTE' AND operation='INSERT')
          = (SELECT attribute_hash_scd2 FROM dw.dim_estudiante WHERE estudiante_sk=v_sk) THEN
        RAISE EXCEPTION 'SCD2 transition must close at the DSA cut and change the canonical hash';
    END IF;

    -- Complete the run's manifest/control gates and invoke the real atomic
    -- publisher so CLOSE + INSERT are tested against the physical SCD2 guards.
    FOR v_source IN
        SELECT * FROM (VALUES
            ('public.uatf_datos','public','uatf_datos'),
            ('academico.alumnos','academico','alumnos'),
            ('public.postulantes','public','postulantes'),
            ('academico.alm_programas','academico','alm_programas'),
            ('academico.pln_materias','academico','pln_materias'),
            ('academico.notas_planilla','academico','notas_planilla'),
            ('academico.alm_programas_facultades','academico','alm_programas_facultades'),
            ('public.prs_colegios','public','prs_colegios'),
            ('public.lugar_localidad','public','lugar_localidad')
        ) AS expected(contract_id,source_schema,source_object)
    LOOP
        PERFORM etl_control.register_etl_source_manifest(
            v_run_2, v_source.contract_id::varchar(150), 'DW-001/v1'::varchar(64),
            v_source.source_schema::varchar(63), v_source.source_object::varchar(63),
            repeat('a',64)::char(64), 'integration-order'::text, 'COMPLETO'::varchar(16),
            repeat('b',64)::char(64), NULL::smallint, NULL::smallint, NULL::timestamptz,
            0::bigint, '{}'::jsonb
        );
    END LOOP;
    PERFORM etl_control.register_etl_execution_step(
        v_run_2,'student-transform'::varchar(100),'TRANSFORMACION'::varchar(20),'EXITOSO'::varchar(16),
        25::smallint,'SCD2 fixture'::text,'test-v1'::varchar(255),'{}'::jsonb
    );
    PERFORM etl_control.register_etl_execution_step(
        v_run_2,'student-validation'::varchar(100),'VALIDACION'::varchar(20),'EXITOSO'::varchar(16),
        80::smallint,'SCD2 fixture'::text,'test-v1'::varchar(255),'{}'::jsonb
    );
    FOREACH v_target IN ARRAY ARRAY[
        'DIM_ESTUDIANTE','DIM_PROGRAMA','DIM_MATERIA','DIM_PERIODO_ACADEMICO',
        'DIM_ADMISION','FACT_ADMISION','FACT_CURSADO','FACT_RETENCION_DESERCION'
    ] LOOP
        SELECT count(*) INTO v_batch_count FROM etl_work.hop_publication_row
        WHERE run_id=v_run_2 AND target_code=v_target;
        PERFORM etl_control.seal_hop_publication_batch(v_run_2,v_target::varchar(40),v_batch_count);
    END LOOP;
    v_lock := etl_control.acquire_hop_publication_lock(v_run_2,900);
    PERFORM etl_control.begin_hop_publication(v_run_2,v_lock.lock_token,'SCD2 test publication');
    PERFORM etl_control.publish_hop_staged_run(v_run_2,v_lock.lock_token,'Apply test SCD2 transition atomically');
    IF (SELECT count(*) FROM dw.dim_estudiante
        WHERE id_alumno=99001 AND member_type='STANDARD') <> 2
       OR (SELECT count(*) FROM dw.dim_estudiante
           WHERE id_alumno=99001 AND is_current AND estado_academico='I') <> 1
       OR (SELECT count(*) FROM dw.dim_estudiante
           WHERE id_alumno=99001 AND NOT is_current AND valid_to=v_effective_2) <> 1 THEN
        RAISE EXCEPTION 'Atomic publisher did not apply the SCD2 close and new current version';
    END IF;

    PERFORM etl_control.create_hop_etl_execution(
        v_run_3,'CIERRE_ACADEMICO',v_closure_3,NULL,NULL,NULL,NULL,'SCD2 unchanged replay test'
    );
    PERFORM etl_control.start_hop_etl_execution(v_run_3,'SCD2 test unchanged replay');
    IF etl_control.prepare_hop_student_scd2(v_run_3,v_changed) <> 0
       OR EXISTS (SELECT 1 FROM etl_work.hop_publication_row WHERE run_id=v_run_3 AND target_code='DIM_ESTUDIANTE') THEN
        RAISE EXCEPTION 'Same attributes at the same closure must be a no-op';
    END IF;
    PERFORM etl_control.fail_hop_etl_execution(v_run_3,'End reversible unchanged SCD2 test');

    PERFORM etl_control.create_hop_etl_execution(
        v_run_4,'CIERRE_ACADEMICO',v_closure_3,NULL,NULL,NULL,NULL,'SCD2 identity conflict test'
    );
    PERFORM etl_control.start_hop_etl_execution(v_run_4,'SCD2 test identity conflict');
    BEGIN
        PERFORM etl_control.prepare_hop_student_scd2(
            v_run_4,jsonb_set(v_changed,'{id_ra}','"SCD2-OTHER"'::jsonb)
        );
        RAISE EXCEPTION 'Expected ambiguous id_ra/id_alumno association to be rejected';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
    PERFORM etl_control.fail_hop_etl_execution(v_run_4,'End reversible identity conflict test');

    PERFORM etl_control.create_hop_etl_execution(
        v_run_5,'CIERRE_ACADEMICO',v_closure_1,NULL,NULL,NULL,NULL,'SCD2 out-of-order test'
    );
    PERFORM etl_control.start_hop_etl_execution(v_run_5,'SCD2 test out-of-order snapshot');
    BEGIN
        PERFORM etl_control.prepare_hop_student_scd2(v_run_5,v_changed);
        RAISE EXCEPTION 'Expected older closure to be rejected';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
    PERFORM etl_control.fail_hop_etl_execution(v_run_5,'End reversible out-of-order test');
END;
$$;
ROLLBACK;

SELECT 'Apache Hop 9-source extraction, 5 dimensions, 2 private fact batches (17 staged rows), grade-range rejection, and SCD2 tests passed; retention gate kept publication disabled' AS result;
