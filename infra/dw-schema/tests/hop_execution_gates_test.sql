-- DW-MVP-002: Hop-facing closure, source-manifest, lock and privilege gates.
-- Synthetic data only; always rolled back.
BEGIN;

INSERT INTO etl_control.academic_period_closure (
    gestion, periodo, created_by_subject, closure_reason
) VALUES
    (2097, 91, 'dsa:test', 'Prueba cierre elegible'),
    (2097, 92, 'dsa:test', 'Prueba cierre no elegible');

DO $$
BEGIN
    BEGIN
        PERFORM etl_control.create_hop_etl_execution(
            'a1000000-0000-0000-0000-000000000001', 'CIERRE_ACADEMICO',
            (SELECT closure_id FROM etl_control.academic_period_closure WHERE gestion = 2097 AND periodo = 92),
            NULL, NULL, NULL, NULL, 'debe rechazarse'
        );
        RAISE EXCEPTION 'Se aceptó un periodo pendiente';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END;
$$;

SELECT etl_control.transition_academic_period_closure(
    2097::smallint, 91::smallint, 'CERRADO'::varchar(16), 'dsa:test'::varchar(255),
    'Aprobación fixture', clock_timestamp() - interval '1 minute'
);

SELECT closure_id AS hop_test_closure_id
FROM etl_control.academic_period_closure
WHERE gestion = 2097 AND periodo = 91
\gset
CREATE TEMP TABLE hop_test_closure (closure_id BIGINT);
INSERT INTO hop_test_closure VALUES (:'hop_test_closure_id'::bigint);
GRANT SELECT ON hop_test_closure TO dw_hop_runtime;

SET LOCAL ROLE dw_hop_runtime;
SELECT etl_control.create_hop_etl_execution(
    'a1000000-0000-0000-0000-000000000001', 'CIERRE_ACADEMICO',
    :'hop_test_closure_id'::bigint,
    NULL, NULL, NULL, NULL, 'Prueba de gates Hop'
);
SELECT etl_control.start_hop_etl_execution('a1000000-0000-0000-0000-000000000001', 'Inicio de prueba');
DO $$
DECLARE v_closure_id BIGINT;
BEGIN
    SELECT closure_id INTO v_closure_id FROM pg_temp.hop_test_closure;
    BEGIN
        PERFORM etl_control.create_hop_etl_execution(
            'a1000000-0000-0000-0000-000000000002'::uuid, 'CIERRE_ACADEMICO'::varchar(24),
            v_closure_id, NULL, NULL, NULL, NULL, 'Solicitud concurrente'
        );
        RAISE EXCEPTION 'Se admitieron dos ejecuciones activas para el mismo cierre';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END;
$$;

SELECT etl_control.create_hop_etl_execution(
    'a1000000-0000-0000-0000-000000000003'::uuid, 'HISTORICA'::varchar(24), NULL::bigint,
    2097::smallint, 91::smallint, '2097-11-30 18:00:00+00'::timestamptz,
    NULL::uuid, 'Intento base para probar retry'::text
);
SELECT etl_control.start_hop_etl_execution('a1000000-0000-0000-0000-000000000003', 'Inicio base');
SELECT etl_control.fail_hop_etl_execution('a1000000-0000-0000-0000-000000000003', 'Fallo fixture para retry');
DO $$
BEGIN
    BEGIN
        PERFORM etl_control.create_hop_etl_execution(
            'a1000000-0000-0000-0000-000000000004'::uuid, 'REPROCESO'::varchar(24), NULL,
            2097::smallint, 92::smallint, '2097-11-30 18:00:00+00'::timestamptz,
            'a1000000-0000-0000-0000-000000000003'::uuid, 'Alcance distinto'
        );
        RAISE EXCEPTION 'El reproceso cambió el periodo del intento anterior';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    PERFORM etl_control.create_hop_etl_execution(
        'a1000000-0000-0000-0000-000000000005'::uuid, 'REPROCESO'::varchar(24), NULL,
        2097::smallint, 91::smallint, '2097-11-30 18:00:00+00'::timestamptz,
        'a1000000-0000-0000-0000-000000000003'::uuid, 'Mismo alcance'
    );
END;
$$;

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
    i INTEGER;
    v_lock etl_control.etl_execution_lock;
BEGIN
    FOR i IN 1..8 LOOP
        PERFORM etl_control.register_etl_source_manifest(
            'a1000000-0000-0000-0000-000000000001'::uuid,
            v_ids[i]::varchar(150), 'v1'::varchar(64), v_schemas[i]::varchar(63), v_objects[i]::varchar(63),
            repeat('a', 64)::char(64), 'contract-order-key'::text, 'COMPLETO'::varchar(16),
            repeat('b', 64)::char(64), 2097::smallint, 91::smallint, clock_timestamp(), 0::bigint, '{}'::jsonb
        );
    END LOOP;
    PERFORM etl_control.register_etl_execution_step(
        'a1000000-0000-0000-0000-000000000001'::uuid,
        'validate'::varchar(100), 'VALIDACION'::varchar(20), 'EXITOSO'::varchar(16),
        1::smallint, 'hop-test'::text, 'test'::varchar(255), '{}'::jsonb
    );

    BEGIN
        v_lock := etl_control.acquire_hop_publication_lock('a1000000-0000-0000-0000-000000000001', 60);
        BEGIN
            PERFORM etl_control.begin_hop_publication(
                'a1000000-0000-0000-0000-000000000001', v_lock.lock_token, 'Debe faltar una fuente'
            );
            RAISE EXCEPTION 'Se permitió publicar con solo ocho manifiestos';
        EXCEPTION WHEN check_violation THEN NULL;
        END;
        PERFORM etl_control.release_hop_publication_lock(
            'a1000000-0000-0000-0000-000000000001', v_lock.lock_token, 'Liberación de prueba negativa'
        );
    END;

    PERFORM etl_control.register_etl_source_manifest(
        'a1000000-0000-0000-0000-000000000001'::uuid,
        v_ids[9]::varchar(150), 'v1'::varchar(64), v_schemas[9]::varchar(63), v_objects[9]::varchar(63),
        repeat('a', 64)::char(64), 'cod_loc'::text, 'COMPLETO'::varchar(16),
        repeat('b', 64)::char(64), 2097::smallint, 91::smallint, clock_timestamp(), 0::bigint, '{}'::jsonb
    );
END;
$$;

DO $$
DECLARE v_lock etl_control.etl_execution_lock;
BEGIN
    v_lock := etl_control.acquire_hop_publication_lock('a1000000-0000-0000-0000-000000000001', 60);
    PERFORM etl_control.begin_hop_publication(
        'a1000000-0000-0000-0000-000000000001', v_lock.lock_token, 'Nueve fuentes completas'
    );
    PERFORM etl_control.release_hop_publication_lock(
        'a1000000-0000-0000-0000-000000000001', v_lock.lock_token, 'Fin de prueba'
    );
END;
$$;

RESET ROLE;
DO $$
BEGIN
    IF (SELECT status FROM etl_control.etl_execution
        WHERE run_id = 'a1000000-0000-0000-0000-000000000001') <> 'PUBLICANDO' THEN
        RAISE EXCEPTION 'La función gate no inició la publicación';
    END IF;
    IF has_table_privilege('dw_hop_runtime', 'dw.fact_admision', 'INSERT')
       OR has_table_privilege('dw_hop_runtime', 'etl_control.etl_execution', 'INSERT')
       OR has_function_privilege('dw_hop_runtime',
            'etl_control.complete_etl_execution(uuid,character varying,text)', 'EXECUTE')
       OR has_function_privilege('dw_hop_runtime',
            'etl_control.begin_etl_publication(uuid,character varying,text)', 'EXECUTE') THEN
        RAISE EXCEPTION 'El rol Hop posee privilegios directos de escritura o finalización';
    END IF;
END;
$$;

ROLLBACK;
