-- Req. 6.5: prepare FACT_ADMISION and FACT_CURSADO behind the private landing API.
-- Source rows are supplied by Hop; this migration does not connect to Jachasun.
BEGIN;

DO $$
BEGIN
    IF to_regclass('dw.fact_admision') IS NULL
       OR to_regclass('dw.fact_cursado') IS NULL
       OR to_regclass('etl_work.hop_publication_row') IS NULL
       OR to_regclass('etl_control.academic_period_closure') IS NULL
       OR to_regprocedure('etl_control.stage_hop_publication_row(uuid,character varying,bigint,character varying,text,jsonb)') IS NULL THEN
        RAISE EXCEPTION 'Las dimensiones, hechos y publisher privado deben existir antes de 0015';
    END IF;

    IF EXISTS (
        SELECT 1 FROM dw.fact_admision
        GROUP BY id_alumno_origen HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'No se puede fijar el grano de admision: hay id_alumno_origen duplicados existentes';
    END IF;
END;
$$;

-- The Jachasun DDL declares public.postulantes.id_alumno UNIQUE. Enforce the
-- same operational grain in the warehouse; existing history is checked above.
ALTER TABLE dw.fact_admision
    ADD CONSTRAINT uq_fact_admision_id_alumno_origen UNIQUE (id_alumno_origen);

SET ROLE dw_owner;

CREATE OR REPLACE FUNCTION etl_control.resolve_hop_fact_dimension_key(
    p_run_id UUID,
    p_dimension VARCHAR(32),
    p_natural_key TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control, etl_work, dw
AS $$
DECLARE
    v_target TEXT;
    v_key_column TEXT;
    v_unknown BIGINT;
    v_key BIGINT;
    v_count BIGINT;
BEGIN
    IF p_dimension NOT IN ('programa', 'materia', 'periodo_academico', 'admision') THEN
        RAISE EXCEPTION 'Dimensión no autorizada para preparar hechos' USING ERRCODE = '42501';
    END IF;

    IF p_natural_key IS NULL OR btrim(p_natural_key) = '' THEN
        v_target := CASE p_dimension
            WHEN 'programa' THEN 'DIM_PROGRAMA'
            WHEN 'materia' THEN 'DIM_MATERIA'
            WHEN 'periodo_academico' THEN 'DIM_PERIODO_ACADEMICO'
            WHEN 'admision' THEN 'DIM_ADMISION'
        END;
        v_key_column := CASE p_dimension
            WHEN 'programa' THEN 'programa_sk'
            WHEN 'materia' THEN 'materia_sk'
            WHEN 'periodo_academico' THEN 'periodo_academico_sk'
            WHEN 'admision' THEN 'admision_sk'
        END;
        EXECUTE format('SELECT %I FROM dw.%I WHERE member_type = %L',
            v_key_column,
            CASE p_dimension
                WHEN 'programa' THEN 'dim_programa'
                WHEN 'materia' THEN 'dim_materia'
                WHEN 'periodo_academico' THEN 'dim_periodo_academico'
                WHEN 'admision' THEN 'dim_admision'
            END,
            'UNKNOWN') INTO v_unknown;
        IF v_unknown IS NULL THEN
            RAISE EXCEPTION 'No existe miembro UNKNOWN para dimensión %', p_dimension USING ERRCODE = '23514';
        END IF;
        RETURN v_unknown;
    END IF;

    v_target := CASE p_dimension
        WHEN 'programa' THEN 'DIM_PROGRAMA'
        WHEN 'materia' THEN 'DIM_MATERIA'
        WHEN 'periodo_academico' THEN 'DIM_PERIODO_ACADEMICO'
        WHEN 'admision' THEN 'DIM_ADMISION'
    END;
    v_key_column := CASE p_dimension
        WHEN 'programa' THEN 'programa_sk'
        WHEN 'materia' THEN 'materia_sk'
        WHEN 'periodo_academico' THEN 'periodo_academico_sk'
        WHEN 'admision' THEN 'admision_sk'
    END;

    -- Prefer this run's prepared member so facts reference the same SK that
    -- the atomic publisher will insert/update from the sealed dimension batch.
    EXECUTE format(
        'SELECT count(*), min((record_data ->> %L)::bigint) FROM etl_work.hop_publication_row WHERE run_id=$1 AND target_code=$2 AND natural_key=$3 AND operation IN (''INSERT'',''UPSERT'')',
        v_key_column)
        INTO v_count, v_key USING p_run_id, v_target, p_natural_key;
    IF v_count > 1 THEN
        RAISE EXCEPTION 'Clave natural duplicada en dimensión preparada %', p_dimension USING ERRCODE = '23514';
    ELSIF v_count = 1 THEN
        RETURN v_key;
    END IF;

    CASE p_dimension
        WHEN 'programa' THEN SELECT programa_sk INTO v_key FROM dw.dim_programa WHERE member_type='STANDARD' AND id_programa=p_natural_key::char(3);
        WHEN 'materia' THEN SELECT materia_sk INTO v_key FROM dw.dim_materia WHERE member_type='STANDARD' AND id_materia=p_natural_key::integer;
        WHEN 'periodo_academico' THEN
            SELECT periodo_academico_sk INTO v_key FROM dw.dim_periodo_academico
            WHERE member_type='STANDARD'
              AND gestion=split_part(p_natural_key,'-',1)::smallint
              AND periodo=split_part(p_natural_key,'-',2)::smallint;
        WHEN 'admision' THEN SELECT admision_sk INTO v_key FROM dw.dim_admision WHERE member_type='STANDARD' AND id_acceso=p_natural_key::char(2);
    END CASE;
    IF v_key IS NULL THEN
        RAISE EXCEPTION 'La clave natural % de dimensión % no existe ni fue preparada en este run',
            p_natural_key, p_dimension USING ERRCODE = '23514';
    END IF;
    RETURN v_key;
END;
$$;

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
          AND (p_id_ra IS NULL OR r.record_data->>'id_ra'=p_id_ra)
          AND (p_id_alumno IS NULL OR (r.record_data->>'id_alumno')::integer=p_id_alumno)
          AND (r.record_data->>'valid_from')::timestamptz <= p_effective_at
          AND ((r.record_data->>'valid_to') IS NULL OR (r.record_data->>'valid_to')::timestamptz > p_effective_at)
        UNION
        SELECT d.estudiante_sk
        FROM dw.dim_estudiante d
        WHERE d.member_type='STANDARD'
          AND (p_id_ra IS NULL OR d.id_ra=p_id_ra)
          AND (p_id_alumno IS NULL OR d.id_alumno=p_id_alumno)
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
        RAISE EXCEPTION 'Se esperaba una única versión SCD2 para id_ra/id_alumno en %; encontradas %',
            p_effective_at,v_count USING ERRCODE = '23514';
    END IF;
    RETURN v_key;
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

    v_student_sk := etl_control.resolve_hop_student_temporal_key(
        p_run_id, nullif(p_source_data->>'id_ra','')::varchar(10), v_id_alumno, v_closure.effective_at);
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

CREATE OR REPLACE FUNCTION etl_control.stage_hop_fact_coursework(
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
    v_subject_sk BIGINT;
    v_period_sk BIGINT;
    v_id_matricula INTEGER;
    v_id_alumno INTEGER;
    v_id_programa CHAR(3);
    v_id_materia INTEGER;
    v_gestion SMALLINT;
    v_periodo SMALLINT;
    v_state TEXT;
    v_record JSONB;
    v_field TEXT;
    v_grade NUMERIC;
BEGIN
    IF p_source_data IS NULL OR jsonb_typeof(p_source_data)<>'object' OR p_row_ordinal<1 THEN
        RAISE EXCEPTION 'Fila FACT_CURSADO incompleta' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO STRICT v_run FROM etl_control.etl_execution WHERE run_id=p_run_id FOR KEY SHARE;
    IF v_run.status<>'EN_EJECUCION' OR v_run.requested_by<>session_user
       OR v_run.execution_kind NOT IN ('CIERRE_ACADEMICO','REPROCESO') OR v_run.closure_id IS NULL THEN
        RAISE EXCEPTION 'FACT_CURSADO requiere un cierre/reproceso elegible solicitado por el actor' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO STRICT v_closure FROM etl_control.academic_period_closure WHERE closure_id=v_run.closure_id FOR KEY SHARE;
    IF v_closure.status<>'CERRADO' OR v_closure.effective_at>clock_timestamp() THEN
        RAISE EXCEPTION 'El cierre de FACT_CURSADO no está elegible' USING ERRCODE = '23514';
    END IF;

    v_id_matricula := nullif(p_source_data->>'id_matricula','')::integer;
    v_id_alumno := nullif(p_source_data->>'id_alumno','')::integer;
    v_id_programa := nullif(btrim(p_source_data->>'id_programa'),'')::char(3);
    v_id_materia := nullif(p_source_data->>'id_materia','')::integer;
    v_gestion := nullif(p_source_data->>'id_gestion','')::smallint;
    v_periodo := nullif(p_source_data->>'id_periodo','')::smallint;
    v_state := nullif(p_source_data->>'estado','');
    IF v_id_matricula IS NULL OR v_id_alumno IS NULL OR v_id_programa IS NULL
       OR v_id_materia IS NULL OR v_state IS NULL
       OR v_gestion IS DISTINCT FROM v_closure.gestion OR v_periodo IS DISTINCT FROM v_closure.periodo THEN
        RAISE EXCEPTION 'Intento de cursado sin clave/grano válido para el cierre solicitado' USING ERRCODE = '23514';
    END IF;

    FOREACH v_field IN ARRAY ARRAY['nota','nota_2da','nota_ex_mesa','pparcial','sparcial','tparcial','cparcial'] LOOP
        IF nullif(p_source_data->>v_field,'') IS NOT NULL THEN
            v_grade := (p_source_data->>v_field)::numeric;
            IF v_grade<0 OR v_grade>100 THEN
                RAISE EXCEPTION 'Nota fuera del rango aprobado [0,100]; fila FACT_CURSADO bloqueada' USING ERRCODE = '23514';
            END IF;
        END IF;
    END LOOP;

    v_student_sk := etl_control.resolve_hop_student_temporal_key(
        p_run_id,nullif(p_source_data->>'id_ra','')::varchar(10),v_id_alumno,v_closure.effective_at);
    v_program_sk := etl_control.resolve_hop_fact_dimension_key(p_run_id,'programa',v_id_programa::text);
    v_subject_sk := etl_control.resolve_hop_fact_dimension_key(p_run_id,'materia',v_id_materia::text);
    v_period_sk := etl_control.resolve_hop_fact_dimension_key(p_run_id,'periodo_academico',v_gestion::text||'-'||v_periodo::text);
    v_record := jsonb_build_object(
        'estudiante_sk',v_student_sk,'programa_sk',v_program_sk,
        'materia_sk',v_subject_sk,'periodo_academico_sk',v_period_sk,
        'id_matricula_origen',v_id_matricula,
        'grupo_degenerado',nullif(p_source_data->>'grupo','')::smallint,
        'nota_final',nullif(p_source_data->>'nota','')::numeric,
        'nota_complementaria',nullif(p_source_data->>'nota_2da','')::numeric,
        'nota_examen_mesa',nullif(p_source_data->>'nota_ex_mesa','')::numeric,
        'nota_parcial_1',nullif(p_source_data->>'pparcial','')::numeric,
        'nota_parcial_2',nullif(p_source_data->>'sparcial','')::numeric,
        'nota_parcial_3',nullif(p_source_data->>'tparcial','')::numeric,
        'nota_parcial_4',nullif(p_source_data->>'cparcial','')::numeric,
        'estado_origen',v_state,
        -- Jachasun's DDL has no approved domain/meaning for coursework estado.
        -- Keep the raw code; business flags remain unknown, never inferred.
        'es_aprobado',NULL,'es_reprobado',NULL,'es_abandono',NULL,'es_repeticion',NULL,
        'conteo_intento',1
    );
    RETURN etl_control.stage_hop_publication_row(
        p_run_id,'FACT_CURSADO',p_row_ordinal,'INSERT',v_id_matricula::text,v_record);
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.complete_hop_fact_batch(
    p_run_id UUID,
    p_expected_rows BIGINT,
    p_target_code VARCHAR(40),
    p_step_code VARCHAR(100),
    p_pipeline_path TEXT,
    p_component_version VARCHAR(255)
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control, etl_work
AS $$
DECLARE
    v_count BIGINT;
BEGIN
    IF p_target_code NOT IN ('FACT_ADMISION','FACT_CURSADO')
       OR btrim(coalesce(p_step_code,''))=''
       OR btrim(coalesce(p_pipeline_path,''))=''
       OR btrim(coalesce(p_component_version,''))='' THEN
        RAISE EXCEPTION 'Declaración de lote/transformación de hecho inválida' USING ERRCODE = '23514';
    END IF;
    SELECT count(*) INTO v_count FROM etl_work.hop_publication_row
    WHERE run_id=p_run_id AND target_code=p_target_code;
    IF p_expected_rows IS NULL OR p_expected_rows <> v_count THEN
        RAISE EXCEPTION 'Conteo de filas de hecho no coincide con las filas privadas: esperado %, actual %',
            p_expected_rows, v_count USING ERRCODE = '23514';
    END IF;
    PERFORM etl_control.seal_hop_publication_batch(p_run_id,p_target_code,v_count);
    PERFORM etl_control.record_etl_execution_metric(
        p_run_id,lower(p_target_code)||'_prepared_rows',v_count::numeric,'ROWS',NULL,
        jsonb_build_object('target_code',p_target_code,'published',false));
    PERFORM etl_control.register_etl_execution_step(
        p_run_id,p_step_code,'TRANSFORMACION'::varchar(20),'EXITOSO'::varchar(16),
        (CASE p_target_code WHEN 'FACT_ADMISION' THEN 30 ELSE 40 END)::smallint,
        p_pipeline_path,p_component_version,
        jsonb_build_object('target_code',p_target_code,'prepared_rows',v_count,'published',false));
    RETURN v_count;
END;
$$;

ALTER FUNCTION etl_control.resolve_hop_fact_dimension_key(UUID,VARCHAR,TEXT) OWNER TO dw_owner;
ALTER FUNCTION etl_control.resolve_hop_student_temporal_key(UUID,VARCHAR,INTEGER,TIMESTAMPTZ) OWNER TO dw_owner;
ALTER FUNCTION etl_control.stage_hop_fact_admission(UUID,BIGINT,JSONB) OWNER TO dw_owner;
ALTER FUNCTION etl_control.stage_hop_fact_coursework(UUID,BIGINT,JSONB) OWNER TO dw_owner;
ALTER FUNCTION etl_control.complete_hop_fact_batch(UUID,BIGINT,VARCHAR,VARCHAR,TEXT,VARCHAR) OWNER TO dw_owner;

RESET ROLE;

REVOKE ALL ON FUNCTION etl_control.resolve_hop_fact_dimension_key(UUID,VARCHAR,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION etl_control.resolve_hop_student_temporal_key(UUID,VARCHAR,INTEGER,TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION etl_control.stage_hop_fact_admission(UUID,BIGINT,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION etl_control.stage_hop_fact_coursework(UUID,BIGINT,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION etl_control.complete_hop_fact_batch(UUID,BIGINT,VARCHAR,VARCHAR,TEXT,VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etl_control.stage_hop_fact_admission(UUID,BIGINT,JSONB) TO dw_hop_runtime;
GRANT EXECUTE ON FUNCTION etl_control.stage_hop_fact_coursework(UUID,BIGINT,JSONB) TO dw_hop_runtime;
GRANT EXECUTE ON FUNCTION etl_control.complete_hop_fact_batch(UUID,BIGINT,VARCHAR,VARCHAR,TEXT,VARCHAR) TO dw_hop_runtime;

COMMENT ON FUNCTION etl_control.resolve_hop_fact_dimension_key(UUID,VARCHAR,TEXT) IS
    'Resuelve la clave desde staging privado del run o dimensión publicada; valores ausentes usan el miembro UNKNOWN y referencias válidas sin dimensión bloquean.';
COMMENT ON FUNCTION etl_control.resolve_hop_student_temporal_key(UUID,VARCHAR,INTEGER,TIMESTAMPTZ) IS
    'Resuelve exactamente una versión estándar SCD2 vigente a la fecha efectiva del evento, considerando INSERT/CLOSE privados del run.';
COMMENT ON FUNCTION etl_control.stage_hop_fact_admission(UUID,BIGINT,JSONB) IS
    'Prepara una fila FACT_ADMISION por public.postulantes.id_alumno; interpreta estado A/P según comentario estático del DDL y conserva otros códigos como desconocidos.';
COMMENT ON FUNCTION etl_control.stage_hop_fact_coursework(UUID,BIGINT,JSONB) IS
    'Prepara una fila FACT_CURSADO por notas_planilla.id_matricula; conserva estado crudo y no deriva flags sin dominio aprobado.';

COMMIT;
