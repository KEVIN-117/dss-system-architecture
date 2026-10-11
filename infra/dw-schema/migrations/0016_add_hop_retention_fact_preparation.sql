-- Req. 6.6: derive the retention snapshot from prepared coursework and the
-- next successfully published DSA closure. Earlier migrations are immutable.

DO $$
BEGIN
    IF to_regclass('etl_control.etl_execution') IS NULL
       OR to_regclass('etl_control.academic_period_closure') IS NULL
       OR to_regclass('etl_work.hop_publication_row') IS NULL
       OR to_regclass('dw.fact_retencion_desercion') IS NULL
       OR to_regclass('dw.fact_cursado') IS NULL THEN
        RAISE EXCEPTION 'DW-004, DW-006, DW-009 y DW-011/015 deben aplicarse antes de 0016';
    END IF;
END;
$$;

SET ROLE dw_owner;

CREATE OR REPLACE FUNCTION etl_control.classify_hop_retention(
    p_next_closure_processed BOOLEAN,
    p_has_next_coursework BOOLEAN,
    p_partial_count BIGINT,
    p_has_egress_evidence BOOLEAN
)
RETURNS VARCHAR(20)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog
AS $$
BEGIN
    IF p_next_closure_processed IS DISTINCT FROM TRUE
       OR p_has_egress_evidence IS DISTINCT FROM FALSE
       OR p_partial_count IS NULL OR p_partial_count < 0 THEN
        RETURN 'NO_EVALUABLE';
    END IF;
    IF p_has_next_coursework IS TRUE THEN
        RETURN 'RETENIDO';
    END IF;
    IF p_partial_count < 2 THEN
        RETURN 'DESERTOR';
    END IF;
    RETURN 'NO_EVALUABLE';
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.prepare_hop_fact_retention(
    p_run_id UUID
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control, etl_work, dw
AS $$
DECLARE
    v_run etl_control.etl_execution;
    v_closure etl_control.academic_period_closure;
    v_next etl_control.academic_period_closure;
    v_next_processed BOOLEAN := FALSE;
    v_next_candidates INTEGER := 0;
    v_prepared BIGINT := 0;
    v_row RECORD;
    v_result VARCHAR(20);
BEGIN
    SELECT * INTO STRICT v_run
    FROM etl_control.etl_execution
    WHERE run_id = p_run_id
    FOR KEY SHARE;

    IF v_run.status <> 'EN_EJECUCION'
       OR v_run.requested_by <> session_user
       OR v_run.execution_kind NOT IN ('CIERRE_ACADEMICO', 'REPROCESO')
       OR v_run.closure_id IS NULL THEN
        RAISE EXCEPTION 'FACT_RETENCION_DESERCION requiere cierre/reproceso activo del solicitante'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO STRICT v_closure
    FROM etl_control.academic_period_closure
    WHERE closure_id = v_run.closure_id
    FOR KEY SHARE;

    IF v_closure.status <> 'CERRADO' OR v_closure.effective_at > clock_timestamp() THEN
        RAISE EXCEPTION 'El cierre de FACT_RETENCION_DESERCION no es elegible'
            USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM etl_work.hop_publication_batch b
        WHERE b.run_id = p_run_id AND b.target_code = 'FACT_CURSADO'
          AND b.sealed_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'FACT_RETENCION_DESERCION requiere el lote FACT_CURSADO sellado'
            USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
        SELECT 1 FROM etl_work.hop_publication_row r
        WHERE r.run_id = p_run_id AND r.target_code = 'FACT_RETENCION_DESERCION'
    ) OR EXISTS (
        SELECT 1 FROM etl_work.hop_publication_batch b
        WHERE b.run_id = p_run_id AND b.target_code = 'FACT_RETENCION_DESERCION'
    ) THEN
        RAISE EXCEPTION 'El lote de retención ya fue preparado para este run_id'
            USING ERRCODE = '23514';
    END IF;

    -- Select the next authorized closure by effective time, never by period
    -- arithmetic. A reopened closure blocks classification, and tied effective
    -- times are ambiguous, so neither is used as continuity evidence.
    SELECT count(*)::integer INTO v_next_candidates
    FROM etl_control.academic_period_closure c
    WHERE c.effective_at = (
        SELECT min(c2.effective_at)
        FROM etl_control.academic_period_closure c2
        WHERE c2.effective_at > v_closure.effective_at
          AND c2.status IN ('CERRADO', 'PROCESADO', 'REABIERTO')
    )
      AND c.status IN ('CERRADO', 'PROCESADO', 'REABIERTO');
    SELECT * INTO v_next
    FROM etl_control.academic_period_closure c
    WHERE c.effective_at > v_closure.effective_at
      AND c.status IN ('CERRADO', 'PROCESADO', 'REABIERTO')
    ORDER BY c.effective_at, c.closure_id
    LIMIT 1;
    IF FOUND THEN
        v_next_processed := v_next_candidates = 1 AND v_next.status = 'PROCESADO'
            AND v_next.processed_run_id IS NOT NULL;
    END IF;

    FOR v_row IN
        WITH student_keys AS (
            SELECT
                (r.record_data->>'estudiante_sk')::bigint AS estudiante_sk,
                nullif(r.record_data->>'id_alumno', '')::integer AS id_alumno,
                nullif(r.record_data->>'fec_egreso', '')::date AS fec_egreso
            FROM etl_work.hop_publication_row r
            WHERE r.run_id = p_run_id AND r.target_code = 'DIM_ESTUDIANTE'
              AND r.operation = 'INSERT'

            UNION ALL

            SELECT d.estudiante_sk, d.id_alumno, d.fec_egreso
            FROM dw.dim_estudiante d
            WHERE d.member_type = 'STANDARD'
              AND NOT EXISTS (
                  SELECT 1 FROM etl_work.hop_publication_row r
                  WHERE r.run_id = p_run_id AND r.target_code = 'DIM_ESTUDIANTE'
                    AND r.operation = 'INSERT'
                    AND (r.record_data->>'estudiante_sk')::bigint = d.estudiante_sk
              )
        ), subject_attempts AS (
            SELECT
                (r.record_data->>'estudiante_sk')::bigint AS estudiante_sk,
                (r.record_data->>'programa_sk')::bigint AS programa_sk,
                (r.record_data->>'periodo_academico_sk')::bigint AS periodo_academico_sk,
                (r.record_data->>'materia_sk')::bigint AS materia_sk,
                max(GREATEST(
                    nullif(r.record_data->>'nota_final', '')::numeric,
                    nullif(r.record_data->>'nota_complementaria', '')::numeric
                )) AS mejor_nota,
                sum(
                    (CASE WHEN nullif(r.record_data->>'nota_parcial_1', '')::numeric <> 0 THEN 1 ELSE 0 END)
                  + (CASE WHEN nullif(r.record_data->>'nota_parcial_2', '')::numeric <> 0 THEN 1 ELSE 0 END)
                  + (CASE WHEN nullif(r.record_data->>'nota_parcial_3', '')::numeric <> 0 THEN 1 ELSE 0 END)
                  + (CASE WHEN nullif(r.record_data->>'nota_parcial_4', '')::numeric <> 0 THEN 1 ELSE 0 END)
                )::bigint AS parciales_rendidos
            FROM etl_work.hop_publication_row r
            WHERE r.run_id = p_run_id AND r.target_code = 'FACT_CURSADO'
            GROUP BY 1, 2, 3, 4
        ), student_period AS (
            SELECT
                a.estudiante_sk,
                a.programa_sk,
                a.periodo_academico_sk,
                k.id_alumno,
                k.fec_egreso,
                count(*)::integer AS materias_cursadas,
                count(*) FILTER (WHERE a.mejor_nota > 50)::integer AS materias_aprobadas,
                count(*) FILTER (WHERE a.mejor_nota > 0 AND a.mejor_nota <= 50)::integer AS materias_reprobadas,
                sum(a.parciales_rendidos)::bigint AS parciales_rendidos
            FROM subject_attempts a
            JOIN student_keys k USING (estudiante_sk)
            GROUP BY a.estudiante_sk, a.programa_sk, a.periodo_academico_sk,
                     k.id_alumno, k.fec_egreso
        )
        SELECT
            s.*,
            CASE WHEN v_next_processed THEN EXISTS (
                SELECT 1
                FROM dw.fact_cursado next_f
                JOIN dw.dim_periodo_academico next_period
                  ON next_period.periodo_academico_sk = next_f.periodo_academico_sk
                JOIN dw.dim_estudiante next_student
                  ON next_student.estudiante_sk = next_f.estudiante_sk
                WHERE next_period.closure_id = v_next.closure_id
                  AND next_student.member_type = 'STANDARD'
                  AND next_student.id_alumno = s.id_alumno
                  AND next_f.programa_sk = s.programa_sk
            ) ELSE FALSE END AS has_next_coursework,
            (s.fec_egreso IS NOT NULL AND s.fec_egreso <= v_closure.effective_at::date)
                AS has_egress_evidence
        FROM student_period s
        ORDER BY s.id_alumno, s.programa_sk, s.periodo_academico_sk
    LOOP
        v_result := etl_control.classify_hop_retention(
            v_next_processed,
            v_row.has_next_coursework,
            v_row.parciales_rendidos,
            v_row.has_egress_evidence
        );

        PERFORM etl_control.stage_hop_publication_row(
            p_run_id,
            'FACT_RETENCION_DESERCION',
            v_prepared + 1,
            'INSERT',
            format('RET:%s:%s:%s', v_row.estudiante_sk, v_row.programa_sk, v_row.periodo_academico_sk),
            jsonb_build_object(
                'estudiante_sk', v_row.estudiante_sk,
                'programa_sk', v_row.programa_sk,
                'periodo_academico_sk', v_row.periodo_academico_sk,
                'closure_id', v_run.closure_id,
                'materias_cursadas', v_row.materias_cursadas,
                'materias_aprobadas', v_row.materias_aprobadas,
                'materias_reprobadas', v_row.materias_reprobadas,
                'materias_arrastradas', NULL,
                'ppa_acumulado', NULL,
                'resultado_retencion', v_result,
                'es_desercion', CASE WHEN v_result = 'NO_EVALUABLE' THEN NULL ELSE v_result = 'DESERTOR' END,
                'conteo_snapshot', 1,
                'conteo_evaluable', CASE WHEN v_result = 'NO_EVALUABLE' THEN 0 ELSE 1 END,
                'conteo_desercion', CASE WHEN v_result = 'DESERTOR' THEN 1 ELSE 0 END,
                'run_id', p_run_id
            )
        );
        v_prepared := v_prepared + 1;
    END LOOP;

    RETURN v_prepared;
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
    v_order SMALLINT;
BEGIN
    IF p_target_code NOT IN ('FACT_ADMISION', 'FACT_CURSADO', 'FACT_RETENCION_DESERCION')
       OR btrim(coalesce(p_step_code, '')) = ''
       OR btrim(coalesce(p_pipeline_path, '')) = ''
       OR btrim(coalesce(p_component_version, '')) = '' THEN
        RAISE EXCEPTION 'Declaración de lote/transformación de hecho inválida' USING ERRCODE = '23514';
    END IF;

    SELECT count(*) INTO v_count
    FROM etl_work.hop_publication_row
    WHERE run_id = p_run_id AND target_code = p_target_code;
    IF p_expected_rows IS NULL OR p_expected_rows <> v_count THEN
        RAISE EXCEPTION 'Conteo de filas de hecho no coincide con las filas privadas: esperado %, actual %',
            p_expected_rows, v_count USING ERRCODE = '23514';
    END IF;

    PERFORM etl_control.seal_hop_publication_batch(p_run_id, p_target_code, v_count);
    PERFORM etl_control.record_etl_execution_metric(
        p_run_id, lower(p_target_code) || '_prepared_rows', v_count::numeric, 'ROWS', NULL,
        jsonb_build_object('target_code', p_target_code, 'published', false)
    );
    v_order := CASE p_target_code
        WHEN 'FACT_ADMISION' THEN 30
        WHEN 'FACT_CURSADO' THEN 40
        ELSE 50
    END;
    PERFORM etl_control.register_etl_execution_step(
        p_run_id, p_step_code, 'TRANSFORMACION'::varchar(20), 'EXITOSO'::varchar(16),
        v_order, p_pipeline_path, p_component_version,
        jsonb_build_object('target_code', p_target_code, 'prepared_rows', v_count, 'published', false)
    );
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.mark_hop_run_staging_ready(
    p_run_id UUID
)
RETURNS etl_control.etl_execution_step
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control, etl_work
AS $$
DECLARE
    v_run etl_control.etl_execution;
    v_targets TEXT[] := ARRAY[
        'DIM_ESTUDIANTE', 'DIM_PROGRAMA', 'DIM_MATERIA', 'DIM_PERIODO_ACADEMICO',
        'DIM_ADMISION', 'FACT_ADMISION', 'FACT_CURSADO', 'FACT_RETENCION_DESERCION'
    ];
    v_target TEXT;
    v_step etl_control.etl_execution_step;
BEGIN
    SELECT * INTO STRICT v_run FROM etl_control.etl_execution
    WHERE run_id = p_run_id FOR KEY SHARE;
    IF v_run.status <> 'EN_EJECUCION' OR v_run.requested_by <> session_user THEN
        RAISE EXCEPTION 'Solo el solicitante puede validar sus lotes durante EN_EJECUCION'
            USING ERRCODE = '42501';
    END IF;

    PERFORM etl_control.assert_hop_source_manifests(p_run_id);
    IF (SELECT count(*) FROM etl_control.etl_source_manifest
        WHERE run_id = p_run_id AND status = 'COMPLETO') <> 9 THEN
        RAISE EXCEPTION 'La preparación requiere nueve manifiestos completos' USING ERRCODE = '23514';
    END IF;
    IF (SELECT count(*) FROM etl_work.hop_publication_batch b
        WHERE b.run_id = p_run_id AND b.sealed_at IS NOT NULL
          AND b.target_code = ANY(v_targets)) <> cardinality(v_targets) THEN
        RAISE EXCEPTION 'La preparación requiere ocho lotes sellados' USING ERRCODE = '23514';
    END IF;
    IF (SELECT count(*) FROM etl_work.hop_publication_batch
        WHERE run_id = p_run_id) <> cardinality(v_targets) THEN
        RAISE EXCEPTION 'La preparación no admite lotes adicionales o no reconocidos'
            USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
        SELECT 1 FROM etl_work.hop_publication_batch b
        WHERE b.run_id = p_run_id AND b.target_code = ANY(v_targets)
          AND (b.expected_rows <> (
                SELECT count(*) FROM etl_work.hop_publication_row r
                WHERE r.run_id = b.run_id AND r.target_code = b.target_code
              ) OR b.batch_sha256 IS DISTINCT FROM
                etl_work.hop_publication_batch_sha256(b.run_id, b.target_code))
    ) OR EXISTS (
        SELECT 1 FROM etl_control.etl_execution_error e
        WHERE e.run_id = p_run_id AND e.is_blocking
    ) OR EXISTS (
        SELECT 1 FROM etl_control.etl_execution_step s
        WHERE s.run_id = p_run_id AND s.phase <> 'PUBLICACION'
          AND s.status NOT IN ('EXITOSO', 'OMITIDO')
    ) THEN
        RAISE EXCEPTION 'La validación de staging detectó un error, lote alterado o paso incompleto'
            USING ERRCODE = '23514';
    END IF;

    v_step := etl_control.register_etl_execution_step(
        p_run_id,
        'mvp_staging_gate'::varchar(100),
        'VALIDACION'::varchar(20),
        'EXITOSO'::varchar(16),
        99::smallint,
        'workflows/wf_vertical_uatf_datos_smoke.hwf'::text,
        'hop-mvp-staging-gate-v1'::varchar(255),
        jsonb_build_object(
            'required_source_manifests', 9,
            'complete_source_manifests', 9,
            'required_dimension_and_fact_batches', cardinality(v_targets),
            'sealed_dimension_and_fact_batches', cardinality(v_targets),
            'publishable', true,
            'published', false
        )
    );
    RETURN v_step;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.prepare_and_complete_hop_fact_retention(
    p_run_id UUID
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_count BIGINT;
BEGIN
    -- Preparation and sealing must share one PostgreSQL transaction. Hop can
    -- otherwise start its downstream transform before the upstream commit is
    -- visible on a separate JDBC connection.
    v_count := etl_control.prepare_hop_fact_retention(p_run_id);
    PERFORM etl_control.complete_hop_fact_batch(
        p_run_id, v_count, 'FACT_RETENCION_DESERCION'::varchar(40),
        'fact_retencion_desercion'::varchar(100),
        'pipelines/facts/pl_fact_retencion_desercion_mvp.hpl'::text,
        'hop-mvp-fact-retencion-v1'::varchar(255)
    );
    RETURN v_count;
END;
$$;

ALTER FUNCTION etl_control.classify_hop_retention(BOOLEAN, BOOLEAN, BIGINT, BOOLEAN) OWNER TO dw_owner;
ALTER FUNCTION etl_control.prepare_hop_fact_retention(UUID) OWNER TO dw_owner;
ALTER FUNCTION etl_control.complete_hop_fact_batch(UUID, BIGINT, VARCHAR, VARCHAR, TEXT, VARCHAR) OWNER TO dw_owner;
ALTER FUNCTION etl_control.mark_hop_run_staging_ready(UUID) OWNER TO dw_owner;
ALTER FUNCTION etl_control.prepare_and_complete_hop_fact_retention(UUID) OWNER TO dw_owner;

RESET ROLE;

REVOKE ALL ON FUNCTION etl_control.classify_hop_retention(BOOLEAN, BOOLEAN, BIGINT, BOOLEAN),
    etl_control.prepare_hop_fact_retention(UUID),
    etl_control.complete_hop_fact_batch(UUID, BIGINT, VARCHAR, VARCHAR, TEXT, VARCHAR),
    etl_control.mark_hop_run_staging_ready(UUID),
    etl_control.prepare_and_complete_hop_fact_retention(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etl_control.classify_hop_retention(BOOLEAN, BOOLEAN, BIGINT, BOOLEAN),
    etl_control.prepare_hop_fact_retention(UUID),
    etl_control.complete_hop_fact_batch(UUID, BIGINT, VARCHAR, VARCHAR, TEXT, VARCHAR),
    etl_control.mark_hop_run_staging_ready(UUID),
    etl_control.prepare_and_complete_hop_fact_retention(UUID) TO dw_hop_runtime;

COMMENT ON FUNCTION etl_control.classify_hop_retention(BOOLEAN, BOOLEAN, BIGINT, BOOLEAN) IS
    'Deserción: menos de dos parciales rendidos y ausencia de cursado en el siguiente cierre procesado. Retención: cursado en el siguiente cierre DSA procesado. Sin evidencia posterior o con egreso conocido, NO_EVALUABLE.';
COMMENT ON FUNCTION etl_control.prepare_hop_fact_retention(UUID) IS
    'Deriva snapshots por estudiante/programa/periodo desde FACT_CURSADO privado, consulta continuidad en el siguiente cierre procesado y escribe solo mediante la API de staging.';
COMMENT ON FUNCTION etl_control.mark_hop_run_staging_ready(UUID) IS
    'Valida nueve manifiestos, ocho lotes sellados e inmutables, pasos exitosos y ausencia de errores bloqueantes; no publica ni cambia el estado de ejecución.';
COMMENT ON FUNCTION etl_control.prepare_and_complete_hop_fact_retention(UUID) IS
    'Prepara y sella FACT_RETENCION_DESERCION en una única transacción para evitar una carrera de visibilidad entre transforms Hop.';
