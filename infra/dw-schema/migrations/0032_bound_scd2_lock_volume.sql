-- 0032: bound advisory-lock usage in historical SCD2 publication batches.
-- 0030 is immutable after deployment; this migration upgrades its function body.
DO $$
BEGIN
    IF to_regprocedure('etl_control.prepare_hop_student_scd2(uuid,jsonb)') IS NULL THEN
        RAISE EXCEPTION '0032 requires etl_control.prepare_hop_student_scd2(uuid,jsonb)';
    END IF;
END;
$$;

SET ROLE dw_owner;
DO $$
DECLARE
    v_definition TEXT;
    v_old_lock_block CONSTANT TEXT := $old_lock$
    -- The run lock serializes row ordinals for this snapshot; the second lock
    -- protects concurrent attempts to version the same academic student.
    FOR v_lock_key IN
        SELECT lock_key
        FROM unnest(ARRAY[
            'DW-HOP-RUN:' || p_run_id::TEXT,
            v_identity_key
        ]) AS lock_keys(lock_key)
        ORDER BY lock_key
    LOOP
        PERFORM pg_advisory_xact_lock(
            hashtextextended('dw.dim_estudiante.scd2:' || v_lock_key, 0)
        );
    END LOOP;
$old_lock$;
    v_bounded_lock_block CONSTANT TEXT := $bounded_lock$
    -- Serialize the publication batch with one transaction-scoped lock. A
    -- per-student lock here accumulates one lock entry per row until the ETL
    -- transaction commits and exhausts PostgreSQL shared lock memory on
    -- historical snapshots. The same global lock is used by the SCD2 trigger.
    PERFORM pg_advisory_xact_lock(
        hashtextextended('dw.dim_estudiante.scd2:GLOBAL', 0)
    );
$bounded_lock$;
BEGIN
    v_definition := pg_get_functiondef(
        'etl_control.prepare_hop_student_scd2(uuid,jsonb)'::REGPROCEDURE
    );

    IF position(v_bounded_lock_block IN v_definition) > 0 THEN
        RAISE NOTICE 'SCD2 bounded advisory lock is already installed';
        RETURN;
    END IF;
    IF position(v_old_lock_block IN v_definition) = 0 THEN
        RAISE EXCEPTION '0032 found an unknown SCD2 lock implementation; refusing to rewrite it';
    END IF;
    IF length(v_definition) - length(replace(v_definition, v_old_lock_block, ''))
       <> length(v_old_lock_block) THEN
        RAISE EXCEPTION '0032 expected exactly one legacy SCD2 lock block';
    END IF;

    v_definition := replace(v_definition, v_old_lock_block, v_bounded_lock_block);
    EXECUTE v_definition;

    v_definition := pg_get_functiondef(
        'etl_control.prepare_hop_student_scd2(uuid,jsonb)'::REGPROCEDURE
    );
    IF position(v_bounded_lock_block IN v_definition) = 0 THEN
        RAISE EXCEPTION '0032 could not verify the bounded SCD2 lock after replacement';
    END IF;
END;
$$;
RESET ROLE;

COMMENT ON FUNCTION etl_control.prepare_hop_student_scd2(UUID, JSONB) IS
    'Prepares SCD2 transitions only for students enrolled by the authorized closure cutoff; id_alumno remains identity. Uses one bounded transaction-scoped advisory lock per batch.';
