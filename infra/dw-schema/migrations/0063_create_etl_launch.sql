-- LM-002 (#350): every Load Manager execution request (manual or scheduled)
-- and its lifecycle on Hop Server. Business results of a DW load still live in
-- etl_control.etl_execution, written by the Hop workflow itself; a launch
-- records who asked, when, with which parameters and how the Hop run ended.

DO $$
BEGIN
    IF to_regclass('etl_control.etl_process') IS NULL
       OR to_regclass('etl_control.academic_period_closure') IS NULL THEN
        RAISE EXCEPTION '0063 requires the Load Manager catalog (0062) and the closure calendar (0001)';
    END IF;
END;
$$;

SET ROLE dw_owner;

CREATE TABLE IF NOT EXISTS etl_control.etl_launch (
    launch_id UUID PRIMARY KEY,
    process_code VARCHAR(32) NOT NULL REFERENCES etl_control.etl_process (process_code)
        ON DELETE RESTRICT,
    trigger_kind VARCHAR(16) NOT NULL,
    -- FK to etl_schedule is added by 0064.
    schedule_id BIGINT NULL,
    closure_id BIGINT NULL REFERENCES etl_control.academic_period_closure (closure_id)
        ON DELETE RESTRICT,
    -- P_RUN_ID sent to Hop. The vertical workflow creates the etl_execution
    -- row with this id once it starts, so there is no FK at request time.
    -- Not unique: PUBLISH_STAGED may retry the publication of the same run.
    run_id UUID NULL,
    parameters JSONB NOT NULL DEFAULT '{}'::JSONB,
    status VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
    hop_execution_id UUID NULL UNIQUE,
    requested_by VARCHAR(255) NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    submitted_at TIMESTAMPTZ NULL,
    started_at TIMESTAMPTZ NULL,
    finished_at TIMESTAMPTZ NULL,
    stop_requested_by VARCHAR(255) NULL,
    stop_requested_at TIMESTAMPTZ NULL,
    result_summary TEXT NULL,
    log_excerpt TEXT NULL,
    row_version INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT ck_etl_launch_trigger CHECK (
        (trigger_kind = 'MANUAL' AND schedule_id IS NULL)
        OR (trigger_kind = 'SCHEDULED' AND schedule_id IS NOT NULL)
    ),
    CONSTRAINT ck_etl_launch_status CHECK (
        status IN ('QUEUED', 'SUBMITTED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'STOPPED', 'SKIPPED', 'SUBMIT_FAILED')
    ),
    CONSTRAINT ck_etl_launch_parameters CHECK (jsonb_typeof(parameters) = 'object'),
    CONSTRAINT ck_etl_launch_requested_by CHECK (btrim(requested_by) <> ''),
    CONSTRAINT ck_etl_launch_terminal_timestamps CHECK (
        (status IN ('SUCCEEDED', 'FAILED', 'STOPPED', 'SKIPPED', 'SUBMIT_FAILED') AND finished_at IS NOT NULL)
        OR (status NOT IN ('SUCCEEDED', 'FAILED', 'STOPPED', 'SKIPPED', 'SUBMIT_FAILED') AND finished_at IS NULL)
    ),
    -- Every state reached through Hop carries its execution id. STOPPED may
    -- also be a queued launch cancelled before it was ever submitted.
    CONSTRAINT ck_etl_launch_submitted CHECK (
        status IN ('QUEUED', 'SKIPPED', 'SUBMIT_FAILED')
        OR (status = 'STOPPED' AND hop_execution_id IS NULL AND submitted_at IS NULL)
        OR (hop_execution_id IS NOT NULL AND submitted_at IS NOT NULL)
    ),
    CONSTRAINT ck_etl_launch_stop_request CHECK (
        (stop_requested_by IS NULL) = (stop_requested_at IS NULL)
    ),
    CONSTRAINT ck_etl_launch_text_sizes CHECK (
        (result_summary IS NULL OR length(result_summary) <= 2000)
        AND (log_excerpt IS NULL OR length(log_excerpt) <= 65536)
    ),
    CONSTRAINT ck_etl_launch_row_version CHECK (row_version > 0)
);

-- One active launch per process: a second request while one is queued,
-- submitted or running fails instead of starting a duplicate load.
CREATE UNIQUE INDEX IF NOT EXISTS ux_etl_launch_one_active_per_process
    ON etl_control.etl_launch (process_code)
    WHERE status IN ('QUEUED', 'SUBMITTED', 'RUNNING');

CREATE INDEX IF NOT EXISTS ix_etl_launch_requested_at
    ON etl_control.etl_launch (requested_at DESC);
CREATE INDEX IF NOT EXISTS ix_etl_launch_process_requested_at
    ON etl_control.etl_launch (process_code, requested_at DESC);
CREATE INDEX IF NOT EXISTS ix_etl_launch_schedule
    ON etl_control.etl_launch (schedule_id, requested_at DESC)
    WHERE schedule_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_etl_launch_run
    ON etl_control.etl_launch (run_id)
    WHERE run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_etl_launch_active
    ON etl_control.etl_launch (status)
    WHERE status IN ('QUEUED', 'SUBMITTED', 'RUNNING');

CREATE TABLE IF NOT EXISTS etl_control.etl_launch_event (
    event_id BIGSERIAL PRIMARY KEY,
    launch_id UUID NOT NULL REFERENCES etl_control.etl_launch (launch_id) ON DELETE RESTRICT,
    event_type VARCHAR(24) NOT NULL,
    previous_status VARCHAR(16) NULL,
    new_status VARCHAR(16) NULL,
    actor VARCHAR(255) NOT NULL,
    detail TEXT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT ck_etl_launch_event_type CHECK (
        event_type IN ('REQUESTED', 'STATUS_CHANGED', 'STOP_REQUESTED', 'SKIPPED')
    ),
    CONSTRAINT ck_etl_launch_event_actor CHECK (btrim(actor) <> ''),
    CONSTRAINT ck_etl_launch_event_detail CHECK (detail IS NULL OR length(detail) <= 2000)
);

CREATE INDEX IF NOT EXISTS ix_etl_launch_event_launch
    ON etl_control.etl_launch_event (launch_id, occurred_at);

RESET ROLE;

ALTER TABLE etl_control.etl_launch OWNER TO dw_owner;
ALTER TABLE etl_control.etl_launch_event OWNER TO dw_owner;

COMMENT ON TABLE etl_control.etl_launch IS
    'Load Manager: solicitud de ejecución (manual o programada) y su ciclo de vida en Hop Server.';
COMMENT ON COLUMN etl_control.etl_launch.run_id IS
    'P_RUN_ID enviado a Hop; enlaza con etl_execution cuando el workflow la crea.';
COMMENT ON COLUMN etl_control.etl_launch.hop_execution_id IS
    'Identificador de la ejecución devuelto por registerWorkflow de Hop Server.';
COMMENT ON COLUMN etl_control.etl_launch.log_excerpt IS
    'Últimas líneas del log de Hop (máximo 64 KiB), saneadas por dw-control-service.';
COMMENT ON TABLE etl_control.etl_launch_event IS
    'Auditoría append-only de solicitudes, transiciones y pedidos de detención de etl_launch.';
