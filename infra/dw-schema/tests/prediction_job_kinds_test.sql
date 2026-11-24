-- PRED-102 (0066): the prediction job table stores extraction jobs and keeps
-- the algorithm restriction for training jobs only.
DO $$
DECLARE
    v_rejected BOOLEAN;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'ml_workspace' AND table_name = 'training_job' AND column_name = 'job_kind')
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = 'ml_workspace' AND table_name = 'training_job' AND column_name = 'params')
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = 'ml_workspace' AND table_name = 'training_job' AND column_name = 'result_ref') THEN
        RAISE EXCEPTION 'PRED-102 job kind columns are missing';
    END IF;

    INSERT INTO ml_workspace.training_job
        (job_id, idempotency_scope, idempotency_key, request_digest, dataset_ref, algorithm, status,
         submitted_by, dataset_version)
    VALUES ('00000000-0000-4000-8000-000000001021', 'test', 'pred102-train', repeat('a', 64),
            'fixture:x', 'xgboost', 'QUEUED', 'tester', 'v1');
    IF (SELECT job_kind FROM ml_workspace.training_job
        WHERE job_id = '00000000-0000-4000-8000-000000001021') <> 'TRAIN' THEN
        RAISE EXCEPTION 'Existing training inserts must default to job_kind TRAIN';
    END IF;

    INSERT INTO ml_workspace.training_job
        (job_id, idempotency_scope, idempotency_key, request_digest, dataset_ref, algorithm, status,
         submitted_by, dataset_version, job_kind, params, result_ref)
    VALUES ('00000000-0000-4000-8000-000000001022', 'test', 'pred102-extract', repeat('b', 64),
            'custom:00000000-0000-4000-8000-0000000010aa', '', 'SUCCEEDED', 'tester', 'v1',
            'EXTRACT_DATASET', '{"task_code": "PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE"}',
            'custom:00000000-0000-4000-8000-0000000010aa');

    v_rejected := FALSE;
    BEGIN
        INSERT INTO ml_workspace.training_job
            (job_id, idempotency_scope, idempotency_key, request_digest, dataset_ref, algorithm, status,
             submitted_by, dataset_version)
        VALUES ('00000000-0000-4000-8000-000000001023', 'test', 'pred102-bad-train', repeat('c', 64),
                'fixture:x', '', 'QUEUED', 'tester', 'v1');
    EXCEPTION WHEN check_violation THEN
        v_rejected := TRUE;
    END;
    IF NOT v_rejected THEN
        RAISE EXCEPTION 'A TRAIN job without a supported algorithm must be rejected';
    END IF;

    v_rejected := FALSE;
    BEGIN
        INSERT INTO ml_workspace.training_job
            (job_id, idempotency_scope, idempotency_key, request_digest, dataset_ref, algorithm, status,
             submitted_by, dataset_version, job_kind)
        VALUES ('00000000-0000-4000-8000-000000001024', 'test', 'pred102-bad-kind', repeat('d', 64),
                'fixture:x', '', 'QUEUED', 'tester', 'v1', 'UNKNOWN');
    EXCEPTION WHEN check_violation THEN
        v_rejected := TRUE;
    END;
    IF NOT v_rejected THEN
        RAISE EXCEPTION 'An unknown job_kind must be rejected';
    END IF;

    DELETE FROM ml_workspace.training_job
    WHERE job_id IN ('00000000-0000-4000-8000-000000001021', '00000000-0000-4000-8000-000000001022');
END;
$$;

SELECT 'PRED-102 job kinds, params, result_ref and algorithm rule are valid' AS result;
