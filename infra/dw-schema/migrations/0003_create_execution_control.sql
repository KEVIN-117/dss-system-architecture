-- DW-004: execution control, audit trail, locks, and source manifests.
-- Execute through scripts/apply-migrations.sh after DW-002 and DW-003.

DO $$
BEGIN
    IF to_regclass('etl_control.schema_migration') IS NULL
       OR to_regclass('etl_control.academic_period_closure') IS NULL
       OR to_regprocedure(
            'etl_control.transition_academic_period_closure(smallint,smallint,character varying,character varying,text,timestamp with time zone,uuid)'
       ) IS NULL THEN
        RAISE EXCEPTION 'DW-002 y DW-003 deben estar aplicadas antes de DW-004';
    END IF;
END;
$$;

SET ROLE dw_owner;

CREATE TABLE IF NOT EXISTS etl_control.etl_execution (
    run_id UUID PRIMARY KEY,
    execution_kind VARCHAR(24) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'SOLICITADA',
    closure_id BIGINT NULL REFERENCES etl_control.academic_period_closure (closure_id)
        ON DELETE RESTRICT,
    retry_of_run_id UUID NULL REFERENCES etl_control.etl_execution (run_id)
        ON DELETE RESTRICT,
    requested_gestion SMALLINT NULL,
    requested_periodo SMALLINT NULL,
    requested_cut_at TIMESTAMPTZ NULL,
    requested_by VARCHAR(255) NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    started_at TIMESTAMPTZ NULL,
    ended_at TIMESTAMPTZ NULL,
    status_reason TEXT NULL,
    row_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT ck_etl_execution_kind CHECK (
        execution_kind IN ('HISTORICA', 'CIERRE_ACADEMICO', 'REPROCESO')
    ),
    CONSTRAINT ck_etl_execution_status CHECK (
        status IN ('SOLICITADA', 'EN_EJECUCION', 'PUBLICANDO', 'EXITOSA', 'FALLIDA', 'CANCELADA')
    ),
    CONSTRAINT ck_etl_execution_period CHECK (
        (requested_gestion IS NULL AND requested_periodo IS NULL)
        OR (requested_gestion >= 2000 AND requested_periodo > 0)
    ),
    CONSTRAINT ck_etl_execution_kind_links CHECK (
        (execution_kind <> 'CIERRE_ACADEMICO' OR closure_id IS NOT NULL)
        AND (execution_kind <> 'REPROCESO' OR retry_of_run_id IS NOT NULL)
    ),
    CONSTRAINT ck_etl_execution_terminal_timestamps CHECK (
        (status IN ('EXITOSA', 'FALLIDA', 'CANCELADA') AND ended_at IS NOT NULL)
        OR (status NOT IN ('EXITOSA', 'FALLIDA', 'CANCELADA') AND ended_at IS NULL)
    )
);

CREATE TABLE IF NOT EXISTS etl_control.etl_execution_event (
    event_id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES etl_control.etl_execution (run_id) ON DELETE RESTRICT,
    previous_status VARCHAR(16) NULL,
    new_status VARCHAR(16) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    actor VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT ck_etl_execution_event_status CHECK (
        (previous_status IS NULL OR previous_status IN (
            'SOLICITADA', 'EN_EJECUCION', 'PUBLICANDO', 'EXITOSA', 'FALLIDA', 'CANCELADA'
        ))
        AND new_status IN (
            'SOLICITADA', 'EN_EJECUCION', 'PUBLICANDO', 'EXITOSA', 'FALLIDA', 'CANCELADA'
        )
    ),
    CONSTRAINT ck_etl_execution_event_reason CHECK (btrim(reason) <> ''),
    CONSTRAINT ck_etl_execution_event_details CHECK (jsonb_typeof(details) = 'object')
);

CREATE TABLE IF NOT EXISTS etl_control.etl_execution_step (
    step_id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES etl_control.etl_execution (run_id) ON DELETE RESTRICT,
    step_code VARCHAR(100) NOT NULL,
    phase VARCHAR(20) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDIENTE',
    step_order SMALLINT NOT NULL DEFAULT 1,
    component_ref TEXT NULL,
    component_version VARCHAR(255) NULL,
    started_at TIMESTAMPTZ NULL,
    ended_at TIMESTAMPTZ NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_etl_execution_step UNIQUE (run_id, step_code),
    CONSTRAINT ck_etl_execution_step_code CHECK (btrim(step_code) <> ''),
    CONSTRAINT ck_etl_execution_step_phase CHECK (
        phase IN ('EXTRACCION', 'STAGING', 'TRANSFORMACION', 'VALIDACION', 'PUBLICACION')
    ),
    CONSTRAINT ck_etl_execution_step_status CHECK (
        status IN ('PENDIENTE', 'EN_EJECUCION', 'EXITOSO', 'FALLIDO', 'OMITIDO')
    ),
    CONSTRAINT ck_etl_execution_step_order CHECK (step_order > 0),
    CONSTRAINT ck_etl_execution_step_times CHECK (
        (status IN ('EXITOSO', 'FALLIDO', 'OMITIDO') AND ended_at IS NOT NULL)
        OR status IN ('PENDIENTE', 'EN_EJECUCION')
    ),
    CONSTRAINT ck_etl_execution_step_details CHECK (jsonb_typeof(details) = 'object')
);

CREATE TABLE IF NOT EXISTS etl_control.etl_execution_metric (
    metric_id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES etl_control.etl_execution (run_id) ON DELETE RESTRICT,
    step_id BIGINT NULL REFERENCES etl_control.etl_execution_step (step_id) ON DELETE RESTRICT,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC(20, 4) NOT NULL,
    metric_unit VARCHAR(32) NOT NULL DEFAULT 'UNIDAD',
    dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
    measured_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT ck_etl_execution_metric_name CHECK (btrim(metric_name) <> ''),
    CONSTRAINT ck_etl_execution_metric_unit CHECK (btrim(metric_unit) <> ''),
    CONSTRAINT ck_etl_execution_metric_dimensions CHECK (jsonb_typeof(dimensions) = 'object')
);

CREATE TABLE IF NOT EXISTS etl_control.etl_execution_error (
    error_id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES etl_control.etl_execution (run_id) ON DELETE RESTRICT,
    step_id BIGINT NULL REFERENCES etl_control.etl_execution_step (step_id) ON DELETE RESTRICT,
    severity VARCHAR(12) NOT NULL,
    error_code VARCHAR(100) NOT NULL,
    cause TEXT NOT NULL,
    message TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_blocking BOOLEAN NOT NULL DEFAULT TRUE,
    resolved_at TIMESTAMPTZ NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT ck_etl_execution_error_severity CHECK (
        severity IN ('INFO', 'WARN', 'ERROR', 'CRITICAL')
    ),
    CONSTRAINT ck_etl_execution_error_fields CHECK (
        btrim(error_code) <> '' AND btrim(cause) <> '' AND btrim(message) <> ''
    ),
    CONSTRAINT ck_etl_execution_error_details CHECK (jsonb_typeof(details) = 'object')
);

CREATE TABLE IF NOT EXISTS etl_control.etl_execution_lock (
    lock_id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES etl_control.etl_execution (run_id) ON DELETE RESTRICT,
    resource_key TEXT NOT NULL,
    lock_token UUID NOT NULL UNIQUE,
    acquired_by VARCHAR(255) NOT NULL,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    lease_expires_at TIMESTAMPTZ NOT NULL,
    released_by VARCHAR(255) NULL,
    released_at TIMESTAMPTZ NULL,
    release_reason TEXT NULL,
    CONSTRAINT ck_etl_execution_lock_resource CHECK (btrim(resource_key) <> ''),
    CONSTRAINT ck_etl_execution_lock_holder CHECK (btrim(acquired_by) <> ''),
    CONSTRAINT ck_etl_execution_lock_lease CHECK (lease_expires_at > acquired_at),
    CONSTRAINT ck_etl_execution_lock_release CHECK (
        (released_at IS NULL AND released_by IS NULL AND release_reason IS NULL)
        OR (released_at IS NOT NULL AND released_by IS NOT NULL AND btrim(release_reason) <> '')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_etl_execution_lock_active_resource
    ON etl_control.etl_execution_lock (resource_key)
    WHERE released_at IS NULL;

CREATE TABLE IF NOT EXISTS etl_control.etl_source_manifest (
    manifest_id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES etl_control.etl_execution (run_id) ON DELETE RESTRICT,
    source_contract_id VARCHAR(150) NOT NULL,
    source_contract_version VARCHAR(64) NOT NULL,
    source_schema VARCHAR(63) NOT NULL,
    source_object VARCHAR(63) NOT NULL,
    source_query_sha256 CHAR(64) NOT NULL,
    source_schema_sha256 CHAR(64) NULL,
    stable_order_key TEXT NOT NULL,
    snapshot_gestion SMALLINT NULL,
    snapshot_periodo SMALLINT NULL,
    snapshot_cut_at TIMESTAMPTZ NULL,
    record_count BIGINT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDIENTE',
    extracted_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT uq_etl_source_manifest UNIQUE (run_id, source_contract_id),
    CONSTRAINT ck_etl_source_manifest_fields CHECK (
        btrim(source_contract_id) <> ''
        AND btrim(source_contract_version) <> ''
        AND btrim(source_schema) <> ''
        AND btrim(source_object) <> ''
        AND btrim(stable_order_key) <> ''
    ),
    CONSTRAINT ck_etl_source_manifest_hashes CHECK (
        source_query_sha256 ~ '^[0-9a-f]{64}$'
        AND (source_schema_sha256 IS NULL OR source_schema_sha256 ~ '^[0-9a-f]{64}$')
    ),
    CONSTRAINT ck_etl_source_manifest_period CHECK (
        (snapshot_gestion IS NULL AND snapshot_periodo IS NULL)
        OR (snapshot_gestion >= 2000 AND snapshot_periodo > 0)
    ),
    CONSTRAINT ck_etl_source_manifest_count CHECK (record_count IS NULL OR record_count >= 0),
    CONSTRAINT ck_etl_source_manifest_status CHECK (status IN ('PENDIENTE', 'COMPLETO', 'FALLIDO')),
    CONSTRAINT ck_etl_source_manifest_completion CHECK (
        (status = 'COMPLETO' AND record_count IS NOT NULL AND source_schema_sha256 IS NOT NULL AND completed_at IS NOT NULL)
        OR status IN ('PENDIENTE', 'FALLIDO')
    ),
    CONSTRAINT ck_etl_source_manifest_details CHECK (jsonb_typeof(details) = 'object')
);

CREATE TABLE IF NOT EXISTS etl_control.etl_source_manifest_artifact (
    artifact_id BIGSERIAL PRIMARY KEY,
    manifest_id BIGINT NOT NULL REFERENCES etl_control.etl_source_manifest (manifest_id)
        ON DELETE RESTRICT,
    artifact_kind VARCHAR(32) NOT NULL,
    artifact_uri TEXT NOT NULL,
    artifact_sha256 CHAR(64) NOT NULL,
    byte_count BIGINT NOT NULL,
    record_count BIGINT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_etl_source_manifest_artifact UNIQUE (manifest_id, artifact_uri),
    CONSTRAINT ck_etl_source_manifest_artifact_kind CHECK (
        artifact_kind IN ('RAW_EXTRACT', 'QUERY_PLAN', 'SCHEMA_SNAPSHOT', 'QUALITY_REPORT')
    ),
    CONSTRAINT ck_etl_source_manifest_artifact_uri CHECK (
        btrim(artifact_uri) <> '' AND artifact_uri !~ '://[^/[:space:]]+@'
    ),
    CONSTRAINT ck_etl_source_manifest_artifact_hash CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_etl_source_manifest_artifact_counts CHECK (
        byte_count >= 0 AND (record_count IS NULL OR record_count >= 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_etl_execution_status_requested
    ON etl_control.etl_execution (status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_etl_execution_closure_id
    ON etl_control.etl_execution (closure_id) WHERE closure_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_etl_execution_retry_of_run_id
    ON etl_control.etl_execution (retry_of_run_id) WHERE retry_of_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_etl_execution_event_run_id
    ON etl_control.etl_execution_event (run_id, event_id);
CREATE INDEX IF NOT EXISTS idx_etl_execution_step_run_status
    ON etl_control.etl_execution_step (run_id, status, step_order);
CREATE INDEX IF NOT EXISTS idx_etl_execution_metric_run_id
    ON etl_control.etl_execution_metric (run_id, step_id, measured_at);
CREATE INDEX IF NOT EXISTS idx_etl_execution_error_run_id
    ON etl_control.etl_execution_error (run_id, is_blocking, resolved_at, occurred_at);
CREATE INDEX IF NOT EXISTS idx_etl_source_manifest_run_status
    ON etl_control.etl_source_manifest (run_id, status);
CREATE INDEX IF NOT EXISTS idx_etl_source_manifest_period
    ON etl_control.etl_source_manifest (snapshot_gestion, snapshot_periodo)
    WHERE snapshot_gestion IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_etl_source_manifest_artifact_manifest_id
    ON etl_control.etl_source_manifest_artifact (manifest_id);

CREATE OR REPLACE FUNCTION etl_control.prevent_etl_execution_direct_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_user <> 'dw_owner' THEN
        RAISE EXCEPTION 'Use las funciones etl_control para modificar una ejecución'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.prevent_etl_execution_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Los eventos de ejecución son inmutables'
        USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.transition_etl_execution(
    p_run_id UUID,
    p_to_status VARCHAR(16),
    p_actor VARCHAR(255),
    p_reason TEXT
)
RETURNS etl_control.etl_execution
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_execution etl_control.etl_execution;
    v_previous_status VARCHAR(16);
    v_validation_ready BOOLEAN;
BEGIN
    SELECT * INTO v_execution
    FROM etl_control.etl_execution
    WHERE run_id = p_run_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe la ejecución %', p_run_id USING ERRCODE = '23503';
    END IF;

    IF btrim(coalesce(p_actor, '')) = '' OR btrim(coalesce(p_reason, '')) = '' THEN
        RAISE EXCEPTION 'Toda transición requiere actor y motivo' USING ERRCODE = '23514';
    END IF;

    v_previous_status := v_execution.status;

    IF NOT (
        (v_execution.status = 'SOLICITADA' AND p_to_status IN ('EN_EJECUCION', 'CANCELADA'))
        OR (v_execution.status = 'EN_EJECUCION' AND p_to_status IN ('PUBLICANDO', 'FALLIDA', 'CANCELADA'))
        OR (v_execution.status = 'PUBLICANDO' AND p_to_status IN ('EXITOSA', 'FALLIDA'))
    ) THEN
        RAISE EXCEPTION 'Transición no permitida: % -> %', v_execution.status, p_to_status
            USING ERRCODE = '23514';
    END IF;

    IF p_to_status = 'PUBLICANDO' THEN
        IF NOT EXISTS (
            SELECT 1 FROM etl_control.etl_source_manifest m
            WHERE m.run_id = p_run_id
        ) OR EXISTS (
            SELECT 1 FROM etl_control.etl_source_manifest m
            WHERE m.run_id = p_run_id AND m.status <> 'COMPLETO'
        ) THEN
            RAISE EXCEPTION 'PUBLICANDO requiere manifiestos completos' USING ERRCODE = '23514';
        END IF;

        SELECT EXISTS (
            SELECT 1 FROM etl_control.etl_execution_step s
            WHERE s.run_id = p_run_id
              AND s.phase = 'VALIDACION'
              AND s.status = 'EXITOSO'
        ) INTO v_validation_ready;

        IF NOT v_validation_ready OR EXISTS (
            SELECT 1 FROM etl_control.etl_execution_step s
            WHERE s.run_id = p_run_id
              AND s.phase <> 'PUBLICACION'
              AND s.status NOT IN ('EXITOSO', 'OMITIDO')
        ) THEN
            RAISE EXCEPTION 'PUBLICANDO requiere validación y pasos previos finalizados'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF p_to_status = 'EXITOSA' THEN
        IF EXISTS (
            SELECT 1 FROM etl_control.etl_source_manifest m
            WHERE m.run_id = p_run_id AND m.status <> 'COMPLETO'
        ) OR NOT EXISTS (
            SELECT 1 FROM etl_control.etl_execution_step s
            WHERE s.run_id = p_run_id
              AND s.phase = 'PUBLICACION'
              AND s.status = 'EXITOSO'
        ) OR EXISTS (
            SELECT 1 FROM etl_control.etl_execution_step s
            WHERE s.run_id = p_run_id AND s.status NOT IN ('EXITOSO', 'OMITIDO')
        ) OR EXISTS (
            SELECT 1 FROM etl_control.etl_execution_error e
            WHERE e.run_id = p_run_id AND e.is_blocking AND e.resolved_at IS NULL
        ) OR EXISTS (
            SELECT 1 FROM etl_control.etl_execution_lock l
            WHERE l.run_id = p_run_id AND l.released_at IS NULL
        ) THEN
            RAISE EXCEPTION 'EXITOSA requiere evidencia completa, sin errores bloqueantes ni locks activos'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF p_to_status = 'PUBLICANDO' AND EXISTS (
        SELECT 1 FROM etl_control.etl_execution_error e
        WHERE e.run_id = p_run_id AND e.is_blocking AND e.resolved_at IS NULL
    ) THEN
        RAISE EXCEPTION 'PUBLICANDO no permite errores bloqueantes sin resolver'
            USING ERRCODE = '23514';
    END IF;

    UPDATE etl_control.etl_execution
    SET status = p_to_status,
        status_reason = p_reason,
        started_at = CASE
            WHEN p_to_status = 'EN_EJECUCION' THEN coalesce(started_at, clock_timestamp())
            ELSE started_at
        END,
        ended_at = CASE
            WHEN p_to_status IN ('EXITOSA', 'FALLIDA', 'CANCELADA') THEN clock_timestamp()
            ELSE NULL
        END,
        row_version = row_version + 1,
        updated_at = clock_timestamp()
    WHERE run_id = p_run_id
    RETURNING * INTO v_execution;

    INSERT INTO etl_control.etl_execution_event (
        run_id, previous_status, new_status, actor, reason
    ) VALUES (
        p_run_id, v_previous_status, p_to_status, p_actor, p_reason
    );

    RETURN v_execution;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.create_etl_execution(
    p_run_id UUID,
    p_execution_kind VARCHAR(24),
    p_requested_by VARCHAR(255),
    p_closure_id BIGINT DEFAULT NULL,
    p_requested_gestion SMALLINT DEFAULT NULL,
    p_requested_periodo SMALLINT DEFAULT NULL,
    p_requested_cut_at TIMESTAMPTZ DEFAULT NULL,
    p_retry_of_run_id UUID DEFAULT NULL
)
RETURNS etl_control.etl_execution
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_execution etl_control.etl_execution;
    v_closure etl_control.academic_period_closure;
BEGIN
    IF p_run_id IS NULL OR btrim(coalesce(p_requested_by, '')) = '' THEN
        RAISE EXCEPTION 'run_id y requested_by son obligatorios' USING ERRCODE = '23514';
    END IF;

    IF p_execution_kind = 'CIERRE_ACADEMICO' THEN
        SELECT * INTO v_closure
        FROM etl_control.academic_period_closure
        WHERE closure_id = p_closure_id
        FOR KEY SHARE;

        IF NOT FOUND OR v_closure.status <> 'CERRADO'
           OR v_closure.effective_at > clock_timestamp()
           OR v_closure.processed_run_id IS NOT NULL THEN
            RAISE EXCEPTION 'El cierre académico no es elegible para una nueva ejecución'
                USING ERRCODE = '23514';
        END IF;

        p_requested_gestion := v_closure.gestion;
        p_requested_periodo := v_closure.periodo;
        p_requested_cut_at := v_closure.effective_at;
    END IF;

    IF p_execution_kind = 'REPROCESO' AND NOT EXISTS (
        SELECT 1 FROM etl_control.etl_execution
        WHERE run_id = p_retry_of_run_id
          AND status IN ('EXITOSA', 'FALLIDA', 'CANCELADA')
    ) THEN
        RAISE EXCEPTION 'REPROCESO requiere una ejecución terminal previa' USING ERRCODE = '23514';
    END IF;

    INSERT INTO etl_control.etl_execution (
        run_id, execution_kind, closure_id, retry_of_run_id, requested_gestion,
        requested_periodo, requested_cut_at, requested_by
    ) VALUES (
        p_run_id, p_execution_kind, p_closure_id, p_retry_of_run_id, p_requested_gestion,
        p_requested_periodo, p_requested_cut_at, p_requested_by
    ) RETURNING * INTO v_execution;

    INSERT INTO etl_control.etl_execution_event (
        run_id, previous_status, new_status, actor, reason
    ) VALUES (
        p_run_id, NULL, 'SOLICITADA', p_requested_by, 'Ejecución solicitada'
    );

    RETURN v_execution;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.start_etl_execution(
    p_run_id UUID, p_actor VARCHAR(255), p_reason TEXT
)
RETURNS etl_control.etl_execution
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
    SELECT etl_control.transition_etl_execution(p_run_id, 'EN_EJECUCION', p_actor, p_reason);
$$;

CREATE OR REPLACE FUNCTION etl_control.begin_etl_publication(
    p_run_id UUID, p_actor VARCHAR(255), p_reason TEXT
)
RETURNS etl_control.etl_execution
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
    SELECT etl_control.transition_etl_execution(p_run_id, 'PUBLICANDO', p_actor, p_reason);
$$;

CREATE OR REPLACE FUNCTION etl_control.complete_etl_execution(
    p_run_id UUID, p_actor VARCHAR(255), p_reason TEXT
)
RETURNS etl_control.etl_execution
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
    SELECT etl_control.transition_etl_execution(p_run_id, 'EXITOSA', p_actor, p_reason);
$$;

CREATE OR REPLACE FUNCTION etl_control.fail_etl_execution(
    p_run_id UUID, p_actor VARCHAR(255), p_reason TEXT
)
RETURNS etl_control.etl_execution
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
    SELECT etl_control.transition_etl_execution(p_run_id, 'FALLIDA', p_actor, p_reason);
$$;

CREATE OR REPLACE FUNCTION etl_control.cancel_etl_execution(
    p_run_id UUID, p_actor VARCHAR(255), p_reason TEXT
)
RETURNS etl_control.etl_execution
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
    SELECT etl_control.transition_etl_execution(p_run_id, 'CANCELADA', p_actor, p_reason);
$$;

CREATE OR REPLACE FUNCTION etl_control.register_etl_execution_step(
    p_run_id UUID,
    p_step_code VARCHAR(100),
    p_phase VARCHAR(20),
    p_status VARCHAR(16),
    p_step_order SMALLINT,
    p_component_ref TEXT DEFAULT NULL,
    p_component_version VARCHAR(255) DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS etl_control.etl_execution_step
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_step etl_control.etl_execution_step;
BEGIN
    INSERT INTO etl_control.etl_execution_step (
        run_id, step_code, phase, status, step_order, component_ref, component_version,
        started_at, ended_at, details
    ) VALUES (
        p_run_id, p_step_code, p_phase, p_status, p_step_order, p_component_ref, p_component_version,
        CASE WHEN p_status <> 'PENDIENTE' THEN clock_timestamp() ELSE NULL END,
        CASE WHEN p_status IN ('EXITOSO', 'FALLIDO', 'OMITIDO') THEN clock_timestamp() ELSE NULL END,
        coalesce(p_details, '{}'::jsonb)
    ) ON CONFLICT (run_id, step_code) DO UPDATE
    SET phase = EXCLUDED.phase,
        status = EXCLUDED.status,
        step_order = EXCLUDED.step_order,
        component_ref = EXCLUDED.component_ref,
        component_version = EXCLUDED.component_version,
        started_at = coalesce(etl_control.etl_execution_step.started_at, EXCLUDED.started_at),
        ended_at = EXCLUDED.ended_at,
        details = EXCLUDED.details,
        updated_at = clock_timestamp()
    RETURNING * INTO v_step;

    RETURN v_step;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.record_etl_execution_metric(
    p_run_id UUID,
    p_metric_name VARCHAR(100),
    p_metric_value NUMERIC,
    p_metric_unit VARCHAR(32) DEFAULT 'UNIDAD',
    p_step_id BIGINT DEFAULT NULL,
    p_dimensions JSONB DEFAULT '{}'::jsonb
)
RETURNS etl_control.etl_execution_metric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_metric etl_control.etl_execution_metric;
BEGIN
    IF p_step_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM etl_control.etl_execution_step WHERE step_id = p_step_id AND run_id = p_run_id
    ) THEN
        RAISE EXCEPTION 'La métrica debe referir un paso de la misma ejecución' USING ERRCODE = '23514';
    END IF;

    INSERT INTO etl_control.etl_execution_metric (
        run_id, step_id, metric_name, metric_value, metric_unit, dimensions
    ) VALUES (
        p_run_id, p_step_id, p_metric_name, p_metric_value, p_metric_unit, coalesce(p_dimensions, '{}'::jsonb)
    ) RETURNING * INTO v_metric;

    RETURN v_metric;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.record_etl_execution_error(
    p_run_id UUID,
    p_severity VARCHAR(12),
    p_error_code VARCHAR(100),
    p_cause TEXT,
    p_message TEXT,
    p_is_blocking BOOLEAN DEFAULT TRUE,
    p_step_id BIGINT DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS etl_control.etl_execution_error
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_error etl_control.etl_execution_error;
BEGIN
    IF p_step_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM etl_control.etl_execution_step WHERE step_id = p_step_id AND run_id = p_run_id
    ) THEN
        RAISE EXCEPTION 'El error debe referir un paso de la misma ejecución' USING ERRCODE = '23514';
    END IF;

    INSERT INTO etl_control.etl_execution_error (
        run_id, step_id, severity, error_code, cause, message, is_blocking, details
    ) VALUES (
        p_run_id, p_step_id, p_severity, p_error_code, p_cause, p_message,
        p_is_blocking, coalesce(p_details, '{}'::jsonb)
    ) RETURNING * INTO v_error;

    RETURN v_error;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.register_etl_source_manifest(
    p_run_id UUID,
    p_source_contract_id VARCHAR(150),
    p_source_contract_version VARCHAR(64),
    p_source_schema VARCHAR(63),
    p_source_object VARCHAR(63),
    p_source_query_sha256 CHAR(64),
    p_stable_order_key TEXT,
    p_status VARCHAR(16) DEFAULT 'PENDIENTE',
    p_source_schema_sha256 CHAR(64) DEFAULT NULL,
    p_snapshot_gestion SMALLINT DEFAULT NULL,
    p_snapshot_periodo SMALLINT DEFAULT NULL,
    p_snapshot_cut_at TIMESTAMPTZ DEFAULT NULL,
    p_record_count BIGINT DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS etl_control.etl_source_manifest
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_manifest etl_control.etl_source_manifest;
BEGIN
    INSERT INTO etl_control.etl_source_manifest (
        run_id, source_contract_id, source_contract_version, source_schema, source_object,
        source_query_sha256, source_schema_sha256, stable_order_key, snapshot_gestion,
        snapshot_periodo, snapshot_cut_at, record_count, status, extracted_at, completed_at, details
    ) VALUES (
        p_run_id, p_source_contract_id, p_source_contract_version, p_source_schema, p_source_object,
        p_source_query_sha256, p_source_schema_sha256, p_stable_order_key, p_snapshot_gestion,
        p_snapshot_periodo, p_snapshot_cut_at, p_record_count, p_status, clock_timestamp(),
        CASE WHEN p_status = 'COMPLETO' THEN clock_timestamp() ELSE NULL END,
        coalesce(p_details, '{}'::jsonb)
    ) ON CONFLICT (run_id, source_contract_id) DO UPDATE
    SET source_contract_version = EXCLUDED.source_contract_version,
        source_schema = EXCLUDED.source_schema,
        source_object = EXCLUDED.source_object,
        source_query_sha256 = EXCLUDED.source_query_sha256,
        source_schema_sha256 = EXCLUDED.source_schema_sha256,
        stable_order_key = EXCLUDED.stable_order_key,
        snapshot_gestion = EXCLUDED.snapshot_gestion,
        snapshot_periodo = EXCLUDED.snapshot_periodo,
        snapshot_cut_at = EXCLUDED.snapshot_cut_at,
        record_count = EXCLUDED.record_count,
        status = EXCLUDED.status,
        completed_at = EXCLUDED.completed_at,
        details = EXCLUDED.details
    RETURNING * INTO v_manifest;

    RETURN v_manifest;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.register_etl_source_manifest_artifact(
    p_manifest_id BIGINT,
    p_artifact_kind VARCHAR(32),
    p_artifact_uri TEXT,
    p_artifact_sha256 CHAR(64),
    p_byte_count BIGINT,
    p_record_count BIGINT DEFAULT NULL
)
RETURNS etl_control.etl_source_manifest_artifact
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_artifact etl_control.etl_source_manifest_artifact;
BEGIN
    INSERT INTO etl_control.etl_source_manifest_artifact (
        manifest_id, artifact_kind, artifact_uri, artifact_sha256, byte_count, record_count
    ) VALUES (
        p_manifest_id, p_artifact_kind, p_artifact_uri, p_artifact_sha256, p_byte_count, p_record_count
    ) ON CONFLICT (manifest_id, artifact_uri) DO UPDATE
    SET artifact_kind = EXCLUDED.artifact_kind,
        artifact_sha256 = EXCLUDED.artifact_sha256,
        byte_count = EXCLUDED.byte_count,
        record_count = EXCLUDED.record_count
    RETURNING * INTO v_artifact;

    RETURN v_artifact;
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
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_closure etl_control.academic_period_closure;
    v_previous_status VARCHAR(16);
    v_allowed BOOLEAN;
BEGIN
    SELECT * INTO v_closure
    FROM etl_control.academic_period_closure
    WHERE gestion = p_gestion AND periodo = p_periodo
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe el cierre académico para gestión %, periodo %', p_gestion, p_periodo
            USING ERRCODE = '23503';
    END IF;

    v_allowed := (v_closure.status = 'PENDIENTE' AND p_to_status = 'CERRADO')
        OR (v_closure.status = 'CERRADO' AND p_to_status IN ('PROCESADO', 'REABIERTO'))
        OR (v_closure.status = 'REABIERTO' AND p_to_status = 'CERRADO')
        OR (v_closure.status = 'PROCESADO' AND p_to_status = 'REABIERTO');

    IF NOT v_allowed THEN
        RAISE EXCEPTION 'Transición no permitida: % -> %', v_closure.status, p_to_status
            USING ERRCODE = '23514';
    END IF;

    IF btrim(coalesce(p_actor_subject, '')) = '' OR btrim(coalesce(p_reason, '')) = '' THEN
        RAISE EXCEPTION 'Toda transición requiere actor y motivo' USING ERRCODE = '23514';
    END IF;

    v_previous_status := v_closure.status;

    IF p_to_status = 'CERRADO' AND p_effective_at IS NULL THEN
        RAISE EXCEPTION 'CERRADO requiere effective_at' USING ERRCODE = '23514';
    END IF;

    IF p_to_status = 'PROCESADO' THEN
        IF p_processed_run_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM etl_control.etl_execution e
            WHERE e.run_id = p_processed_run_id
              AND e.closure_id = v_closure.closure_id
              AND e.status = 'EXITOSA'
        ) THEN
            RAISE EXCEPTION 'PROCESADO requiere una ejecución EXITOSA vinculada al mismo cierre'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    PERFORM set_config('etl_control.allow_closure_transition', 'on', true);

    UPDATE etl_control.academic_period_closure
    SET status = p_to_status,
        effective_at = CASE WHEN p_to_status = 'CERRADO' THEN p_effective_at ELSE effective_at END,
        authorized_by_subject = CASE
            WHEN p_to_status IN ('CERRADO', 'REABIERTO') THEN p_actor_subject
            ELSE authorized_by_subject
        END,
        closure_reason = p_reason,
        version = version + 1,
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
        updated_at = clock_timestamp()
    WHERE closure_id = v_closure.closure_id
    RETURNING * INTO v_closure;

    PERFORM set_config('etl_control.allow_closure_transition', 'off', true);

    INSERT INTO etl_control.academic_period_closure_event (
        closure_id, from_status, to_status, actor_subject, reason, run_id
    ) VALUES (
        v_closure.closure_id, v_previous_status, p_to_status, p_actor_subject,
        p_reason, CASE WHEN p_to_status = 'PROCESADO' THEN p_processed_run_id ELSE NULL END
    );

    RETURN v_closure;
END;
$$;

ALTER TABLE etl_control.academic_period_closure
    ADD CONSTRAINT fk_academic_period_closure_processed_run
    FOREIGN KEY (processed_run_id)
    REFERENCES etl_control.etl_execution (run_id)
    ON DELETE RESTRICT
    NOT VALID;

DROP TRIGGER IF EXISTS trg_etl_execution_direct_update ON etl_control.etl_execution;
CREATE TRIGGER trg_etl_execution_direct_update
BEFORE UPDATE ON etl_control.etl_execution
FOR EACH ROW EXECUTE FUNCTION etl_control.prevent_etl_execution_direct_update();

DROP TRIGGER IF EXISTS trg_etl_execution_event_immutable ON etl_control.etl_execution_event;
CREATE TRIGGER trg_etl_execution_event_immutable
BEFORE UPDATE OR DELETE ON etl_control.etl_execution_event
FOR EACH ROW EXECUTE FUNCTION etl_control.prevent_etl_execution_event_mutation();

ALTER TABLE etl_control.etl_execution OWNER TO dw_owner;
ALTER TABLE etl_control.etl_execution_event OWNER TO dw_owner;
ALTER TABLE etl_control.etl_execution_step OWNER TO dw_owner;
ALTER TABLE etl_control.etl_execution_metric OWNER TO dw_owner;
ALTER TABLE etl_control.etl_execution_error OWNER TO dw_owner;
ALTER TABLE etl_control.etl_execution_lock OWNER TO dw_owner;
ALTER TABLE etl_control.etl_source_manifest OWNER TO dw_owner;
ALTER TABLE etl_control.etl_source_manifest_artifact OWNER TO dw_owner;
ALTER FUNCTION etl_control.prevent_etl_execution_direct_update() OWNER TO dw_owner;
ALTER FUNCTION etl_control.prevent_etl_execution_event_mutation() OWNER TO dw_owner;
ALTER FUNCTION etl_control.transition_etl_execution(UUID, VARCHAR, VARCHAR, TEXT) OWNER TO dw_owner;
ALTER FUNCTION etl_control.create_etl_execution(UUID, VARCHAR, VARCHAR, BIGINT, SMALLINT, SMALLINT, TIMESTAMPTZ, UUID) OWNER TO dw_owner;
ALTER FUNCTION etl_control.start_etl_execution(UUID, VARCHAR, TEXT) OWNER TO dw_owner;
ALTER FUNCTION etl_control.begin_etl_publication(UUID, VARCHAR, TEXT) OWNER TO dw_owner;
ALTER FUNCTION etl_control.complete_etl_execution(UUID, VARCHAR, TEXT) OWNER TO dw_owner;
ALTER FUNCTION etl_control.fail_etl_execution(UUID, VARCHAR, TEXT) OWNER TO dw_owner;
ALTER FUNCTION etl_control.cancel_etl_execution(UUID, VARCHAR, TEXT) OWNER TO dw_owner;
ALTER FUNCTION etl_control.register_etl_execution_step(UUID, VARCHAR, VARCHAR, VARCHAR, SMALLINT, TEXT, VARCHAR, JSONB) OWNER TO dw_owner;
ALTER FUNCTION etl_control.record_etl_execution_metric(UUID, VARCHAR, NUMERIC, VARCHAR, BIGINT, JSONB) OWNER TO dw_owner;
ALTER FUNCTION etl_control.record_etl_execution_error(UUID, VARCHAR, VARCHAR, TEXT, TEXT, BOOLEAN, BIGINT, JSONB) OWNER TO dw_owner;
ALTER FUNCTION etl_control.register_etl_source_manifest(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, CHAR, TEXT, VARCHAR, CHAR, SMALLINT, SMALLINT, TIMESTAMPTZ, BIGINT, JSONB) OWNER TO dw_owner;
ALTER FUNCTION etl_control.register_etl_source_manifest_artifact(BIGINT, VARCHAR, TEXT, CHAR, BIGINT, BIGINT) OWNER TO dw_owner;
ALTER FUNCTION etl_control.transition_academic_period_closure(SMALLINT, SMALLINT, VARCHAR, VARCHAR, TEXT, TIMESTAMPTZ, UUID) OWNER TO dw_owner;

RESET ROLE;

REVOKE ALL ON TABLE etl_control.etl_execution,
    etl_control.etl_execution_event,
    etl_control.etl_execution_step,
    etl_control.etl_execution_metric,
    etl_control.etl_execution_error,
    etl_control.etl_execution_lock,
    etl_control.etl_source_manifest,
    etl_control.etl_source_manifest_artifact FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA etl_control FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA etl_control FROM PUBLIC;

GRANT SELECT ON etl_control.etl_execution,
    etl_control.etl_execution_event,
    etl_control.etl_execution_step,
    etl_control.etl_execution_metric,
    etl_control.etl_execution_error,
    etl_control.etl_execution_lock,
    etl_control.etl_source_manifest,
    etl_control.etl_source_manifest_artifact
TO dw_staging_writer, dw_transformer, dw_control_operator, dw_publisher;

GRANT SELECT ON etl_control.academic_period_closure
TO dw_staging_writer;

GRANT USAGE ON SCHEMA etl_control TO dw_staging_writer;

GRANT EXECUTE ON FUNCTION etl_control.create_etl_execution(
    UUID, VARCHAR, VARCHAR, BIGINT, SMALLINT, SMALLINT, TIMESTAMPTZ, UUID
) TO dw_staging_writer;
GRANT EXECUTE ON FUNCTION etl_control.start_etl_execution(UUID, VARCHAR, TEXT)
    TO dw_staging_writer;
GRANT EXECUTE ON FUNCTION etl_control.register_etl_source_manifest(
    UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, CHAR, TEXT, VARCHAR, CHAR, SMALLINT, SMALLINT, TIMESTAMPTZ, BIGINT, JSONB
) TO dw_staging_writer;
GRANT EXECUTE ON FUNCTION etl_control.register_etl_source_manifest_artifact(
    BIGINT, VARCHAR, TEXT, CHAR, BIGINT, BIGINT
) TO dw_staging_writer;

GRANT EXECUTE ON FUNCTION etl_control.register_etl_execution_step(
    UUID, VARCHAR, VARCHAR, VARCHAR, SMALLINT, TEXT, VARCHAR, JSONB
), etl_control.record_etl_execution_metric(UUID, VARCHAR, NUMERIC, VARCHAR, BIGINT, JSONB),
etl_control.record_etl_execution_error(UUID, VARCHAR, VARCHAR, TEXT, TEXT, BOOLEAN, BIGINT, JSONB),
etl_control.fail_etl_execution(UUID, VARCHAR, TEXT),
etl_control.cancel_etl_execution(UUID, VARCHAR, TEXT)
TO dw_staging_writer, dw_transformer, dw_publisher;

GRANT EXECUTE ON FUNCTION etl_control.begin_etl_publication(UUID, VARCHAR, TEXT),
etl_control.complete_etl_execution(UUID, VARCHAR, TEXT)
TO dw_publisher;

COMMENT ON TABLE etl_control.etl_execution IS
    'Unidad auditable de una carga DW. run_id se entrega por el orquestador y nunca se reutiliza.';
COMMENT ON TABLE etl_control.etl_execution_lock IS
    'Lease persistente con exclusión de recurso activo; coordinación, renovación y recuperación pertenecen a DW-013.';
COMMENT ON TABLE etl_control.etl_source_manifest IS
    'Evidencia de extracción por contrato fuente, corte, orden estable, conteo y hashes; no conserva datos extraídos.';
COMMENT ON TABLE etl_control.etl_source_manifest_artifact IS
    'Referencias sin credenciales a artefactos de una extracción, protegidas por checksum SHA-256.';
