-- DW-011: enforce the natural key used by the resumable uatf_datos snapshot.
-- Existing duplicate source keys are rejected by the extractor before a manifest
-- can be marked complete; this index also protects the Staging sink from bugs.

DO $$
BEGIN
    IF to_regclass('etl_control.schema_migration') IS NULL
       OR to_regclass('staging.raw_uatf_datos') IS NULL THEN
        RAISE EXCEPTION 'DW-003, DW-004 and DW-009 must be applied before DW-011';
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_raw_uatf_datos_run_id_ra
    ON staging.raw_uatf_datos (run_id, id_ra)
    WHERE id_ra IS NOT NULL;

COMMENT ON INDEX staging.uq_raw_uatf_datos_run_id_ra IS
    'DW-011 idempotency guard for the contract natural key within one snapshot run.';
