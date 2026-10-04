-- DW-MVP-004: audited, token-fenced failure exit for the atomic publication API.
DO $$
BEGIN
    IF to_regprocedure('etl_control.publish_hop_staged_run(uuid,uuid,text)') IS NULL
       OR to_regprocedure('etl_control.fail_etl_execution(uuid,character varying,text)') IS NULL THEN
        RAISE EXCEPTION 'La migración 0011 y el control de ejecución deben estar aplicados';
    END IF;
END;
$$;

SET ROLE dw_owner;

CREATE OR REPLACE FUNCTION etl_control.abort_hop_publication(
    p_run_id UUID,
    p_lock_token UUID,
    p_reason TEXT
)
RETURNS etl_control.etl_execution
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control, etl_work
AS $$
DECLARE
    v_run etl_control.etl_execution;
    v_lock etl_control.etl_execution_lock;
    v_step etl_control.etl_execution_step;
    v_result etl_control.etl_execution;
BEGIN
    IF btrim(coalesce(p_reason, '')) = '' THEN
        RAISE EXCEPTION 'El aborto de publicación requiere motivo' USING ERRCODE = '23514';
    END IF;

    SELECT * INTO STRICT v_run FROM etl_control.etl_execution
    WHERE run_id = p_run_id FOR UPDATE;
    IF v_run.status NOT IN ('EN_EJECUCION', 'PUBLICANDO') THEN
        RAISE EXCEPTION 'Solo una ejecución activa puede abortar su publicación'
            USING ERRCODE = '23514';
    END IF;

    -- Match the fencing token even if its lease expired: an expired owner may
    -- clean up its own failed attempt, but can never publish with that token.
    IF p_lock_token IS NULL THEN
        IF EXISTS (SELECT 1 FROM etl_control.etl_execution_lock
                   WHERE run_id = p_run_id AND resource_key = 'dw:mvp-publication'
                     AND released_at IS NULL) THEN
            RAISE EXCEPTION 'Se requiere el fencing token para liberar el lease activo'
                USING ERRCODE = '55P03';
        END IF;
    ELSE
        SELECT * INTO STRICT v_lock FROM etl_control.etl_execution_lock
        WHERE run_id = p_run_id AND resource_key = 'dw:mvp-publication'
          AND lock_token = p_lock_token AND released_at IS NULL
        FOR UPDATE;

        UPDATE etl_control.etl_execution_lock
        SET released_by = session_user, released_at = clock_timestamp(),
            release_reason = left(p_reason, 1000)
        WHERE lock_id = v_lock.lock_id;
    END IF;

    -- Failed attempts do not retain staging PII. The prior committed DW is
    -- independent of this run-scoped landing and is never touched here.
    DELETE FROM etl_work.hop_publication_row WHERE run_id = p_run_id;

    v_step := etl_control.register_etl_execution_step(
        p_run_id, 'atomic_dw_publish'::varchar(100), 'PUBLICACION'::varchar(20),
        'FALLIDO'::varchar(16), 90::smallint,
        'etl_control.publish_hop_staged_run'::text, 'dw-mvp-atomic-publisher-1'::varchar(255),
        jsonb_build_object('published', false, 'reason', left(p_reason, 500))
    );
    PERFORM etl_control.record_etl_execution_error(
        p_run_id, 'ERROR'::varchar(12), 'HOP_PUBLICATION_ABORTED'::varchar(100),
        left(p_reason, 1000), 'La transacción de publicación se revirtió; el intento previo sigue publicado',
        TRUE, v_step.step_id, jsonb_build_object('publication_committed', false)
    );
    v_result := etl_control.fail_etl_execution(
        p_run_id, session_user::varchar(255), left(p_reason, 1000)
    );
    RETURN v_result;
END;
$$;

ALTER FUNCTION etl_control.abort_hop_publication(UUID, UUID, TEXT) OWNER TO dw_owner;
RESET ROLE;

REVOKE ALL ON FUNCTION etl_control.abort_hop_publication(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etl_control.abort_hop_publication(UUID, UUID, TEXT) TO dw_hop_runtime;
COMMENT ON FUNCTION etl_control.abort_hop_publication(UUID, UUID, TEXT) IS
    'Releases only the caller run’s matching fencing lease (or requires no active lease), deletes run-scoped prepared payloads, records a sanitized failure, and marks the run failed atomically without altering the previously committed DW publication.';
