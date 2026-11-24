-- PRED-102 (#371): the prediction job table also tracks dataset extractions
-- (and, from PRED-104, forecasts) launched from the admin portal.
--
-- * job_kind   TRAIN (default, every existing row), EXTRACT_DATASET or FORECAST.
-- * params     validated request parameters of non-training jobs
--              (task code, cadence, programs, horizon).
-- * result_ref opaque reference to what the job produced, e.g. custom:<uuid>
--              for an extracted dataset.
--
-- Only TRAIN jobs keep the algorithm restricted to the supported classifiers;
-- other kinds store an empty algorithm.

DO $$
BEGIN
    IF to_regclass('ml_workspace.training_job') IS NULL THEN
        RAISE EXCEPTION '0066 requires ml_workspace.training_job from 0026';
    END IF;
END;
$$;

ALTER TABLE ml_workspace.training_job
    ADD COLUMN job_kind TEXT NOT NULL DEFAULT 'TRAIN'
        CONSTRAINT training_job_kind_check CHECK (job_kind IN ('TRAIN', 'EXTRACT_DATASET', 'FORECAST')),
    ADD COLUMN params JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN result_ref TEXT;

ALTER TABLE ml_workspace.training_job DROP CONSTRAINT training_job_algorithm_check;
ALTER TABLE ml_workspace.training_job
    ADD CONSTRAINT training_job_algorithm_check CHECK (
        (job_kind = 'TRAIN' AND algorithm IN ('random_forest', 'xgboost'))
        OR (job_kind <> 'TRAIN')
    );

-- Admin portal job list: newest first, optionally filtered by kind/status.
CREATE INDEX training_job_recent_idx ON ml_workspace.training_job (created_at DESC);
CREATE INDEX training_job_kind_recent_idx ON ml_workspace.training_job (job_kind, created_at DESC);

COMMENT ON COLUMN ml_workspace.training_job.job_kind IS
    'TRAIN, EXTRACT_DATASET or FORECAST (PRED-102/PRED-104).';
COMMENT ON COLUMN ml_workspace.training_job.params IS
    'Validated parameters of non-training jobs (task_code, cadence, programs, horizon).';
COMMENT ON COLUMN ml_workspace.training_job.result_ref IS
    'Opaque reference to the job output, e.g. custom:<dataset uuid>.';
