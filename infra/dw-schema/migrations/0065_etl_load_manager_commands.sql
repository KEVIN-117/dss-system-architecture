-- LM-002 (#350): audited Load Manager commands for dw-control-service.
-- The service never writes the Load Manager tables directly: it reads them
-- through dw_control_reader and changes them only through these
-- SECURITY DEFINER functions, granted to dw_control_api.
--
-- Error codes, mapped by dw-control-service (LM-003/LM-005):
--   22023 invalid_parameter_value  -> 400
--   P0002 no_data_found            -> 404
--   23505 unique_violation         -> 409 (active launch / duplicate name)
--   23514 check_violation          -> 409 (invalid state transition)
--   40001 serialization_failure    -> 409 (stale row_version)
--   55006 object_in_use            -> 409 (schedule claimed by a fire / lost claim)

DO $$
BEGIN
    IF to_regclass('etl_control.etl_process') IS NULL
       OR to_regclass('etl_control.etl_launch') IS NULL
       OR to_regclass('etl_control.etl_launch_event') IS NULL
       OR to_regclass('etl_control.etl_schedule') IS NULL
       OR to_regclass('etl_control.etl_schedule_event') IS NULL THEN
        RAISE EXCEPTION '0065 requires the Load Manager tables from 0062-0064';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dw_owner')
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dw_control_reader')
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dw_control_api')
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dw_control_service') THEN
        RAISE EXCEPTION '0065 requires dw_owner and the dw-control-service roles from 0023-0024';
    END IF;
END;
$$;

SET ROLE dw_owner;

-- ---------------------------------------------------------------------------
-- Shared validation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION etl_control.assert_load_manager_actor(p_actor VARCHAR)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, etl_control
AS $$
BEGIN
    IF btrim(COALESCE(p_actor, '')) = '' OR length(p_actor) > 255 THEN
        RAISE EXCEPTION 'El actor es obligatorio y no puede superar 255 caracteres'
            USING ERRCODE = '22023';
    END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Launches
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION etl_control.request_etl_launch(
    p_launch_id UUID,
    p_process_code VARCHAR(32),
    p_requested_by VARCHAR(255),
    p_parameters JSONB DEFAULT '{}'::JSONB,
    p_closure_id BIGINT DEFAULT NULL,
    p_run_id UUID DEFAULT NULL,
    p_schedule_id BIGINT DEFAULT NULL
)
RETURNS etl_control.etl_launch
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_process etl_control.etl_process;
    v_schedule etl_control.etl_schedule;
    v_parameters JSONB := COALESCE(p_parameters, '{}'::JSONB);
    v_bad_key TEXT;
    v_launch etl_control.etl_launch;
BEGIN
    IF p_launch_id IS NULL THEN
        RAISE EXCEPTION 'El identificador del lanzamiento es obligatorio' USING ERRCODE = '22023';
    END IF;
    PERFORM etl_control.assert_load_manager_actor(p_requested_by);

    SELECT * INTO v_process FROM etl_control.etl_process WHERE process_code = p_process_code;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe el proceso ETL %', p_process_code USING ERRCODE = 'P0002';
    END IF;
    IF NOT v_process.enabled THEN
        RAISE EXCEPTION 'El proceso ETL % está deshabilitado', p_process_code USING ERRCODE = '22023';
    END IF;

    IF jsonb_typeof(v_parameters) <> 'object' THEN
        RAISE EXCEPTION 'Los parámetros deben ser un objeto JSON' USING ERRCODE = '22023';
    END IF;
    SELECT entry.key INTO v_bad_key
    FROM jsonb_each(v_parameters) AS entry
    WHERE NOT (entry.key = ANY (v_process.parameter_names))
       OR jsonb_typeof(entry.value) <> 'string'
       OR length(entry.value #>> '{}') > 255
    ORDER BY entry.key
    LIMIT 1;
    IF v_bad_key IS NOT NULL THEN
        RAISE EXCEPTION 'El parámetro % no es válido para el proceso %', v_bad_key, p_process_code
            USING ERRCODE = '22023';
    END IF;

    -- P_RUN_ID and run_id must agree so the launch links to its etl_execution.
    IF (v_parameters ? 'P_RUN_ID') <> (p_run_id IS NOT NULL)
       OR (p_run_id IS NOT NULL AND v_parameters ->> 'P_RUN_ID' <> p_run_id::TEXT) THEN
        RAISE EXCEPTION 'P_RUN_ID debe coincidir con el run_id del lanzamiento' USING ERRCODE = '22023';
    END IF;

    IF p_closure_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM etl_control.academic_period_closure WHERE closure_id = p_closure_id) THEN
        RAISE EXCEPTION 'No existe el cierre académico %', p_closure_id USING ERRCODE = 'P0002';
    END IF;

    IF p_schedule_id IS NOT NULL THEN
        SELECT * INTO v_schedule FROM etl_control.etl_schedule WHERE schedule_id = p_schedule_id;
        IF NOT FOUND OR v_schedule.deleted_at IS NOT NULL THEN
            RAISE EXCEPTION 'No existe la programación %', p_schedule_id USING ERRCODE = 'P0002';
        END IF;
        IF v_schedule.process_code <> p_process_code THEN
            RAISE EXCEPTION 'La programación % no corresponde al proceso %', p_schedule_id, p_process_code
                USING ERRCODE = '22023';
        END IF;
    END IF;

    BEGIN
        INSERT INTO etl_control.etl_launch (
            launch_id, process_code, trigger_kind, schedule_id, closure_id, run_id,
            parameters, status, requested_by
        ) VALUES (
            p_launch_id, p_process_code,
            CASE WHEN p_schedule_id IS NULL THEN 'MANUAL' ELSE 'SCHEDULED' END,
            p_schedule_id, p_closure_id, p_run_id, v_parameters, 'QUEUED', p_requested_by
        )
        RETURNING * INTO v_launch;
    EXCEPTION WHEN unique_violation THEN
        IF EXISTS (
            SELECT 1 FROM etl_control.etl_launch
            WHERE process_code = p_process_code AND status IN ('QUEUED', 'SUBMITTED', 'RUNNING')
        ) THEN
            RAISE EXCEPTION 'Ya existe una ejecución activa del proceso %', p_process_code
                USING ERRCODE = '23505';
        END IF;
        RAISE;
    END;

    INSERT INTO etl_control.etl_launch_event (launch_id, event_type, new_status, actor, detail)
    VALUES (p_launch_id, 'REQUESTED', 'QUEUED', p_requested_by, v_launch.trigger_kind);

    RETURN v_launch;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.transition_etl_launch(
    p_launch_id UUID,
    p_to_status VARCHAR(16),
    p_actor VARCHAR(255),
    p_hop_execution_id UUID DEFAULT NULL,
    p_result_summary TEXT DEFAULT NULL,
    p_log_excerpt TEXT DEFAULT NULL
)
RETURNS etl_control.etl_launch
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_launch etl_control.etl_launch;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_terminal BOOLEAN;
    v_previous_status VARCHAR(16);
BEGIN
    PERFORM etl_control.assert_load_manager_actor(p_actor);
    IF p_result_summary IS NOT NULL AND length(p_result_summary) > 2000 THEN
        RAISE EXCEPTION 'El resumen excede 2000 caracteres' USING ERRCODE = '22023';
    END IF;
    IF p_log_excerpt IS NOT NULL AND length(p_log_excerpt) > 65536 THEN
        RAISE EXCEPTION 'El extracto de log excede 64 KiB' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_launch FROM etl_control.etl_launch WHERE launch_id = p_launch_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe el lanzamiento %', p_launch_id USING ERRCODE = 'P0002';
    END IF;

    v_previous_status := v_launch.status;
    v_terminal := v_launch.status IN ('SUCCEEDED', 'FAILED', 'STOPPED', 'SKIPPED', 'SUBMIT_FAILED');

    -- Monitoring refresh: same non-terminal status only updates the excerpt.
    IF p_to_status = v_launch.status AND NOT v_terminal THEN
        UPDATE etl_control.etl_launch
        SET result_summary = COALESCE(p_result_summary, result_summary),
            log_excerpt = COALESCE(p_log_excerpt, log_excerpt),
            updated_at = v_now
        WHERE launch_id = p_launch_id
        RETURNING * INTO v_launch;
        RETURN v_launch;
    END IF;

    IF NOT (
        (v_launch.status = 'QUEUED' AND p_to_status IN ('SUBMITTED', 'SUBMIT_FAILED', 'SKIPPED', 'STOPPED'))
        OR (v_launch.status = 'SUBMITTED' AND p_to_status IN ('RUNNING', 'SUCCEEDED', 'FAILED', 'STOPPED'))
        OR (v_launch.status = 'RUNNING' AND p_to_status IN ('SUCCEEDED', 'FAILED', 'STOPPED'))
    ) THEN
        RAISE EXCEPTION 'Transición de lanzamiento no permitida: % -> %', v_launch.status, p_to_status
            USING ERRCODE = '23514';
    END IF;

    IF p_to_status = 'SUBMITTED' AND p_hop_execution_id IS NULL THEN
        RAISE EXCEPTION 'SUBMITTED requiere el identificador de ejecución de Hop' USING ERRCODE = '22023';
    END IF;
    IF p_hop_execution_id IS NOT NULL AND p_to_status <> 'SUBMITTED' THEN
        RAISE EXCEPTION 'El identificador de Hop solo se registra al enviar la ejecución' USING ERRCODE = '22023';
    END IF;

    UPDATE etl_control.etl_launch
    SET status = p_to_status,
        hop_execution_id = COALESCE(p_hop_execution_id, hop_execution_id),
        submitted_at = CASE WHEN p_to_status = 'SUBMITTED' THEN v_now ELSE submitted_at END,
        started_at = CASE
            WHEN p_to_status = 'RUNNING' THEN COALESCE(started_at, v_now)
            WHEN p_to_status IN ('SUCCEEDED', 'FAILED') THEN COALESCE(started_at, submitted_at)
            ELSE started_at
        END,
        finished_at = CASE
            WHEN p_to_status IN ('SUCCEEDED', 'FAILED', 'STOPPED', 'SKIPPED', 'SUBMIT_FAILED') THEN v_now
            ELSE NULL
        END,
        result_summary = COALESCE(p_result_summary, result_summary),
        log_excerpt = COALESCE(p_log_excerpt, log_excerpt),
        row_version = row_version + 1,
        updated_at = v_now
    WHERE launch_id = p_launch_id
    RETURNING * INTO v_launch;

    INSERT INTO etl_control.etl_launch_event (
        launch_id, event_type, previous_status, new_status, actor, detail
    ) VALUES (
        p_launch_id, 'STATUS_CHANGED', v_previous_status,
        p_to_status, p_actor, p_result_summary
    );

    RETURN v_launch;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.request_etl_launch_stop(
    p_launch_id UUID,
    p_actor VARCHAR(255)
)
RETURNS etl_control.etl_launch
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_launch etl_control.etl_launch;
BEGIN
    PERFORM etl_control.assert_load_manager_actor(p_actor);

    SELECT * INTO v_launch FROM etl_control.etl_launch WHERE launch_id = p_launch_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe el lanzamiento %', p_launch_id USING ERRCODE = 'P0002';
    END IF;
    IF v_launch.status NOT IN ('QUEUED', 'SUBMITTED', 'RUNNING') THEN
        RAISE EXCEPTION 'Solo se puede detener un lanzamiento activo (estado actual: %)', v_launch.status
            USING ERRCODE = '23514';
    END IF;
    IF v_launch.stop_requested_at IS NOT NULL THEN
        RETURN v_launch;  -- idempotent
    END IF;

    UPDATE etl_control.etl_launch
    SET stop_requested_by = p_actor,
        stop_requested_at = clock_timestamp(),
        row_version = row_version + 1,
        updated_at = clock_timestamp()
    WHERE launch_id = p_launch_id
    RETURNING * INTO v_launch;

    INSERT INTO etl_control.etl_launch_event (launch_id, event_type, actor)
    VALUES (p_launch_id, 'STOP_REQUESTED', p_actor);

    RETURN v_launch;
END;
$$;

-- A scheduled fire with nothing to do (no pending closure, an active launch,
-- inside the operating window...) is still recorded with its date and reason.
CREATE OR REPLACE FUNCTION etl_control.record_skipped_etl_launch(
    p_launch_id UUID,
    p_schedule_id BIGINT,
    p_actor VARCHAR(255),
    p_reason TEXT
)
RETURNS etl_control.etl_launch
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_schedule etl_control.etl_schedule;
    v_launch etl_control.etl_launch;
BEGIN
    IF p_launch_id IS NULL THEN
        RAISE EXCEPTION 'El identificador del lanzamiento es obligatorio' USING ERRCODE = '22023';
    END IF;
    PERFORM etl_control.assert_load_manager_actor(p_actor);
    IF btrim(COALESCE(p_reason, '')) = '' OR length(p_reason) > 2000 THEN
        RAISE EXCEPTION 'El motivo de la omisión es obligatorio (máximo 2000 caracteres)' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_schedule FROM etl_control.etl_schedule WHERE schedule_id = p_schedule_id;
    IF NOT FOUND OR v_schedule.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'No existe la programación %', p_schedule_id USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO etl_control.etl_launch (
        launch_id, process_code, trigger_kind, schedule_id, parameters, status,
        requested_by, finished_at, result_summary
    ) VALUES (
        p_launch_id, v_schedule.process_code, 'SCHEDULED', p_schedule_id, '{}'::JSONB, 'SKIPPED',
        p_actor, clock_timestamp(), p_reason
    )
    RETURNING * INTO v_launch;

    INSERT INTO etl_control.etl_launch_event (launch_id, event_type, new_status, actor, detail)
    VALUES (p_launch_id, 'SKIPPED', 'SKIPPED', p_actor, p_reason);

    RETURN v_launch;
END;
$$;

-- ---------------------------------------------------------------------------
-- Schedules
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION etl_control.assert_etl_schedule_definition(
    p_name VARCHAR,
    p_cron_expression VARCHAR,
    p_timezone VARCHAR,
    p_enabled BOOLEAN,
    p_next_fire_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, etl_control
AS $$
BEGIN
    IF btrim(COALESCE(p_name, '')) = '' OR length(p_name) > 120 THEN
        RAISE EXCEPTION 'El nombre de la programación es obligatorio (máximo 120 caracteres)'
            USING ERRCODE = '22023';
    END IF;
    IF p_cron_expression IS NULL OR length(p_cron_expression) > 120
       OR p_cron_expression !~ '^\S+( \S+){5}$' THEN
        RAISE EXCEPTION 'La expresión cron debe tener seis campos' USING ERRCODE = '22023';
    END IF;
    IF p_timezone IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_timezone) THEN
        RAISE EXCEPTION 'La zona horaria % no es válida', p_timezone USING ERRCODE = '22023';
    END IF;
    IF p_enabled AND p_next_fire_at IS NULL THEN
        RAISE EXCEPTION 'Una programación activa requiere el próximo disparo' USING ERRCODE = '22023';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.create_etl_schedule(
    p_process_code VARCHAR(32),
    p_name VARCHAR(120),
    p_cron_expression VARCHAR(120),
    p_timezone VARCHAR(64),
    p_next_fire_at TIMESTAMPTZ,
    p_actor VARCHAR(255),
    p_enabled BOOLEAN DEFAULT TRUE
)
RETURNS etl_control.etl_schedule
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_process etl_control.etl_process;
    v_schedule etl_control.etl_schedule;
BEGIN
    PERFORM etl_control.assert_load_manager_actor(p_actor);
    PERFORM etl_control.assert_etl_schedule_definition(
        p_name, p_cron_expression, p_timezone, COALESCE(p_enabled, TRUE), p_next_fire_at
    );

    SELECT * INTO v_process FROM etl_control.etl_process WHERE process_code = p_process_code;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe el proceso ETL %', p_process_code USING ERRCODE = 'P0002';
    END IF;
    IF v_process.schedule_mode IS NULL THEN
        RAISE EXCEPTION 'El proceso % no admite programaciones', p_process_code USING ERRCODE = '22023';
    END IF;

    BEGIN
        INSERT INTO etl_control.etl_schedule (
            process_code, name, cron_expression, timezone, mode, enabled, next_fire_at,
            created_by, updated_by
        ) VALUES (
            p_process_code, btrim(p_name), p_cron_expression, p_timezone, v_process.schedule_mode,
            COALESCE(p_enabled, TRUE),
            CASE WHEN COALESCE(p_enabled, TRUE) THEN p_next_fire_at END,
            p_actor, p_actor
        )
        RETURNING * INTO v_schedule;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Ya existe una programación llamada %', btrim(p_name) USING ERRCODE = '23505';
    END;

    INSERT INTO etl_control.etl_schedule_event (schedule_id, event_type, actor, detail)
    VALUES (
        v_schedule.schedule_id, 'CREATED', p_actor,
        jsonb_build_object(
            'name', v_schedule.name, 'cron', v_schedule.cron_expression,
            'timezone', v_schedule.timezone, 'enabled', v_schedule.enabled,
            'next_fire_at', v_schedule.next_fire_at
        )
    );

    RETURN v_schedule;
END;
$$;

-- Locks a live schedule for a user change: checks it exists, is not deleted,
-- matches the expected row_version and is not being fired right now.
CREATE OR REPLACE FUNCTION etl_control.lock_etl_schedule_for_change(
    p_schedule_id BIGINT,
    p_expected_row_version INTEGER
)
RETURNS etl_control.etl_schedule
LANGUAGE plpgsql
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_schedule etl_control.etl_schedule;
BEGIN
    SELECT * INTO v_schedule FROM etl_control.etl_schedule WHERE schedule_id = p_schedule_id FOR UPDATE;
    IF NOT FOUND OR v_schedule.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'No existe la programación %', p_schedule_id USING ERRCODE = 'P0002';
    END IF;
    IF p_expected_row_version IS NULL OR v_schedule.row_version <> p_expected_row_version THEN
        RAISE EXCEPTION 'La programación % cambió; vuelve a cargarla', p_schedule_id USING ERRCODE = '40001';
    END IF;
    IF v_schedule.claimed_until IS NOT NULL AND v_schedule.claimed_until > clock_timestamp() THEN
        RAISE EXCEPTION 'La programación % se está disparando; inténtalo en unos segundos', p_schedule_id
            USING ERRCODE = '55006';
    END IF;
    RETURN v_schedule;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.update_etl_schedule(
    p_schedule_id BIGINT,
    p_expected_row_version INTEGER,
    p_name VARCHAR(120),
    p_cron_expression VARCHAR(120),
    p_timezone VARCHAR(64),
    p_next_fire_at TIMESTAMPTZ,
    p_actor VARCHAR(255)
)
RETURNS etl_control.etl_schedule
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_before etl_control.etl_schedule;
    v_schedule etl_control.etl_schedule;
BEGIN
    PERFORM etl_control.assert_load_manager_actor(p_actor);
    v_before := etl_control.lock_etl_schedule_for_change(p_schedule_id, p_expected_row_version);
    PERFORM etl_control.assert_etl_schedule_definition(
        p_name, p_cron_expression, p_timezone, v_before.enabled, p_next_fire_at
    );

    BEGIN
        UPDATE etl_control.etl_schedule
        SET name = btrim(p_name),
            cron_expression = p_cron_expression,
            timezone = p_timezone,
            next_fire_at = CASE WHEN enabled THEN p_next_fire_at END,
            claim_token = NULL,
            claimed_until = NULL,
            updated_by = p_actor,
            updated_at = clock_timestamp(),
            row_version = row_version + 1
        WHERE schedule_id = p_schedule_id
        RETURNING * INTO v_schedule;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Ya existe una programación llamada %', btrim(p_name) USING ERRCODE = '23505';
    END;

    INSERT INTO etl_control.etl_schedule_event (schedule_id, event_type, actor, detail)
    VALUES (
        p_schedule_id, 'UPDATED', p_actor,
        jsonb_build_object(
            'before', jsonb_build_object('name', v_before.name, 'cron', v_before.cron_expression,
                                         'timezone', v_before.timezone, 'next_fire_at', v_before.next_fire_at),
            'after', jsonb_build_object('name', v_schedule.name, 'cron', v_schedule.cron_expression,
                                        'timezone', v_schedule.timezone, 'next_fire_at', v_schedule.next_fire_at)
        )
    );

    RETURN v_schedule;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.set_etl_schedule_enabled(
    p_schedule_id BIGINT,
    p_expected_row_version INTEGER,
    p_enabled BOOLEAN,
    p_next_fire_at TIMESTAMPTZ,
    p_actor VARCHAR(255)
)
RETURNS etl_control.etl_schedule
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_before etl_control.etl_schedule;
    v_schedule etl_control.etl_schedule;
BEGIN
    PERFORM etl_control.assert_load_manager_actor(p_actor);
    IF p_enabled IS NULL THEN
        RAISE EXCEPTION 'Indica si la programación queda activa o pausada' USING ERRCODE = '22023';
    END IF;
    v_before := etl_control.lock_etl_schedule_for_change(p_schedule_id, p_expected_row_version);
    IF v_before.enabled = p_enabled THEN
        RETURN v_before;  -- idempotent
    END IF;
    IF p_enabled AND p_next_fire_at IS NULL THEN
        RAISE EXCEPTION 'Una programación activa requiere el próximo disparo' USING ERRCODE = '22023';
    END IF;

    UPDATE etl_control.etl_schedule
    SET enabled = p_enabled,
        next_fire_at = CASE WHEN p_enabled THEN p_next_fire_at END,
        claim_token = NULL,
        claimed_until = NULL,
        updated_by = p_actor,
        updated_at = clock_timestamp(),
        row_version = row_version + 1
    WHERE schedule_id = p_schedule_id
    RETURNING * INTO v_schedule;

    INSERT INTO etl_control.etl_schedule_event (schedule_id, event_type, actor, detail)
    VALUES (
        p_schedule_id, CASE WHEN p_enabled THEN 'ENABLED' ELSE 'DISABLED' END, p_actor,
        jsonb_build_object('next_fire_at', v_schedule.next_fire_at)
    );

    RETURN v_schedule;
END;
$$;

-- Soft delete: launches keep pointing at the schedule that fired them.
CREATE OR REPLACE FUNCTION etl_control.delete_etl_schedule(
    p_schedule_id BIGINT,
    p_expected_row_version INTEGER,
    p_actor VARCHAR(255)
)
RETURNS etl_control.etl_schedule
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_schedule etl_control.etl_schedule;
BEGIN
    PERFORM etl_control.assert_load_manager_actor(p_actor);
    PERFORM etl_control.lock_etl_schedule_for_change(p_schedule_id, p_expected_row_version);

    UPDATE etl_control.etl_schedule
    SET enabled = FALSE,
        next_fire_at = NULL,
        claim_token = NULL,
        claimed_until = NULL,
        deleted_at = clock_timestamp(),
        updated_by = p_actor,
        updated_at = clock_timestamp(),
        row_version = row_version + 1
    WHERE schedule_id = p_schedule_id
    RETURNING * INTO v_schedule;

    INSERT INTO etl_control.etl_schedule_event (schedule_id, event_type, actor)
    VALUES (p_schedule_id, 'DELETED', p_actor);

    RETURN v_schedule;
END;
$$;

-- Hands due schedules to one caller. Each returned row carries a fresh
-- claim_token valid for p_lease_seconds; concurrent callers skip rows locked
-- or leased by another instance, so a schedule fires at most once per due time.
CREATE OR REPLACE FUNCTION etl_control.claim_due_etl_schedules(
    p_limit INTEGER DEFAULT 10,
    p_lease_seconds INTEGER DEFAULT 300
)
RETURNS SETOF etl_control.etl_schedule
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
BEGIN
    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 50 THEN
        RAISE EXCEPTION 'El límite debe estar entre 1 y 50' USING ERRCODE = '22023';
    END IF;
    IF p_lease_seconds IS NULL OR p_lease_seconds < 30 OR p_lease_seconds > 3600 THEN
        RAISE EXCEPTION 'El lease debe estar entre 30 y 3600 segundos' USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    WITH due AS (
        SELECT schedule.schedule_id
        FROM etl_control.etl_schedule AS schedule
        JOIN etl_control.etl_process AS process USING (process_code)
        WHERE schedule.enabled
          AND schedule.deleted_at IS NULL
          AND process.enabled
          AND schedule.next_fire_at <= clock_timestamp()
          AND (schedule.claimed_until IS NULL OR schedule.claimed_until < clock_timestamp())
        ORDER BY schedule.next_fire_at, schedule.schedule_id
        LIMIT p_limit
        FOR UPDATE OF schedule SKIP LOCKED
    ), claimed AS (
        UPDATE etl_control.etl_schedule AS schedule
        SET claim_token = gen_random_uuid(),
            claimed_until = clock_timestamp() + make_interval(secs => p_lease_seconds)
        FROM due
        WHERE schedule.schedule_id = due.schedule_id
        RETURNING schedule.*
    )
    SELECT * FROM claimed ORDER BY claimed.next_fire_at, claimed.schedule_id;
END;
$$;

-- Closes a claimed fire: records the launch it produced (or the SKIPPED one),
-- moves next_fire_at forward and releases the claim.
CREATE OR REPLACE FUNCTION etl_control.complete_etl_schedule_fire(
    p_schedule_id BIGINT,
    p_claim_token UUID,
    p_launch_id UUID,
    p_next_fire_at TIMESTAMPTZ,
    p_actor VARCHAR(255)
)
RETURNS etl_control.etl_schedule
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_schedule etl_control.etl_schedule;
    v_launch etl_control.etl_launch;
BEGIN
    PERFORM etl_control.assert_load_manager_actor(p_actor);

    SELECT * INTO v_schedule FROM etl_control.etl_schedule WHERE schedule_id = p_schedule_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe la programación %', p_schedule_id USING ERRCODE = 'P0002';
    END IF;
    IF p_claim_token IS NULL OR v_schedule.claim_token IS DISTINCT FROM p_claim_token THEN
        RAISE EXCEPTION 'El disparo de la programación % ya no pertenece a esta instancia', p_schedule_id
            USING ERRCODE = '55006';
    END IF;

    SELECT * INTO v_launch FROM etl_control.etl_launch WHERE launch_id = p_launch_id;
    IF NOT FOUND OR v_launch.schedule_id IS DISTINCT FROM p_schedule_id THEN
        RAISE EXCEPTION 'El lanzamiento % no pertenece a la programación %', p_launch_id, p_schedule_id
            USING ERRCODE = '22023';
    END IF;
    IF v_schedule.enabled AND p_next_fire_at IS NULL THEN
        RAISE EXCEPTION 'Una programación activa requiere el próximo disparo' USING ERRCODE = '22023';
    END IF;

    UPDATE etl_control.etl_schedule
    SET last_fired_at = clock_timestamp(),
        last_launch_id = p_launch_id,
        next_fire_at = CASE WHEN enabled THEN p_next_fire_at END,
        claim_token = NULL,
        claimed_until = NULL
    WHERE schedule_id = p_schedule_id
    RETURNING * INTO v_schedule;

    INSERT INTO etl_control.etl_schedule_event (schedule_id, event_type, actor, launch_id, detail)
    VALUES (
        p_schedule_id,
        CASE WHEN v_launch.status = 'SKIPPED' THEN 'SKIPPED' ELSE 'FIRED' END,
        p_actor, p_launch_id,
        jsonb_build_object(
            'launch_status', v_launch.status,
            'reason', CASE WHEN v_launch.status = 'SKIPPED' THEN v_launch.result_summary END,
            'next_fire_at', v_schedule.next_fire_at
        )
    );

    RETURN v_schedule;
END;
$$;

RESET ROLE;

ALTER FUNCTION etl_control.assert_load_manager_actor(VARCHAR) OWNER TO dw_owner;
ALTER FUNCTION etl_control.assert_etl_schedule_definition(VARCHAR, VARCHAR, VARCHAR, BOOLEAN, TIMESTAMPTZ) OWNER TO dw_owner;
ALTER FUNCTION etl_control.lock_etl_schedule_for_change(BIGINT, INTEGER) OWNER TO dw_owner;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION etl_control.assert_load_manager_actor(VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION etl_control.assert_etl_schedule_definition(VARCHAR, VARCHAR, VARCHAR, BOOLEAN, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION etl_control.lock_etl_schedule_for_change(BIGINT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION etl_control.request_etl_launch(UUID, VARCHAR, VARCHAR, JSONB, BIGINT, UUID, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION etl_control.transition_etl_launch(UUID, VARCHAR, VARCHAR, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION etl_control.request_etl_launch_stop(UUID, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION etl_control.record_skipped_etl_launch(UUID, BIGINT, VARCHAR, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION etl_control.create_etl_schedule(VARCHAR, VARCHAR, VARCHAR, VARCHAR, TIMESTAMPTZ, VARCHAR, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION etl_control.update_etl_schedule(BIGINT, INTEGER, VARCHAR, VARCHAR, VARCHAR, TIMESTAMPTZ, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION etl_control.set_etl_schedule_enabled(BIGINT, INTEGER, BOOLEAN, TIMESTAMPTZ, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION etl_control.delete_etl_schedule(BIGINT, INTEGER, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION etl_control.claim_due_etl_schedules(INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION etl_control.complete_etl_schedule_fire(BIGINT, UUID, UUID, TIMESTAMPTZ, VARCHAR) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
    etl_control.request_etl_launch(UUID, VARCHAR, VARCHAR, JSONB, BIGINT, UUID, BIGINT),
    etl_control.transition_etl_launch(UUID, VARCHAR, VARCHAR, UUID, TEXT, TEXT),
    etl_control.request_etl_launch_stop(UUID, VARCHAR),
    etl_control.record_skipped_etl_launch(UUID, BIGINT, VARCHAR, TEXT),
    etl_control.create_etl_schedule(VARCHAR, VARCHAR, VARCHAR, VARCHAR, TIMESTAMPTZ, VARCHAR, BOOLEAN),
    etl_control.update_etl_schedule(BIGINT, INTEGER, VARCHAR, VARCHAR, VARCHAR, TIMESTAMPTZ, VARCHAR),
    etl_control.set_etl_schedule_enabled(BIGINT, INTEGER, BOOLEAN, TIMESTAMPTZ, VARCHAR),
    etl_control.delete_etl_schedule(BIGINT, INTEGER, VARCHAR),
    etl_control.claim_due_etl_schedules(INTEGER, INTEGER),
    etl_control.complete_etl_schedule_fire(BIGINT, UUID, UUID, TIMESTAMPTZ, VARCHAR)
TO dw_control_api;

REVOKE ALL ON etl_control.etl_process,
    etl_control.etl_launch,
    etl_control.etl_launch_event,
    etl_control.etl_schedule,
    etl_control.etl_schedule_event
FROM dw_control_reader, dw_control_api, dw_control_service;

GRANT SELECT ON etl_control.etl_process,
    etl_control.etl_launch,
    etl_control.etl_launch_event,
    etl_control.etl_schedule,
    etl_control.etl_schedule_event
TO dw_control_reader;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA etl_control FROM dw_control_reader, dw_control_api, dw_control_service;

DO $$
DECLARE
    v_table TEXT;
    v_privilege TEXT;
    v_function REGPROCEDURE;
BEGIN
    FOREACH v_table IN ARRAY ARRAY[
        'etl_control.etl_process', 'etl_control.etl_launch', 'etl_control.etl_launch_event',
        'etl_control.etl_schedule', 'etl_control.etl_schedule_event'
    ] LOOP
        IF NOT has_table_privilege('dw_control_service', v_table, 'SELECT') THEN
            RAISE EXCEPTION 'dw_control_service must read %', v_table;
        END IF;
        FOREACH v_privilege IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] LOOP
            IF has_table_privilege('dw_control_service', v_table, v_privilege) THEN
                RAISE EXCEPTION 'dw_control_service must not have % on %', v_privilege, v_table;
            END IF;
        END LOOP;
    END LOOP;

    FOR v_function IN
        SELECT p.oid::REGPROCEDURE
        FROM pg_proc AS p
        JOIN pg_namespace AS n ON n.oid = p.pronamespace
        WHERE n.nspname = 'etl_control'
          AND p.proname IN (
              'request_etl_launch', 'transition_etl_launch', 'request_etl_launch_stop',
              'record_skipped_etl_launch', 'create_etl_schedule', 'update_etl_schedule',
              'set_etl_schedule_enabled', 'delete_etl_schedule', 'claim_due_etl_schedules',
              'complete_etl_schedule_fire'
          )
    LOOP
        IF NOT has_function_privilege('dw_control_service', v_function, 'EXECUTE') THEN
            RAISE EXCEPTION 'dw_control_service must execute %', v_function;
        END IF;
        IF has_function_privilege('dw_control_reader', v_function, 'EXECUTE')
           OR has_function_privilege('dw_hop_runtime', v_function, 'EXECUTE') THEN
            RAISE EXCEPTION '% must be reserved for dw_control_api', v_function;
        END IF;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION etl_control.request_etl_launch(UUID, VARCHAR, VARCHAR, JSONB, BIGINT, UUID, BIGINT) IS
    'Load Manager: registra una solicitud de ejecución (QUEUED); rechaza un segundo lanzamiento activo del mismo proceso.';
COMMENT ON FUNCTION etl_control.claim_due_etl_schedules(INTEGER, INTEGER) IS
    'Load Manager: entrega programaciones vencidas a una sola instancia mediante FOR UPDATE SKIP LOCKED y un lease.';
COMMENT ON FUNCTION etl_control.complete_etl_schedule_fire(BIGINT, UUID, UUID, TIMESTAMPTZ, VARCHAR) IS
    'Load Manager: cierra un disparo reclamado, registra su lanzamiento y avanza next_fire_at.';
