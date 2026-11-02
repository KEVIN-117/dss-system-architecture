-- 0029: use the expected academic successor for each synthetic period cadence.
-- Periods 1/2 are semester closures; period 3 is the annual closure.
DO $$
BEGIN
    IF to_regprocedure('etl_control.prepare_hop_fact_retention(uuid)') IS NULL
       OR to_regclass('etl_control.academic_period_closure') IS NULL
       OR to_regclass('dw.fact_cursado') IS NULL THEN
        RAISE EXCEPTION '0029 requires the current retention preparation and closure schema';
    END IF;
END;
$$;

SET ROLE dw_owner;
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
    v_next_gestion SMALLINT;
    v_next_periodo SMALLINT;
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

    -- Cadence contract: periods 1 and 2 are semesters; period 3 is annual.
    -- Choose the expected successor by the source period key, not only by
    -- effective_at (semester 2 and annual period 3 may close on the same date).
    IF v_closure.periodo = 1 THEN
        v_next_gestion := v_closure.gestion;
        v_next_periodo := 2;
    ELSIF v_closure.periodo = 2 THEN
        v_next_gestion := v_closure.gestion + 1;
        v_next_periodo := 1;
    ELSIF v_closure.periodo = 3 THEN
        v_next_gestion := v_closure.gestion + 1;
        v_next_periodo := 3;
    END IF;

    IF v_next_gestion IS NOT NULL THEN
        SELECT count(*)::integer INTO v_next_candidates
        FROM etl_control.academic_period_closure c
        WHERE c.gestion = v_next_gestion
          AND c.periodo = v_next_periodo
          AND c.status IN ('CERRADO', 'PROCESADO', 'REABIERTO');

        SELECT * INTO v_next
        FROM etl_control.academic_period_closure c
        WHERE c.gestion = v_next_gestion
          AND c.periodo = v_next_periodo
          AND c.status IN ('CERRADO', 'PROCESADO', 'REABIERTO')
        ORDER BY c.closure_id
        LIMIT 1;

        IF FOUND THEN
            v_next_processed := v_next_candidates = 1
                AND v_next.status = 'PROCESADO'
                AND v_next.processed_run_id IS NOT NULL;
        END IF;
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


ALTER FUNCTION etl_control.prepare_hop_fact_retention(UUID) OWNER TO dw_owner;
RESET ROLE;
REVOKE ALL ON FUNCTION etl_control.prepare_hop_fact_retention(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etl_control.prepare_hop_fact_retention(UUID) TO dw_hop_runtime;
COMMENT ON FUNCTION etl_control.prepare_hop_fact_retention(UUID) IS
    'Prepares observed retention labels using the next processed closure for the same academic cadence: 1→2, 2→next-year 1, annual 3→next-year 3.';