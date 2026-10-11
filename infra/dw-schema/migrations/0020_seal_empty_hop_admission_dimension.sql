-- DIM_ADMISION may legitimately have no source members for a snapshot.
-- Seal it from a separate workflow action so an empty source still creates
-- the required zero-row batch (and the validation gate remains strict).

SET ROLE dw_owner;

CREATE OR REPLACE FUNCTION etl_control.seal_hop_admission_dimension_batch(
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
    WHERE run_id = p_run_id AND target_code = 'DIM_ADMISION';

    PERFORM etl_control.seal_hop_publication_batch(
        p_run_id, 'DIM_ADMISION'::varchar(40), v_count
    );
    PERFORM etl_control.record_etl_execution_metric(
        p_run_id, 'dim_admision_prepared_rows', v_count::numeric, 'ROWS', NULL,
        jsonb_build_object('target_code', 'DIM_ADMISION', 'published', false)
    );
    PERFORM etl_control.register_etl_execution_step(
        p_run_id, 'dimension_admision'::varchar(100),
        'TRANSFORMACION'::varchar(20), 'EXITOSO'::varchar(16), 23::smallint,
        'pipelines/dimensions/pl_dim_admision_mvp.hpl'::text,
        'hop-mvp-dimension-v1'::varchar(255),
        jsonb_build_object(
            'target_code', 'DIM_ADMISION',
            'prepared_rows', v_count,
            'published', false
        )
    );
    RETURN v_count;
END;
$$;

ALTER FUNCTION etl_control.seal_hop_admission_dimension_batch(UUID) OWNER TO dw_owner;

RESET ROLE;

REVOKE ALL ON FUNCTION etl_control.seal_hop_admission_dimension_batch(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etl_control.seal_hop_admission_dimension_batch(UUID) TO dw_hop_runtime;

COMMENT ON FUNCTION etl_control.seal_hop_admission_dimension_batch(UUID) IS
    'Sella DIM_ADMISION desde las filas ya confirmadas, incluso cuando el snapshot no contiene miembros.';
