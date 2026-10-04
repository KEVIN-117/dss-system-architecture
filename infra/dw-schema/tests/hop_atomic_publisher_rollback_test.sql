-- Proves a bad prepared fact rolls back the delete/replace and audited abort is safe.
BEGIN;

SELECT etl_control.create_hop_etl_execution(
    'b1200000-0000-0000-0000-000000000001'::uuid,
    'HISTORICA'::varchar(24), NULL::bigint, NULL::smallint, NULL::smallint,
    NULL::timestamptz, NULL::uuid, 'Publicación previamente confirmada para rollback test'::text
);
INSERT INTO dw.fact_admision (
    estudiante_sk, programa_sk, periodo_academico_sk, admision_sk,
    id_alumno_origen, id_programa_origen, conteo_postulacion, run_id
) VALUES (
    -1, -1, -1, 0, 7001, 'OLD', 1, 'b1200000-0000-0000-0000-000000000001'
);

SELECT etl_control.create_hop_etl_execution(
    'b1200000-0000-0000-0000-000000000002'::uuid,
    'HISTORICA'::varchar(24), NULL::bigint, NULL::smallint, NULL::smallint,
    NULL::timestamptz, NULL::uuid, 'Intento fallido de publicación para rollback test'::text
);
SELECT etl_control.start_hop_etl_execution(
    'b1200000-0000-0000-0000-000000000002'::uuid, 'Inicio test rollback'
);

DO $$
DECLARE
    v_ids TEXT[] := ARRAY[
        'public.uatf_datos', 'academico.alumnos', 'public.postulantes',
        'academico.alm_programas', 'academico.pln_materias', 'academico.notas_planilla',
        'academico.alm_programas_facultades', 'public.prs_colegios', 'public.lugar_localidad'
    ];
    v_schemas TEXT[] := ARRAY['public','academico','public','academico','academico','academico','academico','public','public'];
    v_objects TEXT[] := ARRAY['uatf_datos','alumnos','postulantes','alm_programas','pln_materias','notas_planilla','alm_programas_facultades','prs_colegios','lugar_localidad'];
    v_token UUID;
    v_i INTEGER;
    v_failed BOOLEAN := FALSE;
BEGIN
    FOR v_i IN 1..9 LOOP
        PERFORM etl_control.register_etl_source_manifest(
            'b1200000-0000-0000-0000-000000000002'::uuid, v_ids[v_i]::varchar(150), 'v1'::varchar(64),
            v_schemas[v_i]::varchar(63), v_objects[v_i]::varchar(63), repeat('a',64)::char(64),
            'fixture-order'::text, 'COMPLETO'::varchar(16), repeat('b',64)::char(64),
            NULL::smallint, NULL::smallint, NULL::timestamptz, 0::bigint, '{}'::jsonb
        );
    END LOOP;
    PERFORM etl_control.register_etl_execution_step('b1200000-0000-0000-0000-000000000002'::uuid,'extract'::varchar(100),'EXTRACCION'::varchar(20),'EXITOSO'::varchar(16),1::smallint,'fixture'::text,'test'::varchar(255),'{}'::jsonb);
    PERFORM etl_control.register_etl_execution_step('b1200000-0000-0000-0000-000000000002'::uuid,'transform'::varchar(100),'TRANSFORMACION'::varchar(20),'EXITOSO'::varchar(16),2::smallint,'fixture'::text,'test'::varchar(255),'{}'::jsonb);
    PERFORM etl_control.register_etl_execution_step('b1200000-0000-0000-0000-000000000002'::uuid,'validate'::varchar(100),'VALIDACION'::varchar(20),'EXITOSO'::varchar(16),3::smallint,'fixture'::text,'test'::varchar(255),'{}'::jsonb);

    -- Empty sealed dimension batches; invalid program code trips a DW CHECK only
    -- after the publisher has attempted to replace the prior fact set.
    PERFORM etl_control.seal_hop_publication_batch('b1200000-0000-0000-0000-000000000002'::uuid, x.target_code::varchar(40), 0::bigint)
    FROM (VALUES ('DIM_ESTUDIANTE'),('DIM_PROGRAMA'),('DIM_MATERIA'),('DIM_PERIODO_ACADEMICO'),('DIM_ADMISION'),('FACT_CURSADO'),('FACT_RETENCION_DESERCION')) x(target_code);
    PERFORM etl_control.stage_hop_publication_row(
        'b1200000-0000-0000-0000-000000000002'::uuid,'FACT_ADMISION'::varchar(40),1::bigint,'INSERT'::varchar(16),'bad-admission'::text,
        jsonb_build_object('estudiante_sk',-1,'programa_sk',-1,'periodo_academico_sk',-1,'admision_sk',0,
            'id_alumno_origen',7002,'id_programa_origen','','conteo_postulacion',1)
    );
    PERFORM etl_control.seal_hop_publication_batch('b1200000-0000-0000-0000-000000000002'::uuid,'FACT_ADMISION'::varchar(40),1::bigint);

    v_token := (etl_control.acquire_hop_publication_lock('b1200000-0000-0000-0000-000000000002'::uuid,300::integer)).lock_token;
    PERFORM etl_control.begin_hop_publication('b1200000-0000-0000-0000-000000000002'::uuid,v_token,'Fixture de rollback'::text);
    BEGIN
        PERFORM etl_control.publish_hop_staged_run('b1200000-0000-0000-0000-000000000002'::uuid,v_token,'Debe revertir por CHECK'::text);
    EXCEPTION WHEN check_violation THEN
        v_failed := TRUE;
    END;
    IF NOT v_failed THEN RAISE EXCEPTION 'El publisher aceptó una fila dimensional inválida'; END IF;
    IF (SELECT count(*) FROM dw.fact_admision WHERE id_alumno_origen=7001 AND id_programa_origen='OLD') <> 1 THEN
        RAISE EXCEPTION 'Una publicación fallida eliminó la publicación anterior';
    END IF;
    IF (SELECT status FROM etl_control.etl_execution WHERE run_id='b1200000-0000-0000-0000-000000000002') <> 'PUBLICANDO' THEN
        RAISE EXCEPTION 'El fallo parcial del publisher no revirtió el estado de ejecución';
    END IF;
    PERFORM etl_control.abort_hop_publication(
        'b1200000-0000-0000-0000-000000000002'::uuid,v_token,'Fila inválida; se conserva la publicación anterior'::text
    );
    IF (SELECT status FROM etl_control.etl_execution WHERE run_id='b1200000-0000-0000-0000-000000000002') <> 'FALLIDA' THEN
        RAISE EXCEPTION 'La ruta de aborto no dejó la ejecución FALLIDA';
    END IF;
    IF EXISTS (SELECT 1 FROM etl_control.etl_execution_lock WHERE run_id='b1200000-0000-0000-0000-000000000002' AND released_at IS NULL) THEN
        RAISE EXCEPTION 'La ruta de aborto dejó un lease activo';
    END IF;
    IF EXISTS (SELECT 1 FROM etl_work.hop_publication_row WHERE run_id='b1200000-0000-0000-0000-000000000002') THEN
        RAISE EXCEPTION 'La ruta de aborto retuvo filas preparadas que pueden incluir datos personales';
    END IF;
    IF NOT has_function_privilege('dw_hop_runtime',
        'etl_control.abort_hop_publication(uuid,uuid,text)', 'EXECUTE') THEN
        RAISE EXCEPTION 'El runtime no puede invocar la ruta de fallo prevista';
    END IF;
    IF has_table_privilege('dw_hop_runtime','etl_work.hop_publication_batch','INSERT')
       OR has_table_privilege('dw_hop_runtime','etl_work.hop_publication_row','UPDATE')
       OR has_table_privilege('dw_hop_runtime','dw.fact_admision','INSERT')
       OR has_table_privilege('dw_hop_runtime','dw.dim_estudiante','UPDATE') THEN
        RAISE EXCEPTION 'El runtime obtuvo escritura directa fuera de las APIs aprobadas';
    END IF;
END;
$$;

ROLLBACK;
