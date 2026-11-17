-- 0037: index the SCD2 overlap guard of dw.dim_estudiante.
--
-- trg_dim_estudiante_scd2_no_overlap runs, for every inserted or re-keyed
-- STANDARD version, an EXISTS over all versions of the same id_alumno with an
-- intersecting validity interval. The existing indexes only cover the current
-- version (uq_dim_estudiante_id_alumno_current) or identity_key, so the guard
-- scanned the whole dimension per row. Publishing a real Jachasun snapshot
-- (~10^5 students) became quadratic and was cancelled by the publication
-- lease. This partial index matches the guard predicate exactly.
DO $$
BEGIN
    IF to_regclass('dw.dim_estudiante') IS NULL
       OR to_regprocedure('dw.prevent_dim_estudiante_scd2_overlap()') IS NULL THEN
        RAISE EXCEPTION '0037 requires dw.dim_estudiante and its SCD2 overlap trigger';
    END IF;
END;
$$;

SET ROLE dw_owner;

CREATE INDEX IF NOT EXISTS idx_dim_estudiante_id_alumno_validity
    ON dw.dim_estudiante USING btree (id_alumno, valid_from, valid_to)
    WHERE member_type = 'STANDARD';

COMMENT ON INDEX dw.idx_dim_estudiante_id_alumno_validity IS
    'Supports dw.prevent_dim_estudiante_scd2_overlap(): all STANDARD versions of one id_alumno ordered by validity.';

RESET ROLE;

ANALYZE dw.dim_estudiante;
