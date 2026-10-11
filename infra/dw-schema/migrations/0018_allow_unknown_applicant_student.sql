-- A postulante puede no tener todavía un registro en academico.alumnos.
-- En FACT_ADMISION ese caso usa el miembro técnico UNKNOWN; si la identidad
-- existe pero no cubre el corte SCD2, la carga debe seguir fallando.
-- No alterar migraciones previas: el runner aplica este archivo transaccionalmente.

DO $$
BEGIN
    IF to_regprocedure('etl_control.stage_hop_fact_admission(uuid,bigint,jsonb)') IS NULL
       OR to_regprocedure('etl_control.resolve_hop_student_temporal_key(uuid,character varying,integer,timestamp with time zone)') IS NULL THEN
        RAISE EXCEPTION 'Las rutinas de preparación de FACT_ADMISION deben existir antes de 0018';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM dw.dim_estudiante
        WHERE estudiante_sk=-1 AND member_type='UNKNOWN'
    ) THEN
        RAISE EXCEPTION 'Falta el miembro UNKNOWN de dw.dim_estudiante requerido por 0018';
    END IF;
END;
$$;

SET ROLE dw_owner;

CREATE OR REPLACE FUNCTION etl_control.resolve_hop_admission_student_key(
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
    v_identity_exists BOOLEAN;
BEGIN
    SELECT * INTO STRICT v_run
    FROM etl_control.etl_execution
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
                   ELSE r.record_data->>'id_ra'=p_id_ra END
          AND (r.record_data->>'valid_from')::timestamptz <= p_effective_at
          AND ((r.record_data->>'valid_to') IS NULL OR (r.record_data->>'valid_to')::timestamptz > p_effective_at)
        UNION
        SELECT d.estudiante_sk
        FROM dw.dim_estudiante d
        WHERE d.member_type='STANDARD'
          AND CASE WHEN p_id_alumno IS NOT NULL THEN d.id_alumno=p_id_alumno ELSE d.id_ra=p_id_ra END
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

    IF v_count=1 THEN
        RETURN v_key;
    ELSIF v_count>1 THEN
        RAISE EXCEPTION 'Se esperaba una única versión SCD2 de estudiante para FACT_ADMISION en %; encontradas %',
            p_effective_at,v_count USING ERRCODE = '23514';
    END IF;

    -- Un candidato estándar fuera del intervalo temporal indica inconsistencia
    -- SCD2, no un postulante desconocido; no ocultar ese defecto con UNKNOWN.
    SELECT EXISTS (
        SELECT 1 FROM dw.dim_estudiante d
        WHERE d.member_type='STANDARD'
          AND CASE WHEN p_id_alumno IS NOT NULL THEN d.id_alumno=p_id_alumno ELSE d.id_ra=p_id_ra END
        UNION ALL
        SELECT 1 FROM etl_work.hop_publication_row r
        WHERE r.run_id=p_run_id AND r.target_code='DIM_ESTUDIANTE'
          AND r.record_data->>'member_type'='STANDARD'
          AND CASE WHEN p_id_alumno IS NOT NULL
                   THEN (r.record_data->>'id_alumno')::integer=p_id_alumno
                   ELSE r.record_data->>'id_ra'=p_id_ra END
    ) INTO v_identity_exists;
    IF v_identity_exists THEN
        RAISE EXCEPTION 'La identidad del estudiante existe, pero no tiene una versión SCD2 válida en %',
            p_effective_at USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM dw.dim_estudiante
        WHERE estudiante_sk=-1 AND member_type='UNKNOWN'
    ) THEN
        RAISE EXCEPTION 'No existe el miembro UNKNOWN de dw.dim_estudiante' USING ERRCODE = '23514';
    END IF;
    RETURN -1;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.stage_hop_fact_admission(
    p_run_id UUID,
    p_row_ordinal BIGINT,
    p_source_data JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control, etl_work, dw
AS $$
DECLARE
    v_run etl_control.etl_execution;
    v_closure etl_control.academic_period_closure;
    v_student_sk BIGINT;
    v_program_sk BIGINT;
    v_period_sk BIGINT;
    v_admission_sk BIGINT;
    v_id_alumno INTEGER;
    v_id_programa CHAR(3);
    v_gestion SMALLINT;
    v_periodo SMALLINT;
    v_id_acceso CHAR(2);
    v_estado CHAR(1);
    v_record JSONB;
BEGIN
    IF p_source_data IS NULL OR jsonb_typeof(p_source_data)<>'object' OR p_row_ordinal<1 THEN
        RAISE EXCEPTION 'Fila FACT_ADMISION incompleta' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO STRICT v_run FROM etl_control.etl_execution WHERE run_id=p_run_id FOR KEY SHARE;
    IF v_run.status<>'EN_EJECUCION' OR v_run.requested_by<>session_user
       OR v_run.execution_kind NOT IN ('CIERRE_ACADEMICO','REPROCESO') OR v_run.closure_id IS NULL THEN
        RAISE EXCEPTION 'FACT_ADMISION requiere un cierre/reproceso elegible solicitado por el actor' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO STRICT v_closure FROM etl_control.academic_period_closure WHERE closure_id=v_run.closure_id FOR KEY SHARE;
    IF v_closure.status<>'CERRADO' OR v_closure.effective_at>clock_timestamp() THEN
        RAISE EXCEPTION 'El cierre de FACT_ADMISION no está elegible' USING ERRCODE = '23514';
    END IF;

    v_id_alumno := nullif(p_source_data->>'id_alumno','')::integer;
    v_id_programa := nullif(btrim(p_source_data->>'id_programa'),'')::char(3);
    v_gestion := nullif(p_source_data->>'id_gestion','')::smallint;
    v_periodo := nullif(p_source_data->>'id_periodo','')::smallint;
    v_id_acceso := nullif(btrim(p_source_data->>'id_acceso'),'')::char(2);
    v_estado := nullif(btrim(p_source_data->>'estado'),'')::char(1);
    IF v_id_alumno IS NULL OR v_id_programa IS NULL
       OR (v_gestion IS NULL) <> (v_periodo IS NULL)
       OR (v_gestion IS NOT NULL AND (v_gestion<>v_closure.gestion OR v_periodo<>v_closure.periodo)) THEN
        RAISE EXCEPTION 'Postulación sin clave/grano válido para el cierre solicitado' USING ERRCODE = '23514';
    END IF;

    v_student_sk := etl_control.resolve_hop_admission_student_key(
        p_run_id,nullif(p_source_data->>'id_ra','')::varchar(10),v_id_alumno,v_closure.effective_at);
    v_program_sk := etl_control.resolve_hop_fact_dimension_key(p_run_id,'programa',v_id_programa::text);
    v_period_sk := CASE WHEN v_gestion IS NULL THEN
        etl_control.resolve_hop_fact_dimension_key(p_run_id,'periodo_academico',NULL)
        ELSE etl_control.resolve_hop_fact_dimension_key(p_run_id,'periodo_academico',v_gestion::text||'-'||v_periodo::text) END;
    v_admission_sk := etl_control.resolve_hop_fact_dimension_key(p_run_id,'admision',v_id_acceso::text);

    v_record := jsonb_build_object(
        'estudiante_sk',v_student_sk,'programa_sk',v_program_sk,
        'periodo_academico_sk',v_period_sk,'admision_sk',v_admission_sk,
        'id_alumno_origen',v_id_alumno,'id_programa_origen',v_id_programa,
        'id_gestion_origen',v_gestion,'id_periodo_origen',v_periodo,
        'conteo_postulacion',1,
        'es_admitido',CASE v_estado WHEN 'A' THEN TRUE WHEN 'P' THEN FALSE ELSE NULL END,
        'puntaje_examen',nullif(p_source_data->>'nota','')::integer,
        'estado_origen',v_estado
    );
    RETURN etl_control.stage_hop_publication_row(
        p_run_id,'FACT_ADMISION',p_row_ordinal,'INSERT',v_id_alumno::text,v_record);
END;
$$;

ALTER FUNCTION etl_control.resolve_hop_admission_student_key(UUID,VARCHAR,INTEGER,TIMESTAMPTZ) OWNER TO dw_owner;
ALTER FUNCTION etl_control.stage_hop_fact_admission(UUID,BIGINT,JSONB) OWNER TO dw_owner;

RESET ROLE;

REVOKE ALL ON FUNCTION etl_control.resolve_hop_admission_student_key(UUID,VARCHAR,INTEGER,TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION etl_control.stage_hop_fact_admission(UUID,BIGINT,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etl_control.stage_hop_fact_admission(UUID,BIGINT,JSONB) TO dw_hop_runtime;

COMMENT ON FUNCTION etl_control.resolve_hop_admission_student_key(UUID,VARCHAR,INTEGER,TIMESTAMPTZ) IS
    'FACT_ADMISION: resuelve una única versión SCD2 por id_alumno; usa UNKNOWN solo si no existe identidad académica, y falla ante discontinuidad temporal.';
