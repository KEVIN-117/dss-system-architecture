-- PRED-103 (#372): new prediction targets.
--
-- * Training jobs may use the 'ridge' regressor (regression tasks); classifiers
--   keep random_forest/xgboost.
-- * Population batches can score every student-level task, not only program
--   dropout: STUDENT_BACKLOG_NEXT_CUT (classification) and
--   STUDENT_GPA_NEXT_CUT (regression).
-- * Regression results carry a predicted value and its residual intervals
--   instead of a class; a result row must carry one or the other.

DO $$
BEGIN
    IF to_regclass('ml_workspace.training_job') IS NULL
       OR to_regclass('ml_workspace.prediction_batch') IS NULL
       OR to_regclass('ml_workspace.prediction_result') IS NULL
       OR to_regclass('ml_workspace.v_published_prediction') IS NULL THEN
        RAISE EXCEPTION '0067 requires the prediction job (0026, 0066) and publication (0034) objects';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'ml_workspace' AND table_name = 'training_job' AND column_name = 'job_kind') THEN
        RAISE EXCEPTION '0067 requires job_kind from 0066';
    END IF;
END;
$$;

ALTER TABLE ml_workspace.training_job DROP CONSTRAINT training_job_algorithm_check;
ALTER TABLE ml_workspace.training_job
    ADD CONSTRAINT training_job_algorithm_check CHECK (
        (job_kind = 'TRAIN' AND algorithm IN ('random_forest', 'xgboost', 'ridge'))
        OR (job_kind <> 'TRAIN')
    );

SET ROLE dw_owner;

ALTER TABLE ml_workspace.prediction_batch DROP CONSTRAINT prediction_batch_event_code_check;
ALTER TABLE ml_workspace.prediction_batch
    ADD CONSTRAINT prediction_batch_event_code_check CHECK (event_code IN (
        'PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE', 'STUDENT_BACKLOG_NEXT_CUT', 'STUDENT_GPA_NEXT_CUT'
    ));

ALTER TABLE ml_workspace.prediction_result ALTER COLUMN predicted_class DROP NOT NULL;
ALTER TABLE ml_workspace.prediction_result
    ADD COLUMN predicted_value DOUBLE PRECISION
        CONSTRAINT prediction_result_value_finite_check
        CHECK (predicted_value IS NULL OR predicted_value NOT IN ('NaN'::double precision, 'Infinity'::double precision, '-Infinity'::double precision)),
    ADD COLUMN prediction_interval JSONB,
    ADD CONSTRAINT prediction_result_kind_check CHECK (
        (predicted_class IS NOT NULL AND predicted_value IS NULL AND prediction_interval IS NULL)
        OR (predicted_class IS NULL AND event_probability IS NULL AND predicted_value IS NOT NULL)
    );

-- New columns are appended so CREATE OR REPLACE keeps the existing ones and grants.
CREATE OR REPLACE VIEW ml_workspace.v_published_prediction AS
SELECT r.batch_id, r.subject_ref, r.program_ref, r.closure_id, r.predicted_class,
       r.event_probability, r.model_id, r.model_version, r.generated_at,
       b.event_code, b.published_at, b.result_count,
       r.predicted_value, r.prediction_interval
FROM ml_workspace.prediction_result r
JOIN ml_workspace.prediction_batch b USING (batch_id)
WHERE b.status = 'PUBLISHED';

COMMENT ON TABLE ml_workspace.prediction_result IS
    'Predicted outcomes of student-level tasks (class or value); never an observed fact or label.';
COMMENT ON COLUMN ml_workspace.prediction_result.predicted_value IS
    'Regression tasks: predicted value (e.g. next-cut PPA). NULL for classification tasks.';
COMMENT ON COLUMN ml_workspace.prediction_result.prediction_interval IS
    'Regression tasks: {"0.8": {"lower", "upper"}, "0.95": {...}} from out-of-fold residual quantiles.';

RESET ROLE;
