-- DW-MVP-003: verifies the prepared-data API and one-transaction fenced publish.
-- Synthetic rows only; the entire test is rolled back.
BEGIN;

SELECT etl_control.create_hop_etl_execution(
    'b1100000-0000-0000-0000-000000000001'::uuid,
    'HISTORICA'::varchar(24), NULL::bigint, NULL::smallint, NULL::smallint,
    NULL::timestamptz, NULL::uuid, 'Prueba sintética del publisher atómico'::text
);
SET LOCAL ROLE dw_hop_runtime;

SELECT etl_control.start_hop_etl_execution(
    'b1100000-0000-0000-0000-000000000001'::uuid, 'Inicio publisher fixture'
);

DO $$
DECLARE
    v_ids TEXT[] := ARRAY[
        'public.uatf_datos', 'academico.alumnos', 'public.postulantes',
        'academico.alm_programas', 'academico.pln_materias', 'academico.notas_planilla',
        'academico.alm_programas_facultades', 'public.prs_colegios', 'public.lugar_localidad'
    ];
    v_schemas TEXT[] := ARRAY[
        'public', 'academico', 'public', 'academico', 'academico', 'academico',
        'academico', 'public', 'public'
    ];
    v_objects TEXT[] := ARRAY[
        'uatf_datos', 'alumnos', 'postulantes', 'alm_programas', 'pln_materias',
        'notas_planilla', 'alm_programas_facultades', 'prs_colegios', 'lugar_localidad'
    ];
    v_dim_sk BIGINT;
    v_i INTEGER;
BEGIN
    FOR v_i IN 1..9 LOOP
        PERFORM etl_control.register_etl_source_manifest(
            'b1100000-0000-0000-0000-000000000001'::uuid,
            v_ids[v_i]::varchar(150), 'v1'::varchar(64),
            v_schemas[v_i]::varchar(63), v_objects[v_i]::varchar(63),
            repeat('a', 64)::char(64), 'fixture-order'::text, 'COMPLETO'::varchar(16),
            repeat('b', 64)::char(64), NULL::smallint, NULL::smallint,
            NULL::timestamptz, 0::bigint, '{}'::jsonb
        );
    END LOOP;

    PERFORM etl_control.register_etl_execution_step(
        'b1100000-0000-0000-0000-000000000001'::uuid, 'extract'::varchar(100),
        'EXTRACCION'::varchar(20), 'EXITOSO'::varchar(16), 1::smallint,
        'fixture'::text, 'test'::varchar(255), '{}'::jsonb
    );
    PERFORM etl_control.register_etl_execution_step(
        'b1100000-0000-0000-0000-000000000001'::uuid, 'transform'::varchar(100),
        'TRANSFORMACION'::varchar(20), 'EXITOSO'::varchar(16), 2::smallint,
        'fixture'::text, 'test'::varchar(255), '{}'::jsonb
    );
    PERFORM etl_control.register_etl_execution_step(
        'b1100000-0000-0000-0000-000000000001'::uuid, 'validate'::varchar(100),
        'VALIDACION'::varchar(20), 'EXITOSO'::varchar(16), 3::smallint,
        'fixture'::text, 'test'::varchar(255), '{}'::jsonb
    );

    v_dim_sk := etl_control.reserve_hop_dimension_key('programa');
    PERFORM etl_control.stage_hop_publication_row(
        'b1100000-0000-0000-0000-000000000001', 'DIM_PROGRAMA', 1, 'INSERT', 'programa:T91',
        jsonb_build_object(
            'programa_sk', v_dim_sk, 'member_type', 'STANDARD', 'technical_label', NULL,
            'id_programa', 'T91', 'programa', 'Programa de prueba', 'id_facultad', NULL,
            'facultad', NULL, 'facultad_abreviatura', NULL, 'id_nivel', NULL, 'nivel', NULL,
            'sede', NULL, 'tipo_academico', 'CAR', 'activo', '1',
            'source_run_id', 'b1100000-0000-0000-0000-000000000001',
            'created_at', clock_timestamp(), 'updated_at', clock_timestamp()
        )
    );

    -- Wrong declared row count must be rejected, and leave the batch unsealed.
    BEGIN
        PERFORM etl_control.seal_hop_publication_batch(
            'b1100000-0000-0000-0000-000000000001', 'DIM_PROGRAMA', 2
        );
        RAISE EXCEPTION 'Se aceptó un conteo de lote incorrecto';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    PERFORM etl_control.seal_hop_publication_batch(
        'b1100000-0000-0000-0000-000000000001', 'DIM_PROGRAMA', 1
    );
    PERFORM etl_control.seal_hop_publication_batch(
        'b1100000-0000-0000-0000-000000000001', v_ids_for_batch.target_code, 0
    ) FROM (VALUES
        ('DIM_ESTUDIANTE'), ('DIM_MATERIA'), ('DIM_PERIODO_ACADEMICO'), ('DIM_ADMISION'),
        ('FACT_ADMISION'), ('FACT_CURSADO'), ('FACT_RETENCION_DESERCION')
    ) AS v_ids_for_batch(target_code);

END;
$$;

-- Capture the lock token returned by the authorized API; the runtime cannot query lock rows.
SELECT (etl_control.acquire_hop_publication_lock(
    'b1100000-0000-0000-0000-000000000001', 300
)).lock_token AS publisher_test_lock_token
\gset

SELECT etl_control.begin_hop_publication(
    'b1100000-0000-0000-0000-000000000001', :'publisher_test_lock_token'::uuid,
    'Nueve manifiestos y ocho lotes sellados'
);
SELECT etl_control.publish_hop_staged_run(
    'b1100000-0000-0000-0000-000000000001', :'publisher_test_lock_token'::uuid,
    'Publicación fixture confirmada'
);

RESET ROLE;
DO $$
BEGIN
    IF (SELECT status FROM etl_control.etl_execution
        WHERE run_id = 'b1100000-0000-0000-0000-000000000001') <> 'EXITOSA' THEN
        RAISE EXCEPTION 'El publisher no completó la ejecución';
    END IF;
    IF (SELECT count(*) FROM dw.dim_programa
        WHERE id_programa = 'T91' AND source_run_id = 'b1100000-0000-0000-0000-000000000001') <> 1 THEN
        RAISE EXCEPTION 'El registro preparado no se publicó en la dimensión';
    END IF;
    IF EXISTS (SELECT 1 FROM etl_work.hop_publication_row
               WHERE run_id = 'b1100000-0000-0000-0000-000000000001') THEN
        RAISE EXCEPTION 'Los datos preparados no fueron retirados tras publicación exitosa';
    END IF;
    IF (SELECT count(*) FROM etl_work.hop_publication_batch
        WHERE run_id = 'b1100000-0000-0000-0000-000000000001') <> 8 THEN
        RAISE EXCEPTION 'No se conservó la evidencia resumida de los lotes';
    END IF;
    IF EXISTS (SELECT 1 FROM etl_work.hop_publication_batch
               WHERE run_id = 'b1100000-0000-0000-0000-000000000001'
                 AND batch_sha256 !~ '^[0-9a-f]{64}$') THEN
        RAISE EXCEPTION 'No se calculó el SHA-256 canónico del lote';
    END IF;
    IF EXISTS (SELECT 1 FROM etl_control.etl_execution_lock
               WHERE run_id = 'b1100000-0000-0000-0000-000000000001'
                 AND resource_key = 'dw:mvp-publication' AND released_at IS NULL) THEN
        RAISE EXCEPTION 'El publisher dejó un lease activo tras el commit lógico';
    END IF;
    IF has_table_privilege('dw_hop_runtime', 'dw.dim_programa', 'INSERT')
       OR has_table_privilege('dw_hop_runtime', 'dw.fact_cursado', 'DELETE')
       OR has_table_privilege('dw_hop_runtime', 'etl_work.hop_publication_row', 'INSERT') THEN
        RAISE EXCEPTION 'Hop tiene DML directo fuera de la API SECURITY DEFINER';
    END IF;
END;
$$;

ROLLBACK;
