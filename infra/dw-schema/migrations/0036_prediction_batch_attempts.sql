-- PRED-011: fence population scoring attempts.
-- A worker whose lease expired must not publish or fail a batch that a newer
-- attempt has already reclaimed, and poison batches stop after a bounded
-- number of attempts instead of being redelivered forever.
DO $$
BEGIN
    IF to_regclass('ml_workspace.prediction_batch') IS NULL THEN
        RAISE EXCEPTION 'PRED-011 requires the PRED-007 prediction_batch table';
    END IF;
END;
$$;

SET ROLE dw_owner;
ALTER TABLE ml_workspace.prediction_batch
    ADD COLUMN attempt INTEGER NOT NULL DEFAULT 0 CHECK (attempt >= 0);
COMMENT ON COLUMN ml_workspace.prediction_batch.attempt IS
    'Claim counter used as a fencing token; terminal updates require the current attempt.';
RESET ROLE;
