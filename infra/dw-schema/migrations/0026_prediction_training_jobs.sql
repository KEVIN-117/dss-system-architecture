-- PRED-003 durable training jobs and transactional dispatch outbox.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dw_prediction_runtime') THEN
        CREATE ROLE dw_prediction_runtime NOLOGIN;
    END IF;
END;
$$;

CREATE TABLE ml_workspace.training_job (
    job_id UUID PRIMARY KEY,
    idempotency_scope TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    request_digest CHAR(64) NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
    dataset_ref TEXT NOT NULL,
    algorithm TEXT NOT NULL CHECK (algorithm IN ('random_forest', 'xgboost')),
    status TEXT NOT NULL CHECK (status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    submitted_by TEXT NOT NULL,
    model_candidate JSONB,
    error JSONB,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    dataset_version TEXT NOT NULL,
    dependency_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
    attempt INTEGER NOT NULL DEFAULT 0 CHECK (attempt >= 0),
    lease_until TIMESTAMPTZ,
    UNIQUE (idempotency_scope, idempotency_key)
);
CREATE INDEX training_job_active_idx ON ml_workspace.training_job(status, created_at)
    WHERE status IN ('QUEUED','RUNNING');

CREATE TABLE ml_workspace.training_job_outbox (
    outbox_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES ml_workspace.training_job(job_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    published_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    last_error TEXT,
    UNIQUE(job_id)
);
CREATE INDEX training_job_outbox_pending_idx ON ml_workspace.training_job_outbox(outbox_id)
    WHERE published_at IS NULL;

REVOKE ALL ON ml_workspace.training_job, ml_workspace.training_job_outbox FROM dw_ml_writer;
REVOKE ALL ON SEQUENCE ml_workspace.training_job_outbox_outbox_id_seq FROM dw_ml_writer;
GRANT USAGE ON SCHEMA ml_workspace TO dw_prediction_runtime;
GRANT SELECT, INSERT, UPDATE ON ml_workspace.training_job TO dw_prediction_runtime;
GRANT SELECT, INSERT, UPDATE ON ml_workspace.training_job_outbox TO dw_prediction_runtime;
GRANT USAGE, SELECT ON SEQUENCE ml_workspace.training_job_outbox_outbox_id_seq TO dw_prediction_runtime;
