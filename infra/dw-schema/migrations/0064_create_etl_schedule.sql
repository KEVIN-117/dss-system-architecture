-- LM-002 (#350): Load Manager schedules. dw-control-service validates the
-- cron expression (Spring CronExpression), checks it against the DSA operating
-- window and computes next_fire_at; the database stores the schedule, hands
-- due schedules to exactly one service instance through a claim lease and
-- audits every change and fire.

DO $$
BEGIN
    IF to_regclass('etl_control.etl_process') IS NULL
       OR to_regclass('etl_control.etl_launch') IS NULL THEN
        RAISE EXCEPTION '0064 requires the Load Manager catalog (0062) and launches (0063)';
    END IF;
END;
$$;

SET ROLE dw_owner;

CREATE TABLE IF NOT EXISTS etl_control.etl_schedule (
    schedule_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    process_code VARCHAR(32) NOT NULL REFERENCES etl_control.etl_process (process_code)
        ON DELETE RESTRICT,
    name VARCHAR(120) NOT NULL,
    cron_expression VARCHAR(120) NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'America/La_Paz',
    mode VARCHAR(32) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    next_fire_at TIMESTAMPTZ NULL,
    last_fired_at TIMESTAMPTZ NULL,
    last_launch_id UUID NULL REFERENCES etl_control.etl_launch (launch_id) ON DELETE RESTRICT,
    claim_token UUID NULL,
    claimed_until TIMESTAMPTZ NULL,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_by VARCHAR(255) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    deleted_at TIMESTAMPTZ NULL,
    row_version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT ck_etl_schedule_name CHECK (btrim(name) <> ''),
    -- Spring cron: six space-separated fields (second minute hour day month weekday).
    CONSTRAINT ck_etl_schedule_cron CHECK (cron_expression ~ '^\S+( \S+){5}$'),
    CONSTRAINT ck_etl_schedule_mode CHECK (mode IN ('AUTO_PENDING_CLOSURES', 'NO_PARAMETERS')),
    CONSTRAINT ck_etl_schedule_next_fire CHECK (
        NOT enabled OR deleted_at IS NOT NULL OR next_fire_at IS NOT NULL
    ),
    CONSTRAINT ck_etl_schedule_claim CHECK ((claim_token IS NULL) = (claimed_until IS NULL)),
    CONSTRAINT ck_etl_schedule_deleted CHECK (deleted_at IS NULL OR NOT enabled),
    CONSTRAINT ck_etl_schedule_actors CHECK (btrim(created_by) <> '' AND btrim(updated_by) <> ''),
    CONSTRAINT ck_etl_schedule_row_version CHECK (row_version > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_etl_schedule_active_name
    ON etl_control.etl_schedule (lower(name))
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_etl_schedule_due
    ON etl_control.etl_schedule (next_fire_at)
    WHERE enabled AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS etl_control.etl_schedule_event (
    event_id BIGSERIAL PRIMARY KEY,
    schedule_id BIGINT NOT NULL REFERENCES etl_control.etl_schedule (schedule_id) ON DELETE RESTRICT,
    event_type VARCHAR(16) NOT NULL,
    actor VARCHAR(255) NOT NULL,
    launch_id UUID NULL REFERENCES etl_control.etl_launch (launch_id) ON DELETE RESTRICT,
    detail JSONB NOT NULL DEFAULT '{}'::JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT ck_etl_schedule_event_type CHECK (
        event_type IN ('CREATED', 'UPDATED', 'ENABLED', 'DISABLED', 'DELETED', 'FIRED', 'SKIPPED')
    ),
    CONSTRAINT ck_etl_schedule_event_actor CHECK (btrim(actor) <> ''),
    CONSTRAINT ck_etl_schedule_event_detail CHECK (jsonb_typeof(detail) = 'object'),
    CONSTRAINT ck_etl_schedule_event_launch CHECK (
        event_type NOT IN ('FIRED', 'SKIPPED') OR launch_id IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS ix_etl_schedule_event_schedule
    ON etl_control.etl_schedule_event (schedule_id, occurred_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_etl_launch_schedule'
          AND conrelid = 'etl_control.etl_launch'::regclass
    ) THEN
        ALTER TABLE etl_control.etl_launch
            ADD CONSTRAINT fk_etl_launch_schedule
            FOREIGN KEY (schedule_id) REFERENCES etl_control.etl_schedule (schedule_id) ON DELETE RESTRICT;
    END IF;
END;
$$;

RESET ROLE;

ALTER TABLE etl_control.etl_schedule OWNER TO dw_owner;
ALTER TABLE etl_control.etl_schedule_event OWNER TO dw_owner;

COMMENT ON TABLE etl_control.etl_schedule IS
    'Load Manager: programaciones cron de procesos ETL, fuera del horario operativo de la DSA.';
COMMENT ON COLUMN etl_control.etl_schedule.cron_expression IS
    'Expresión cron de Spring (6 campos), validada y evaluada por dw-control-service.';
COMMENT ON COLUMN etl_control.etl_schedule.next_fire_at IS
    'Próximo disparo calculado por dw-control-service; NULL si la programación está pausada.';
COMMENT ON COLUMN etl_control.etl_schedule.claim_token IS
    'Lease de disparo: solo la instancia que reclamó la programación puede completar ese disparo.';
COMMENT ON TABLE etl_control.etl_schedule_event IS
    'Auditoría append-only de cambios y disparos (incluidos los omitidos) de etl_schedule.';
