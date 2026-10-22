-- Bound SCD2 advisory-lock cardinality to one lock key per transaction.
-- Migration 0021 correctly changed student identity to id_alumno, but its
-- per-student transaction locks accumulated for the full Hop batch and could
-- exhaust PostgreSQL's shared lock table on historical loads.
DO $$
DECLARE
    v_definition TEXT;
    v_updated_definition TEXT;
    v_old_lock_block TEXT;
    v_new_lock_block TEXT;
BEGIN
    IF to_regprocedure('etl_control.prepare_hop_student_scd2(uuid,jsonb)') IS NULL
       OR to_regprocedure('dw.prevent_dim_estudiante_scd2_overlap()') IS NULL THEN
        RAISE EXCEPTION '0021_student_scd2_identity_is_id_alumno.sql must be applied before 0022';
    END IF;

    v_old_lock_block := $old$
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
$old$;

    v_new_lock_block := $new$
    -- One transaction-scoped lock serializes the SCD2 batch without retaining
    -- a distinct shared-memory advisory lock for every student in the batch.
    PERFORM pg_advisory_xact_lock(
        hashtextextended('dw.dim_estudiante.scd2:GLOBAL', 0)
    );
$new$;

    v_definition := pg_get_functiondef(
        'etl_control.prepare_hop_student_scd2(uuid,jsonb)'::REGPROCEDURE
    );
    IF position(v_old_lock_block IN v_definition) = 0 THEN
        RAISE EXCEPTION 'Unexpected 0021 SCD2 preparation lock block; refusing unsafe rewrite';
    END IF;
    v_updated_definition := replace(v_definition, v_old_lock_block, v_new_lock_block);
    IF position(v_old_lock_block IN v_updated_definition) > 0
       OR position('dw.dim_estudiante.scd2:GLOBAL' IN v_updated_definition) = 0 THEN
        RAISE EXCEPTION 'Could not safely replace SCD2 preparation locks';
    END IF;
    EXECUTE v_updated_definition;

    v_old_lock_block := $old$
    PERFORM pg_advisory_xact_lock(
        hashtextextended('dw.dim_estudiante.scd2:ALUMNO:' || NEW.id_alumno::TEXT, 0)
    );
$old$;
    v_new_lock_block := $new$
    -- Publication uses the same bounded lock namespace as preparation.
    PERFORM pg_advisory_xact_lock(
        hashtextextended('dw.dim_estudiante.scd2:GLOBAL', 0)
    );
$new$;

    v_definition := pg_get_functiondef(
        'dw.prevent_dim_estudiante_scd2_overlap()'::REGPROCEDURE
    );
    IF position(v_old_lock_block IN v_definition) = 0 THEN
        RAISE EXCEPTION 'Unexpected 0021 SCD2 trigger lock block; refusing unsafe rewrite';
    END IF;
    v_updated_definition := replace(v_definition, v_old_lock_block, v_new_lock_block);
    IF position(v_old_lock_block IN v_updated_definition) > 0
       OR position('dw.dim_estudiante.scd2:GLOBAL' IN v_updated_definition) = 0 THEN
        RAISE EXCEPTION 'Could not safely replace SCD2 trigger locks';
    END IF;
    EXECUTE v_updated_definition;
END;
$$;

COMMENT ON FUNCTION etl_control.prepare_hop_student_scd2(UUID, JSONB) IS
    'Prepara transiciones SCD2 por id_alumno; un advisory lock global por transacción serializa el lote y acota su consumo de memoria.';
COMMENT ON FUNCTION dw.prevent_dim_estudiante_scd2_overlap() IS
    'Rechaza vigencias SCD2 solapadas y serializa publicación estudiantil con un único advisory lock global por transacción.';
