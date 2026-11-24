-- PRED-103 (0067): ridge training jobs, student-level batch events and
-- regression results (value + interval, no class).
DO $$
DECLARE
    v_rejected BOOLEAN;
    v_closure BIGINT;
BEGIN
    INSERT INTO ml_workspace.training_job
        (job_id, idempotency_scope, idempotency_key, request_digest, dataset_ref, algorithm, status,
         submitted_by, dataset_version)
    VALUES ('00000000-0000-4000-8000-000000001031', 'test', 'pred103-ridge', repeat('a', 64),
            'fixture:x', 'ridge', 'QUEUED', 'tester', 'v1');
    DELETE FROM ml_workspace.training_job WHERE job_id = '00000000-0000-4000-8000-000000001031';

    SELECT closure_id INTO v_closure FROM etl_control.academic_period_closure ORDER BY closure_id LIMIT 1;
    IF v_closure IS NULL THEN
        -- No closure fixture in this database: the batch checks below need one.
        RAISE NOTICE 'No academic closure available; skipping batch/result checks';
        RETURN;
    END IF;

    INSERT INTO ml_workspace.prediction_batch
        (batch_id, idempotency_scope, idempotency_key, request_digest, event_code, program_ref, closure_id,
         model_id, model_version, submitted_by, authorized_scope, status)
    VALUES ('00000000-0000-4000-8000-000000001032', 'test', 'pred103-gpa', repeat('b', 64),
            'STUDENT_GPA_NEXT_CUT', 'P01', v_closure, 'm', 'v', 'tester', '{}', 'RUNNING');

    INSERT INTO ml_workspace.prediction_result
        (batch_id, subject_ref, program_ref, closure_id, predicted_class, event_probability, model_id, model_version,
         generated_at, predicted_value, prediction_interval)
    VALUES ('00000000-0000-4000-8000-000000001032', '1', 'P01', v_closure, NULL, NULL, 'm', 'v', clock_timestamp(),
            71.5, '{"0.8": {"lower": 68.0, "upper": 75.0}}');

    v_rejected := FALSE;
    BEGIN
        INSERT INTO ml_workspace.prediction_result
            (batch_id, subject_ref, program_ref, closure_id, predicted_class, model_id, model_version, generated_at,
             predicted_value)
        VALUES ('00000000-0000-4000-8000-000000001032', '2', 'P01', v_closure, 'POSITIVE_EVENT', 'm', 'v',
                clock_timestamp(), 1.0);
    EXCEPTION WHEN check_violation THEN
        v_rejected := TRUE;
    END;
    IF NOT v_rejected THEN
        RAISE EXCEPTION 'A result row with both a class and a value must be rejected';
    END IF;

    v_rejected := FALSE;
    BEGIN
        INSERT INTO ml_workspace.prediction_batch
            (batch_id, idempotency_scope, idempotency_key, request_digest, event_code, program_ref, closure_id,
             model_id, model_version, submitted_by, authorized_scope, status)
        VALUES ('00000000-0000-4000-8000-000000001033', 'test', 'pred103-course', repeat('c', 64),
                'COURSE_FINAL_GRADE', 'P01', v_closure, 'm', 'v', 'tester', '{}', 'QUEUED');
    EXCEPTION WHEN check_violation THEN
        v_rejected := TRUE;
    END;
    IF NOT v_rejected THEN
        RAISE EXCEPTION 'Course-level events have no population batches';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'ml_workspace' AND table_name = 'v_published_prediction'
                     AND column_name = 'predicted_value') THEN
        RAISE EXCEPTION 'Published prediction view does not expose regression values';
    END IF;

    DELETE FROM ml_workspace.prediction_batch WHERE batch_id = '00000000-0000-4000-8000-000000001032';
END;
$$;

SELECT 'PRED-103 ridge jobs, student-level batches and regression results are valid' AS result;
