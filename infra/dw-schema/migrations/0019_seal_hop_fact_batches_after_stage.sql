-- Seal fact batches only after the Hop staging pipeline has completed.
-- A separate workflow action is an execution/commit boundary: the staging
-- pipeline's JDBC writes are committed before these routines count rows.

SET ROLE dw_owner;

CREATE OR REPLACE FUNCTION etl_control.seal_hop_fact_admission_batch(
    p_run_id UUID
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control, etl_work
AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT count(*) INTO v_count
    FROM etl_work.hop_publication_row
    WHERE run_id = p_run_id AND target_code = 'FACT_ADMISION';

    RETURN etl_control.complete_hop_fact_batch(
        p_run_id, v_count, 'FACT_ADMISION'::varchar(40),
        'fact_admision'::varchar(100),
        'pipelines/facts/pl_fact_admision_mvp.hpl'::text,
        'hop-mvp-fact-admision-v1'::varchar(255)
    );
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.seal_hop_fact_coursework_batch(
    p_run_id UUID
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control, etl_work
AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT count(*) INTO v_count
    FROM etl_work.hop_publication_row
    WHERE run_id = p_run_id AND target_code = 'FACT_CURSADO';

    RETURN etl_control.complete_hop_fact_batch(
        p_run_id, v_count, 'FACT_CURSADO'::varchar(40),
        'fact_cursado'::varchar(100),
        'pipelines/facts/pl_fact_cursado_mvp.hpl'::text,
        'hop-mvp-fact-cursado-v1'::varchar(255)
    );
END;
$$;

ALTER FUNCTION etl_control.seal_hop_fact_admission_batch(UUID) OWNER TO dw_owner;
ALTER FUNCTION etl_control.seal_hop_fact_coursework_batch(UUID) OWNER TO dw_owner;

RESET ROLE;

REVOKE ALL ON FUNCTION etl_control.seal_hop_fact_admission_batch(UUID),
    etl_control.seal_hop_fact_coursework_batch(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etl_control.seal_hop_fact_admission_batch(UUID),
    etl_control.seal_hop_fact_coursework_batch(UUID) TO dw_hop_runtime;

COMMENT ON FUNCTION etl_control.seal_hop_fact_admission_batch(UUID) IS
    'Cuenta y sella FACT_ADMISION después de que el pipeline de staging haya terminado y confirmado sus escrituras.';
COMMENT ON FUNCTION etl_control.seal_hop_fact_coursework_batch(UUID) IS
    'Cuenta y sella FACT_CURSADO después de que el pipeline de staging haya terminado y confirmado sus escrituras.';
