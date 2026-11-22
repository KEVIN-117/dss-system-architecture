-- LM-002 (#350): Load Manager catalog, launches, schedules and privileges.
-- Synthetic data only; always rolled back. Commands run as dw_control_service,
-- the NOLOGIN group of the dw-control-service runtime LOGIN.
BEGIN;

-- Catalog -------------------------------------------------------------------
DO $$
BEGIN
    IF (SELECT count(*) FROM etl_control.etl_process) <> 3
       OR NOT EXISTS (SELECT 1 FROM etl_control.etl_process
                      WHERE process_code = 'VERTICAL_LOAD'
                        AND workflow_file = 'workflows/wf_vertical_uatf_datos_smoke.hwf'
                        AND schedule_mode = 'AUTO_PENDING_CLOSURES'
                        AND parameter_names @> ARRAY['P_RUN_ID', 'P_REQUESTED_GESTION', 'P_REQUESTED_PERIODO',
                                                     'P_EXECUTION_KIND', 'P_RETRY_OF_RUN_ID'])
       OR NOT EXISTS (SELECT 1 FROM etl_control.etl_process
                      WHERE process_code = 'CATALOG_SYNC' AND parameter_names = ARRAY[]::TEXT[]
                        AND schedule_mode = 'NO_PARAMETERS')
       OR NOT EXISTS (SELECT 1 FROM etl_control.etl_process
                      WHERE process_code = 'PUBLISH_STAGED' AND schedule_mode IS NULL) THEN
        RAISE EXCEPTION 'El catálogo del Load Manager no coincide con el contrato de Hop Server';
    END IF;
END;
$$;

INSERT INTO etl_control.academic_period_closure (gestion, periodo, created_by_subject, closure_reason)
VALUES (2096, 81, 'dsa:test', 'Cierre fixture del Load Manager');

-- Privileges ----------------------------------------------------------------
SET LOCAL ROLE dw_control_service;

DO $$
BEGIN
    PERFORM count(*) FROM etl_control.etl_launch;
    PERFORM count(*) FROM etl_control.etl_schedule_event;
    BEGIN
        INSERT INTO etl_control.etl_launch (launch_id, process_code, trigger_kind, requested_by)
        VALUES ('b2000000-0000-0000-0000-0000000000ff', 'CATALOG_SYNC', 'MANUAL', 'directo');
        RAISE EXCEPTION 'dw_control_service escribió etl_launch sin pasar por las funciones';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        UPDATE etl_control.etl_process SET enabled = FALSE;
        RAISE EXCEPTION 'dw_control_service modificó el catálogo';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;

-- Launch lifecycle ----------------------------------------------------------
SELECT etl_control.request_etl_launch(
    'b2000000-0000-0000-0000-000000000001', 'CATALOG_SYNC', 'admin:test'
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM etl_control.etl_launch
                   WHERE launch_id = 'b2000000-0000-0000-0000-000000000001'
                     AND status = 'QUEUED' AND trigger_kind = 'MANUAL' AND finished_at IS NULL)
       OR NOT EXISTS (SELECT 1 FROM etl_control.etl_launch_event
                      WHERE launch_id = 'b2000000-0000-0000-0000-000000000001'
                        AND event_type = 'REQUESTED' AND actor = 'admin:test') THEN
        RAISE EXCEPTION 'La solicitud no quedó en QUEUED con su evento de auditoría';
    END IF;

    BEGIN
        PERFORM etl_control.request_etl_launch('b2000000-0000-0000-0000-000000000002', 'CATALOG_SYNC', 'admin:test');
        RAISE EXCEPTION 'Se aceptaron dos lanzamientos activos del mismo proceso';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    BEGIN
        PERFORM etl_control.request_etl_launch('b2000000-0000-0000-0000-000000000003', 'NO_EXISTE', 'admin:test');
        RAISE EXCEPTION 'Se aceptó un proceso inexistente';
    EXCEPTION WHEN no_data_found THEN NULL;
    END;

    BEGIN
        PERFORM etl_control.request_etl_launch(
            'b2000000-0000-0000-0000-000000000003', 'PUBLISH_STAGED', 'admin:test',
            '{"P_REQUESTED_GESTION": "2096"}'::jsonb
        );
        RAISE EXCEPTION 'Se aceptó un parámetro fuera del contrato del workflow';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;

    BEGIN
        PERFORM etl_control.request_etl_launch(
            'b2000000-0000-0000-0000-000000000003', 'PUBLISH_STAGED', 'admin:test',
            '{"P_RUN_ID": "c3000000-0000-0000-0000-000000000001"}'::jsonb,
            NULL, 'c3000000-0000-0000-0000-000000000002'
        );
        RAISE EXCEPTION 'Se aceptó un P_RUN_ID distinto del run_id';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;

    BEGIN
        PERFORM etl_control.request_etl_launch(
            'b2000000-0000-0000-0000-000000000003', 'PUBLISH_STAGED', 'admin:test',
            '{"P_RUN_ID": 42}'::jsonb
        );
        RAISE EXCEPTION 'Se aceptó un parámetro no textual';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;

    BEGIN
        PERFORM etl_control.request_etl_launch('b2000000-0000-0000-0000-000000000003', 'CATALOG_SYNC', '  ');
        RAISE EXCEPTION 'Se aceptó una solicitud sin actor';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;

    BEGIN
        PERFORM etl_control.transition_etl_launch('b2000000-0000-0000-0000-000000000001', 'RUNNING', 'dw-control');
        RAISE EXCEPTION 'Se permitió QUEUED -> RUNNING sin enviar a Hop';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        PERFORM etl_control.transition_etl_launch('b2000000-0000-0000-0000-000000000001', 'SUBMITTED', 'dw-control');
        RAISE EXCEPTION 'Se aceptó SUBMITTED sin identificador de Hop';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
END;
$$;

SELECT etl_control.transition_etl_launch(
    'b2000000-0000-0000-0000-000000000001', 'SUBMITTED', 'dw-control',
    'd4000000-0000-0000-0000-000000000001'
);
SELECT etl_control.transition_etl_launch('b2000000-0000-0000-0000-000000000001', 'RUNNING', 'dw-control');
SELECT etl_control.transition_etl_launch(
    'b2000000-0000-0000-0000-000000000001', 'RUNNING', 'dw-control', NULL, NULL, 'línea de log 1'
);

DO $$
BEGIN
    IF (SELECT count(*) FROM etl_control.etl_launch_event
        WHERE launch_id = 'b2000000-0000-0000-0000-000000000001' AND event_type = 'STATUS_CHANGED') <> 2
       OR NOT EXISTS (SELECT 1 FROM etl_control.etl_launch
                      WHERE launch_id = 'b2000000-0000-0000-0000-000000000001'
                        AND status = 'RUNNING' AND log_excerpt = 'línea de log 1'
                        AND submitted_at IS NOT NULL AND started_at IS NOT NULL) THEN
        RAISE EXCEPTION 'El refresco del monitor no debe crear eventos y sí conservar el log';
    END IF;
END;
$$;

SELECT etl_control.transition_etl_launch(
    'b2000000-0000-0000-0000-000000000001', 'SUCCEEDED', 'dw-control', NULL, 'Workflow finalizado sin errores'
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM etl_control.etl_launch
                   WHERE launch_id = 'b2000000-0000-0000-0000-000000000001'
                     AND status = 'SUCCEEDED' AND finished_at IS NOT NULL
                     AND result_summary = 'Workflow finalizado sin errores')
       OR NOT EXISTS (SELECT 1 FROM etl_control.etl_launch_event
                      WHERE launch_id = 'b2000000-0000-0000-0000-000000000001'
                        AND previous_status = 'RUNNING' AND new_status = 'SUCCEEDED') THEN
        RAISE EXCEPTION 'El lanzamiento no registró su resultado final';
    END IF;

    BEGIN
        PERFORM etl_control.transition_etl_launch('b2000000-0000-0000-0000-000000000001', 'FAILED', 'dw-control');
        RAISE EXCEPTION 'Se modificó un lanzamiento terminado';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        PERFORM etl_control.request_etl_launch_stop('b2000000-0000-0000-0000-000000000001', 'admin:test');
        RAISE EXCEPTION 'Se pidió detener un lanzamiento terminado';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END;
$$;

-- The finished launch frees the process: a new one is accepted.
SELECT etl_control.request_etl_launch('b2000000-0000-0000-0000-000000000004', 'CATALOG_SYNC', 'admin:test');
SELECT etl_control.request_etl_launch_stop('b2000000-0000-0000-0000-000000000004', 'admin:test');
SELECT etl_control.request_etl_launch_stop('b2000000-0000-0000-0000-000000000004', 'admin:otro');
SELECT etl_control.transition_etl_launch('b2000000-0000-0000-0000-000000000004', 'STOPPED', 'dw-control');

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM etl_control.etl_launch
                   WHERE launch_id = 'b2000000-0000-0000-0000-000000000004'
                     AND status = 'STOPPED' AND stop_requested_by = 'admin:test' AND finished_at IS NOT NULL)
       OR (SELECT count(*) FROM etl_control.etl_launch_event
           WHERE launch_id = 'b2000000-0000-0000-0000-000000000004' AND event_type = 'STOP_REQUESTED') <> 1 THEN
        RAISE EXCEPTION 'La detención debe registrarse una sola vez y conservar al primer actor';
    END IF;
END;
$$;

-- Vertical load linked to a closure, its run_id and Hop parameters.
SELECT etl_control.request_etl_launch(
    'b2000000-0000-0000-0000-000000000005', 'VERTICAL_LOAD', 'admin:test',
    jsonb_build_object(
        'P_RUN_ID', 'c3000000-0000-0000-0000-000000000005',
        'P_REQUESTED_GESTION', '2096', 'P_REQUESTED_PERIODO', '81',
        'P_EXECUTION_KIND', 'CIERRE_ACADEMICO'
    ),
    (SELECT closure_id FROM etl_control.academic_period_closure WHERE gestion = 2096 AND periodo = 81),
    'c3000000-0000-0000-0000-000000000005'
);
SELECT etl_control.transition_etl_launch(
    'b2000000-0000-0000-0000-000000000005', 'SUBMIT_FAILED', 'dw-control', NULL, 'Hop Server no respondió'
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM etl_control.etl_launch
                   WHERE launch_id = 'b2000000-0000-0000-0000-000000000005'
                     AND run_id = 'c3000000-0000-0000-0000-000000000005'
                     AND closure_id IS NOT NULL
                     AND parameters ->> 'P_REQUESTED_PERIODO' = '81'
                     AND status = 'SUBMIT_FAILED' AND hop_execution_id IS NULL AND finished_at IS NOT NULL) THEN
        RAISE EXCEPTION 'La carga vertical no conservó su vínculo con el cierre y su fallo de envío';
    END IF;
END;
$$;

-- Schedules -----------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        PERFORM etl_control.create_etl_schedule(
            'PUBLISH_STAGED', 'No programable', '0 0 2 * * *', 'America/La_Paz',
            clock_timestamp() + interval '1 hour', 'admin:test'
        );
        RAISE EXCEPTION 'Se programó un proceso solo manual';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    BEGIN
        PERFORM etl_control.create_etl_schedule(
            'CATALOG_SYNC', 'Cron corto', '0 2 * * *', 'America/La_Paz',
            clock_timestamp() + interval '1 hour', 'admin:test'
        );
        RAISE EXCEPTION 'Se aceptó un cron de cinco campos';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    BEGIN
        PERFORM etl_control.create_etl_schedule(
            'CATALOG_SYNC', 'Zona inválida', '0 0 2 * * *', 'Marte/Olympus',
            clock_timestamp() + interval '1 hour', 'admin:test'
        );
        RAISE EXCEPTION 'Se aceptó una zona horaria inexistente';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    BEGIN
        PERFORM etl_control.create_etl_schedule(
            'CATALOG_SYNC', 'Sin disparo', '0 0 2 * * *', 'America/La_Paz', NULL, 'admin:test'
        );
        RAISE EXCEPTION 'Se aceptó una programación activa sin próximo disparo';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
END;
$$;

-- Due one minute ago so the claim below picks it up.
SELECT etl_control.create_etl_schedule(
    'VERTICAL_LOAD', 'Carga nocturna', '0 0 2 * * *', 'America/La_Paz',
    clock_timestamp() - interval '1 minute', 'admin:test'
);

DO $$
DECLARE
    v_schedule etl_control.etl_schedule;
    v_claimed etl_control.etl_schedule;
    v_count INTEGER;
BEGIN
    SELECT * INTO v_schedule FROM etl_control.etl_schedule WHERE name = 'Carga nocturna';
    IF v_schedule.mode <> 'AUTO_PENDING_CLOSURES' OR NOT v_schedule.enabled OR v_schedule.row_version <> 1
       OR NOT EXISTS (SELECT 1 FROM etl_control.etl_schedule_event
                      WHERE schedule_id = v_schedule.schedule_id AND event_type = 'CREATED') THEN
        RAISE EXCEPTION 'La programación no tomó el modo del proceso o no se auditó';
    END IF;

    BEGIN
        PERFORM etl_control.create_etl_schedule(
            'CATALOG_SYNC', 'CARGA NOCTURNA', '0 0 3 * * *', 'America/La_Paz',
            clock_timestamp() + interval '1 hour', 'admin:test'
        );
        RAISE EXCEPTION 'Se aceptó un nombre duplicado';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    BEGIN
        PERFORM etl_control.update_etl_schedule(
            v_schedule.schedule_id, 99, 'Carga nocturna', '0 0 3 * * *', 'America/La_Paz',
            clock_timestamp() + interval '1 hour', 'admin:test'
        );
        RAISE EXCEPTION 'Se aceptó una edición con row_version obsoleto';
    EXCEPTION WHEN serialization_failure THEN NULL;
    END;

    SELECT * INTO v_claimed FROM etl_control.claim_due_etl_schedules(10, 300)
    WHERE schedule_id = v_schedule.schedule_id;
    IF v_claimed.claim_token IS NULL OR v_claimed.claimed_until <= clock_timestamp() THEN
        RAISE EXCEPTION 'La programación vencida no fue reclamada con un lease';
    END IF;

    SELECT count(*) INTO v_count FROM etl_control.claim_due_etl_schedules(10, 300)
    WHERE schedule_id = v_schedule.schedule_id;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'Una programación con lease vigente se reclamó dos veces';
    END IF;

    BEGIN
        PERFORM etl_control.update_etl_schedule(
            v_schedule.schedule_id, 1, 'Carga nocturna', '0 0 3 * * *', 'America/La_Paz',
            clock_timestamp() + interval '1 hour', 'admin:test'
        );
        RAISE EXCEPTION 'Se editó una programación mientras se disparaba';
    EXCEPTION WHEN object_in_use THEN NULL;
    END;

    -- No pending closure: the fire is recorded as SKIPPED (OMITIDA).
    PERFORM etl_control.record_skipped_etl_launch(
        'b2000000-0000-0000-0000-000000000006', v_schedule.schedule_id, 'scheduler',
        'No hay cierres académicos pendientes de procesar'
    );

    BEGIN
        PERFORM etl_control.complete_etl_schedule_fire(
            v_schedule.schedule_id, gen_random_uuid(), 'b2000000-0000-0000-0000-000000000006',
            clock_timestamp() + interval '1 day', 'scheduler'
        );
        RAISE EXCEPTION 'Se completó un disparo con un token ajeno';
    EXCEPTION WHEN object_in_use THEN NULL;
    END;

    BEGIN
        PERFORM etl_control.complete_etl_schedule_fire(
            v_schedule.schedule_id, v_claimed.claim_token, 'b2000000-0000-0000-0000-000000000001',
            clock_timestamp() + interval '1 day', 'scheduler'
        );
        RAISE EXCEPTION 'Se asoció a la programación un lanzamiento manual';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;

    PERFORM etl_control.complete_etl_schedule_fire(
        v_schedule.schedule_id, v_claimed.claim_token, 'b2000000-0000-0000-0000-000000000006',
        clock_timestamp() + interval '1 day', 'scheduler'
    );

    SELECT * INTO v_schedule FROM etl_control.etl_schedule WHERE schedule_id = v_schedule.schedule_id;
    IF v_schedule.claim_token IS NOT NULL OR v_schedule.last_fired_at IS NULL
       OR v_schedule.last_launch_id <> 'b2000000-0000-0000-0000-000000000006'
       OR v_schedule.next_fire_at <= clock_timestamp() + interval '23 hours'
       OR NOT EXISTS (SELECT 1 FROM etl_control.etl_launch
                      WHERE launch_id = 'b2000000-0000-0000-0000-000000000006'
                        AND status = 'SKIPPED' AND trigger_kind = 'SCHEDULED'
                        AND finished_at IS NOT NULL
                        AND result_summary = 'No hay cierres académicos pendientes de procesar')
       OR NOT EXISTS (SELECT 1 FROM etl_control.etl_schedule_event
                      WHERE schedule_id = v_schedule.schedule_id AND event_type = 'SKIPPED'
                        AND launch_id = 'b2000000-0000-0000-0000-000000000006'
                        AND detail ->> 'reason' = 'No hay cierres académicos pendientes de procesar') THEN
        RAISE EXCEPTION 'El disparo omitido no quedó registrado con fecha, motivo y siguiente disparo';
    END IF;

    -- A scheduled launch that does run is linked to its schedule.
    PERFORM etl_control.request_etl_launch(
        'b2000000-0000-0000-0000-000000000007', 'VERTICAL_LOAD', 'scheduler',
        jsonb_build_object('P_RUN_ID', 'c3000000-0000-0000-0000-000000000007',
                           'P_REQUESTED_GESTION', '2096', 'P_REQUESTED_PERIODO', '81',
                           'P_EXECUTION_KIND', 'CIERRE_ACADEMICO'),
        (SELECT closure_id FROM etl_control.academic_period_closure WHERE gestion = 2096 AND periodo = 81),
        'c3000000-0000-0000-0000-000000000007', v_schedule.schedule_id
    );
    IF NOT EXISTS (SELECT 1 FROM etl_control.etl_launch
                   WHERE launch_id = 'b2000000-0000-0000-0000-000000000007'
                     AND trigger_kind = 'SCHEDULED' AND schedule_id = v_schedule.schedule_id) THEN
        RAISE EXCEPTION 'El lanzamiento programado no quedó vinculado a su programación';
    END IF;

    -- Pause and resume.
    PERFORM etl_control.set_etl_schedule_enabled(v_schedule.schedule_id, 1, FALSE, NULL, 'admin:test');
    SELECT * INTO v_schedule FROM etl_control.etl_schedule WHERE schedule_id = v_schedule.schedule_id;
    IF v_schedule.enabled OR v_schedule.next_fire_at IS NOT NULL OR v_schedule.row_version <> 2 THEN
        RAISE EXCEPTION 'La pausa debe limpiar el próximo disparo y versionar la fila';
    END IF;
    BEGIN
        PERFORM etl_control.set_etl_schedule_enabled(v_schedule.schedule_id, 2, TRUE, NULL, 'admin:test');
        RAISE EXCEPTION 'Se reactivó una programación sin próximo disparo';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
    PERFORM etl_control.set_etl_schedule_enabled(
        v_schedule.schedule_id, 2, TRUE, clock_timestamp() + interval '1 hour', 'admin:test'
    );
    PERFORM etl_control.update_etl_schedule(
        v_schedule.schedule_id, 3, 'Carga nocturna 03h', '0 0 3 * * *', 'America/La_Paz',
        clock_timestamp() + interval '2 hours', 'admin:test'
    );

    -- Soft delete keeps history and frees the name.
    PERFORM etl_control.delete_etl_schedule(v_schedule.schedule_id, 4, 'admin:test');
    IF NOT EXISTS (SELECT 1 FROM etl_control.etl_schedule
                   WHERE schedule_id = v_schedule.schedule_id
                     AND deleted_at IS NOT NULL AND NOT enabled AND next_fire_at IS NULL)
       OR (SELECT array_agg(event_type ORDER BY event_id) FROM etl_control.etl_schedule_event
           WHERE schedule_id = v_schedule.schedule_id)
          <> ARRAY['CREATED', 'SKIPPED', 'DISABLED', 'ENABLED', 'UPDATED', 'DELETED']::VARCHAR[] THEN
        RAISE EXCEPTION 'El historial de la programación no quedó completo';
    END IF;
    BEGIN
        PERFORM etl_control.update_etl_schedule(
            v_schedule.schedule_id, 5, 'Borrada', '0 0 3 * * *', 'America/La_Paz',
            clock_timestamp() + interval '2 hours', 'admin:test'
        );
        RAISE EXCEPTION 'Se editó una programación eliminada';
    EXCEPTION WHEN no_data_found THEN NULL;
    END;
    PERFORM etl_control.create_etl_schedule(
        'CATALOG_SYNC', 'Carga nocturna 03h', '0 0 3 * * *', 'America/La_Paz',
        clock_timestamp() + interval '1 hour', 'admin:test'
    );
END;
$$;

RESET ROLE;

-- Other roles cannot run Load Manager commands.
SET LOCAL ROLE dw_control_reader;
DO $$
BEGIN
    BEGIN
        PERFORM etl_control.request_etl_launch('b2000000-0000-0000-0000-000000000008', 'CATALOG_SYNC', 'lector');
        RAISE EXCEPTION 'dw_control_reader ejecutó un comando del Load Manager';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE dw_hop_runtime;
DO $$
BEGIN
    BEGIN
        PERFORM etl_control.claim_due_etl_schedules(10, 300);
        RAISE EXCEPTION 'dw_hop_runtime reclamó programaciones';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;
RESET ROLE;

ROLLBACK;

\echo 'Load Manager catalog, launch and schedule tests passed'
