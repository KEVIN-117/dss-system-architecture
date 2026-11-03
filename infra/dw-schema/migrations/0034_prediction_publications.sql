-- PRED-007: immutable, atomic analytical publications for model scores.
-- Predictions are deliberately separate from observed DW outcome facts.
DO $$
BEGIN
    IF to_regclass('ml_workspace.training_job') IS NULL
       OR to_regclass('etl_control.academic_period_closure') IS NULL THEN
        RAISE EXCEPTION 'PRED-007 requires prediction job storage and academic closures';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dw_prediction_publisher') THEN
        CREATE ROLE dw_prediction_publisher NOLOGIN;
    END IF;
END;
$$;

SET ROLE dw_owner;
CREATE TABLE ml_workspace.prediction_batch (
    batch_id UUID PRIMARY KEY,
    idempotency_scope TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    request_digest CHAR(64) NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
    event_code TEXT NOT NULL CHECK (event_code = 'PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE'),
    program_ref TEXT NOT NULL,
    closure_id BIGINT NOT NULL REFERENCES etl_control.academic_period_closure(closure_id),
    model_id TEXT NOT NULL,
    model_version TEXT NOT NULL,
    submitted_by TEXT NOT NULL,
    authorized_scope JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('QUEUED','RUNNING','PUBLISHED','FAILED')),
    result_count INTEGER NOT NULL DEFAULT 0 CHECK (result_count >= 0),
    source_execution_ids UUID[] NOT NULL DEFAULT '{}',
    error JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    lease_until TIMESTAMPTZ,
    UNIQUE (idempotency_scope, idempotency_key)
);
CREATE INDEX prediction_batch_cut_idx
    ON ml_workspace.prediction_batch(event_code, program_ref, closure_id, status, published_at DESC);

CREATE TABLE ml_workspace.prediction_batch_outbox (
    outbox_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    batch_id UUID NOT NULL REFERENCES ml_workspace.prediction_batch(batch_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    published_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    last_error TEXT,
    next_attempt_at TIMESTAMPTZ,
    UNIQUE(batch_id)
);
CREATE INDEX prediction_batch_outbox_pending_idx
    ON ml_workspace.prediction_batch_outbox(next_attempt_at, outbox_id) WHERE published_at IS NULL;

CREATE TABLE ml_workspace.prediction_result (
    batch_id UUID NOT NULL REFERENCES ml_workspace.prediction_batch(batch_id) ON DELETE CASCADE,
    subject_ref TEXT NOT NULL,
    program_ref TEXT NOT NULL,
    closure_id BIGINT NOT NULL,
    predicted_class TEXT NOT NULL CHECK (predicted_class IN ('POSITIVE_EVENT','NEGATIVE_EVENT')),
    event_probability DOUBLE PRECISION CHECK (event_probability IS NULL OR event_probability BETWEEN 0 AND 1),
    model_id TEXT NOT NULL,
    model_version TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (batch_id, subject_ref)
);
CREATE INDEX prediction_result_student_idx ON ml_workspace.prediction_result(subject_ref, generated_at DESC);

CREATE VIEW ml_workspace.v_published_prediction AS
SELECT r.batch_id, r.subject_ref, r.program_ref, r.closure_id, r.predicted_class,
       r.event_probability, r.model_id, r.model_version, r.generated_at,
       b.event_code, b.published_at, b.result_count
FROM ml_workspace.prediction_result r
JOIN ml_workspace.prediction_batch b USING (batch_id)
WHERE b.status = 'PUBLISHED';

REVOKE ALL ON ml_workspace.prediction_batch, ml_workspace.prediction_batch_outbox,
    ml_workspace.prediction_result FROM PUBLIC, dw_ml_writer, dw_prediction_reader, dw_reader;
REVOKE ALL ON ml_workspace.v_published_prediction FROM PUBLIC, dw_ml_writer, dw_prediction_reader, dw_reader;
REVOKE ALL ON SEQUENCE ml_workspace.prediction_batch_outbox_outbox_id_seq FROM PUBLIC, dw_ml_writer, dw_prediction_reader, dw_reader;
GRANT USAGE ON SCHEMA ml_workspace TO dw_prediction_publisher, dw_prediction_runtime, dw_reader;
GRANT SELECT, INSERT, UPDATE ON ml_workspace.prediction_batch, ml_workspace.prediction_batch_outbox TO dw_prediction_runtime;
GRANT USAGE, SELECT ON SEQUENCE ml_workspace.prediction_batch_outbox_outbox_id_seq TO dw_prediction_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ml_workspace.prediction_result TO dw_prediction_publisher;
-- Dashboard users do not receive unrestricted SQL access. The authenticated
-- Prediction API applies per-request academic scope before serving this view.
GRANT SELECT ON ml_workspace.v_published_prediction TO dw_prediction_runtime;

COMMENT ON TABLE ml_workspace.prediction_batch IS 'PRED-007 versioned population scoring jobs; only PUBLISHED batches are analytically visible.';
COMMENT ON TABLE ml_workspace.prediction_result IS 'Predicted program-dropout outcomes; never an observed fact or label.';
COMMENT ON VIEW ml_workspace.v_published_prediction IS 'Read contract exposing rows only after atomic batch publication.';
RESET ROLE;
