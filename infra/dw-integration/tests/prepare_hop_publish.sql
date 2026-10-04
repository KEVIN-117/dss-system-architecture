\set ON_ERROR_STOP on
BEGIN;
SELECT etl_control.create_hop_etl_execution(
    'b1300000-0000-0000-0000-000000000001'::uuid,
    'HISTORICA'::varchar(24), NULL::bigint, NULL::smallint, NULL::smallint,
    NULL::timestamptz, NULL::uuid, 'Integration fixture for Hop atomic publisher'::text
);
SELECT etl_control.start_hop_etl_execution(
    'b1300000-0000-0000-0000-000000000001'::uuid, 'Publisher integration fixture'
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
    v_i INTEGER;
BEGIN
    FOR v_i IN 1..9 LOOP
        PERFORM etl_control.register_etl_source_manifest(
            'b1300000-0000-0000-0000-000000000001'::uuid, v_ids[v_i]::varchar(150), 'v1'::varchar(64),
            v_schemas[v_i]::varchar(63), v_objects[v_i]::varchar(63), repeat('a',64)::char(64),
            'integration-order'::text, 'COMPLETO'::varchar(16), repeat('b',64)::char(64),
            NULL::smallint, NULL::smallint, NULL::timestamptz, 0::bigint, '{}'::jsonb
        );
    END LOOP;
    PERFORM etl_control.register_etl_execution_step(
        'b1300000-0000-0000-0000-000000000001'::uuid,'extract'::varchar(100),'EXTRACCION'::varchar(20),'EXITOSO'::varchar(16),1::smallint,'fixture'::text,'test'::varchar(255),'{}'::jsonb);
    PERFORM etl_control.register_etl_execution_step(
        'b1300000-0000-0000-0000-000000000001'::uuid,'transform'::varchar(100),'TRANSFORMACION'::varchar(20),'EXITOSO'::varchar(16),2::smallint,'fixture'::text,'test'::varchar(255),'{}'::jsonb);
    PERFORM etl_control.register_etl_execution_step(
        'b1300000-0000-0000-0000-000000000001'::uuid,'validate'::varchar(100),'VALIDACION'::varchar(20),'EXITOSO'::varchar(16),3::smallint,'fixture'::text,'test'::varchar(255),'{}'::jsonb);
    PERFORM etl_control.seal_hop_publication_batch(
        'b1300000-0000-0000-0000-000000000001'::uuid, target_code::varchar(40), 0::bigint)
    FROM (VALUES ('DIM_ESTUDIANTE'),('DIM_PROGRAMA'),('DIM_MATERIA'),('DIM_PERIODO_ACADEMICO'),
                 ('DIM_ADMISION'),('FACT_ADMISION'),('FACT_CURSADO'),('FACT_RETENCION_DESERCION')) AS x(target_code);
END;
$$;
COMMIT;
