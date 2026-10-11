-- Resolve the student surrogate key for FACT_ADMISION using the operational
-- id_alumno. Jachasun's applicant id_ra is not guaranteed to match the
-- optional id_ra in academico.alumnos; id_alumno is the approved identity.
-- Keep temporal uniqueness strict and preserve id_ra as a fallback only when
-- no id_alumno is supplied by a caller. The migration runner wraps this file
-- and its history record in one transaction.

DO $$
BEGIN
    IF to_regprocedure('etl_control.resolve_hop_student_temporal_key(uuid,character varying,integer,timestamp with time zone)') IS NULL THEN
        RAISE EXCEPTION 'La resolución SCD2 de estudiantes debe existir antes de 0017';
    END IF;
END;
$$;

SET ROLE dw_owner;

CREATE OR REPLACE FUNCTION etl_control.resolve_hop_student_temporal_key(
    p_run_id UUID,
    p_id_ra VARCHAR(10),
    p_id_alumno INTEGER,
    p_effective_at TIMESTAMPTZ
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control, etl_work, dw
AS $$
DECLARE
    v_run etl_control.etl_execution;
    v_count BIGINT;
    v_key BIGINT;
BEGIN
    SELECT * INTO STRICT v_run FROM etl_control.etl_execution
    WHERE run_id=p_run_id FOR KEY SHARE;
    IF v_run.status <> 'EN_EJECUCION' OR v_run.requested_by <> session_user THEN
        RAISE EXCEPTION 'Solo el solicitante puede resolver claves para su run activo' USING ERRCODE = '42501';
    END IF;
    IF p_id_ra IS NULL AND p_id_alumno IS NULL THEN
        RETURN -1;
    END IF;
    IF p_effective_at IS NULL THEN
        RAISE EXCEPTION 'La fecha efectiva es obligatoria para resolver la versión SCD2' USING ERRCODE = '23514';
    END IF;

    WITH candidates AS (
        SELECT (r.record_data->>'estudiante_sk')::bigint AS sk
        FROM etl_work.hop_publication_row r
        WHERE r.run_id=p_run_id AND r.target_code='DIM_ESTUDIANTE'
          AND r.operation='INSERT'
          AND r.record_data->>'member_type'='STANDARD'
          AND CASE WHEN p_id_alumno IS NOT NULL
                   THEN (r.record_data->>'id_alumno')::integer=p_id_alumno
                   ELSE p_id_ra IS NULL OR r.record_data->>'id_ra'=p_id_ra END
          AND (r.record_data->>'valid_from')::timestamptz <= p_effective_at
          AND ((r.record_data->>'valid_to') IS NULL OR (r.record_data->>'valid_to')::timestamptz > p_effective_at)
        UNION
        SELECT d.estudiante_sk
        FROM dw.dim_estudiante d
        WHERE d.member_type='STANDARD'
          AND CASE WHEN p_id_alumno IS NOT NULL
                   THEN d.id_alumno=p_id_alumno
                   ELSE p_id_ra IS NULL OR d.id_ra=p_id_ra END
          AND d.valid_from <= p_effective_at
          AND (d.valid_to IS NULL OR d.valid_to > p_effective_at)
          AND NOT EXISTS (
              SELECT 1 FROM etl_work.hop_publication_row c
              WHERE c.run_id=p_run_id AND c.target_code='DIM_ESTUDIANTE'
                AND c.operation='CLOSE'
                AND (c.record_data->>'estudiante_sk')::bigint=d.estudiante_sk
                AND (c.record_data->>'valid_to')::timestamptz <= p_effective_at
          )
    )
    SELECT count(*), min(sk) INTO v_count,v_key FROM candidates;
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Se esperaba una única versión SCD2 para id_alumno/id_ra en %; encontradas %',
            p_effective_at,v_count USING ERRCODE = '23514';
    END IF;
    RETURN v_key;
END;
$$;

RESET ROLE;

REVOKE ALL ON FUNCTION etl_control.resolve_hop_student_temporal_key(UUID,VARCHAR,INTEGER,TIMESTAMPTZ) FROM PUBLIC;
COMMENT ON FUNCTION etl_control.resolve_hop_student_temporal_key(UUID,VARCHAR,INTEGER,TIMESTAMPTZ) IS
    'Resuelve exactamente una versión SCD2 vigente al corte; id_alumno es la identidad canónica cuando está disponible, id_ra solo es fallback.';
