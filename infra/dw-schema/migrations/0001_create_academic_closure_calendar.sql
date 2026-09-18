-- DW-002: source of truth for academic periods authorized for DW processing.
-- This migration does not read or modify Jachasun.

CREATE SCHEMA IF NOT EXISTS etl_control;

CREATE TABLE IF NOT EXISTS etl_control.academic_period_closure (
    closure_id BIGSERIAL PRIMARY KEY,
    gestion SMALLINT NOT NULL CHECK (gestion >= 2000),
    periodo SMALLINT NOT NULL CHECK (periodo > 0),
    status VARCHAR(16) NOT NULL DEFAULT 'PENDIENTE'
        CHECK (status IN ('PENDIENTE', 'CERRADO', 'REABIERTO', 'PROCESADO')),
    effective_at TIMESTAMPTZ,
    authorized_by_subject VARCHAR(255),
    created_by_subject VARCHAR(255) NOT NULL CHECK (btrim(created_by_subject) <> ''),
    closure_reason TEXT NOT NULL CHECK (btrim(closure_reason) <> ''),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    processed_run_id UUID,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_academic_period_closure UNIQUE (gestion, periodo),
    CONSTRAINT ck_closed_period_has_authorization CHECK (
        status <> 'CERRADO'
        OR (effective_at IS NOT NULL AND authorized_by_subject IS NOT NULL)
    ),
    CONSTRAINT ck_processed_period_has_run CHECK (
        status <> 'PROCESADO'
        OR (processed_run_id IS NOT NULL AND processed_at IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS etl_control.academic_period_closure_event (
    event_id BIGSERIAL PRIMARY KEY,
    closure_id BIGINT NOT NULL
        REFERENCES etl_control.academic_period_closure (closure_id)
        ON DELETE RESTRICT,
    from_status VARCHAR(16),
    to_status VARCHAR(16) NOT NULL
        CHECK (to_status IN ('PENDIENTE', 'CERRADO', 'REABIERTO', 'PROCESADO')),
    actor_subject VARCHAR(255) NOT NULL CHECK (btrim(actor_subject) <> ''),
    reason TEXT NOT NULL CHECK (btrim(reason) <> ''),
    run_id UUID,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_academic_period_closure_eligibility
    ON etl_control.academic_period_closure (status, effective_at)
    WHERE status = 'CERRADO' AND processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_academic_period_closure_event_closure_id
    ON etl_control.academic_period_closure_event (closure_id, event_id);

CREATE OR REPLACE FUNCTION etl_control.record_initial_academic_period_closure_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status <> 'PENDIENTE'
       OR NEW.effective_at IS NOT NULL
       OR NEW.authorized_by_subject IS NOT NULL
       OR NEW.processed_run_id IS NOT NULL
       OR NEW.processed_at IS NOT NULL THEN
        RAISE EXCEPTION 'Un corte nuevo debe iniciar en PENDIENTE sin autorización ni procesamiento'
            USING ERRCODE = '23514';
    END IF;

    INSERT INTO etl_control.academic_period_closure_event (
        closure_id, from_status, to_status, actor_subject, reason
    ) VALUES (
        NEW.closure_id, NULL, NEW.status, NEW.created_by_subject, NEW.closure_reason
    );

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.reject_direct_academic_period_closure_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_setting('etl_control.allow_closure_transition', true) IS DISTINCT FROM 'on'
       AND (
           NEW.status IS DISTINCT FROM OLD.status
           OR NEW.effective_at IS DISTINCT FROM OLD.effective_at
           OR NEW.authorized_by_subject IS DISTINCT FROM OLD.authorized_by_subject
           OR NEW.closure_reason IS DISTINCT FROM OLD.closure_reason
           OR NEW.processed_run_id IS DISTINCT FROM OLD.processed_run_id
           OR NEW.processed_at IS DISTINCT FROM OLD.processed_at
       ) THEN
        RAISE EXCEPTION 'Use etl_control.transition_academic_period_closure para modificar un corte'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.prevent_academic_period_closure_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'La bitácora de cierres académicos es inmutable'
        USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.transition_academic_period_closure(
    p_gestion SMALLINT,
    p_periodo SMALLINT,
    p_to_status VARCHAR(16),
    p_actor_subject VARCHAR(255),
    p_reason TEXT,
    p_effective_at TIMESTAMPTZ DEFAULT NULL,
    p_processed_run_id UUID DEFAULT NULL
)
RETURNS etl_control.academic_period_closure
LANGUAGE plpgsql
AS $$
DECLARE
    v_closure etl_control.academic_period_closure;
    v_from_status VARCHAR(16);
BEGIN
    IF btrim(COALESCE(p_actor_subject, '')) = '' OR btrim(COALESCE(p_reason, '')) = '' THEN
        RAISE EXCEPTION 'actor_subject y reason son obligatorios'
            USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO v_closure
    FROM etl_control.academic_period_closure
    WHERE gestion = p_gestion AND periodo = p_periodo
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe el corte académico %-%', p_gestion, p_periodo
            USING ERRCODE = 'P0002';
    END IF;

    IF NOT (
        (v_closure.status = 'PENDIENTE' AND p_to_status = 'CERRADO')
        OR (v_closure.status = 'CERRADO' AND p_to_status IN ('PROCESADO', 'REABIERTO'))
        OR (v_closure.status = 'REABIERTO' AND p_to_status = 'CERRADO')
        OR (v_closure.status = 'PROCESADO' AND p_to_status = 'REABIERTO')
    ) THEN
        RAISE EXCEPTION 'Transición no permitida: % -> %', v_closure.status, p_to_status
            USING ERRCODE = '23514';
    END IF;

    IF p_to_status = 'CERRADO' AND p_effective_at IS NULL THEN
        RAISE EXCEPTION 'CERRADO requiere effective_at'
            USING ERRCODE = '23514';
    END IF;

    IF p_to_status = 'PROCESADO' AND p_processed_run_id IS NULL THEN
        RAISE EXCEPTION 'PROCESADO requiere processed_run_id'
            USING ERRCODE = '23514';
    END IF;

    v_from_status := v_closure.status;
    PERFORM set_config('etl_control.allow_closure_transition', 'on', true);

    UPDATE etl_control.academic_period_closure
    SET status = p_to_status,
        effective_at = CASE WHEN p_to_status = 'CERRADO' THEN p_effective_at ELSE effective_at END,
        authorized_by_subject = CASE
            WHEN p_to_status IN ('CERRADO', 'REABIERTO') THEN p_actor_subject
            ELSE authorized_by_subject
        END,
        closure_reason = p_reason,
        processed_run_id = CASE
            WHEN p_to_status = 'PROCESADO' THEN p_processed_run_id
            WHEN p_to_status = 'REABIERTO' THEN NULL
            ELSE processed_run_id
        END,
        processed_at = CASE
            WHEN p_to_status = 'PROCESADO' THEN clock_timestamp()
            WHEN p_to_status = 'REABIERTO' THEN NULL
            ELSE processed_at
        END,
        version = version + 1,
        updated_at = clock_timestamp()
    WHERE closure_id = v_closure.closure_id
    RETURNING * INTO v_closure;

    PERFORM set_config('etl_control.allow_closure_transition', 'off', true);

    INSERT INTO etl_control.academic_period_closure_event (
        closure_id, from_status, to_status, actor_subject, reason, run_id
    ) VALUES (
        v_closure.closure_id,
        v_from_status,
        p_to_status,
        p_actor_subject,
        p_reason,
        CASE WHEN p_to_status = 'PROCESADO' THEN p_processed_run_id ELSE NULL END
    );

    RETURN v_closure;
END;
$$;

DROP TRIGGER IF EXISTS trg_academic_period_closure_initial_event
    ON etl_control.academic_period_closure;
CREATE TRIGGER trg_academic_period_closure_initial_event
AFTER INSERT ON etl_control.academic_period_closure
FOR EACH ROW EXECUTE FUNCTION etl_control.record_initial_academic_period_closure_event();

DROP TRIGGER IF EXISTS trg_academic_period_closure_direct_update
    ON etl_control.academic_period_closure;
CREATE TRIGGER trg_academic_period_closure_direct_update
BEFORE UPDATE ON etl_control.academic_period_closure
FOR EACH ROW EXECUTE FUNCTION etl_control.reject_direct_academic_period_closure_update();

DROP TRIGGER IF EXISTS trg_academic_period_closure_event_immutable
    ON etl_control.academic_period_closure_event;
CREATE TRIGGER trg_academic_period_closure_event_immutable
BEFORE UPDATE OR DELETE ON etl_control.academic_period_closure_event
FOR EACH ROW EXECUTE FUNCTION etl_control.prevent_academic_period_closure_event_mutation();
