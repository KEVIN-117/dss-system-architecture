-- 0040: trustworthy retention labels for historical training.
--
-- 1. Egress evidence. prepare_hop_fact_retention() marked a snapshot
--    NO_EVALUABLE when academico.alumnos.fec_egreso <= closure. Profiling
--    Jachasun showed fec_egreso is not university egress: 98.7% of students
--    have it, 53% before their enrolment, 27% equal to the school graduation
--    year and 40k active (estado P) students carry one. It discarded 98-99.9%
--    of every cut. Until DSA defines egress evidence, fec_egreso is not used.
--
-- 2. Label maturation. A cut's retention can only be observed once its
--    cadence successor is processed, but SCD2 forces cuts to be processed in
--    chronological order, so every cut was published NO_EVALUABLE.
--    mature_hop_retention_labels() runs in the publication transaction of a
--    successor and re-classifies the predecessor's published snapshot from
--    published facts: the predecessor's partial exams and the successor's
--    coursework. The rule is classify_hop_retention(), as in preparation.
--    It is deterministic and idempotent; a REPROCESO yields the same result.

DO $$
BEGIN
    IF to_regprocedure('etl_control.prepare_hop_fact_retention(uuid)') IS NULL
       OR to_regprocedure('etl_control.classify_hop_retention(boolean,boolean,bigint,boolean)') IS NULL
       OR to_regclass('dw.fact_retencion_desercion') IS NULL
       OR to_regclass('dw.fact_cursado') IS NULL THEN
        RAISE EXCEPTION '0040 requires the retention preparation API and fact constellation';
    END IF;
END;
$$;

SET ROLE dw_owner;

-- 1. Stop using alumnos.fec_egreso as egress evidence (0029 body is immutable;
--    upgrade the deployed function in place, as 0032 does).
DO $$
DECLARE
    v_definition TEXT;
    c_old CONSTANT TEXT := '(s.fec_egreso IS NOT NULL AND s.fec_egreso <= v_closure.effective_at::date)';
    c_new CONSTANT TEXT := 'FALSE /* 0040: alumnos.fec_egreso is not university egress evidence */';
BEGIN
    v_definition := pg_get_functiondef('etl_control.prepare_hop_fact_retention(uuid)'::REGPROCEDURE);
    IF position(c_new IN v_definition) > 0 THEN
        RAISE NOTICE '0040 egress rule is already installed';
        RETURN;
    END IF;
    IF length(v_definition) - length(replace(v_definition, c_old, '')) <> length(c_old) THEN
        RAISE EXCEPTION '0040 expected exactly one fec_egreso egress expression; refusing to rewrite';
    END IF;
    EXECUTE replace(v_definition, c_old, c_new);
END;
$$;

-- 2. Mature the predecessor's labels once its successor is published.
CREATE OR REPLACE FUNCTION etl_control.mature_hop_retention_labels(
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
    v_prev etl_control.academic_period_closure;
    v_prev_gestion SMALLINT;
    v_prev_periodo SMALLINT;
    v_candidates INTEGER;
    v_updated BIGINT;
BEGIN
    SELECT * INTO STRICT v_run FROM etl_control.etl_execution WHERE run_id = p_run_id FOR KEY SHARE;
    IF v_run.requested_by <> session_user THEN
        RAISE EXCEPTION 'Solo el solicitante puede madurar etiquetas de su ejecución' USING ERRCODE = '42501';
    END IF;
    IF v_run.closure_id IS NULL THEN
        RETURN 0;  -- global historical execution: no closure cadence
    END IF;
    IF v_run.status <> 'EXITOSA' THEN
        RAISE EXCEPTION 'La maduración de etiquetas requiere la publicación exitosa del sucesor' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO STRICT v_closure FROM etl_control.academic_period_closure
    WHERE closure_id = v_run.closure_id FOR KEY SHARE;
    IF v_closure.status <> 'PROCESADO' OR v_closure.processed_run_id IS DISTINCT FROM p_run_id THEN
        RAISE EXCEPTION 'El cierre sucesor no fue procesado por esta ejecución' USING ERRCODE = '23514';
    END IF;

    -- Inverse of the 0029 cadence: 1 <- previous-year 2, 2 <- same-year 1, 3 <- previous-year 3.
    IF v_closure.periodo = 1 THEN
        v_prev_gestion := v_closure.gestion - 1; v_prev_periodo := 2;
    ELSIF v_closure.periodo = 2 THEN
        v_prev_gestion := v_closure.gestion;     v_prev_periodo := 1;
    ELSIF v_closure.periodo = 3 THEN
        v_prev_gestion := v_closure.gestion - 1; v_prev_periodo := 3;
    ELSE
        RETURN 0;
    END IF;

    SELECT count(*)::integer INTO v_candidates
    FROM etl_control.academic_period_closure c
    WHERE c.gestion = v_prev_gestion AND c.periodo = v_prev_periodo
      AND c.status IN ('CERRADO', 'PROCESADO', 'REABIERTO');
    IF v_candidates <> 1 THEN
        RETURN 0;
    END IF;
    SELECT * INTO STRICT v_prev FROM etl_control.academic_period_closure c
    WHERE c.gestion = v_prev_gestion AND c.periodo = v_prev_periodo
      AND c.status IN ('CERRADO', 'PROCESADO', 'REABIERTO')
    FOR KEY SHARE;
    IF v_prev.status <> 'PROCESADO' THEN
        RETURN 0;  -- predecessor not published; its own processing will label it
    END IF;

    WITH prev_rows AS (
        SELECT f.fact_retencion_desercion_id AS id, f.estudiante_sk, f.programa_sk,
               f.periodo_academico_sk, e.id_alumno
        FROM dw.fact_retencion_desercion f
        JOIN dw.dim_estudiante e ON e.estudiante_sk = f.estudiante_sk
        WHERE f.closure_id = v_prev.closure_id
    ), partials AS (
        SELECT fc.estudiante_sk, fc.programa_sk, fc.periodo_academico_sk,
               sum((coalesce(fc.nota_parcial_1, 0) <> 0)::integer
                 + (coalesce(fc.nota_parcial_2, 0) <> 0)::integer
                 + (coalesce(fc.nota_parcial_3, 0) <> 0)::integer
                 + (coalesce(fc.nota_parcial_4, 0) <> 0)::integer)::bigint AS parciales
        FROM dw.fact_cursado fc
        JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk = fc.periodo_academico_sk
        WHERE pa.closure_id = v_prev.closure_id
        GROUP BY 1, 2, 3
    ), successor AS (
        SELECT DISTINCT e.id_alumno, fc.programa_sk
        FROM dw.fact_cursado fc
        JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk = fc.periodo_academico_sk
        JOIN dw.dim_estudiante e ON e.estudiante_sk = fc.estudiante_sk AND e.member_type = 'STANDARD'
        WHERE pa.closure_id = v_closure.closure_id
    ), classified AS (
        SELECT r.id,
               etl_control.classify_hop_retention(
                   TRUE, s.id_alumno IS NOT NULL, coalesce(pt.parciales, 0), FALSE
               )::varchar(20) AS result
        FROM prev_rows r
        LEFT JOIN partials pt USING (estudiante_sk, programa_sk, periodo_academico_sk)
        LEFT JOIN successor s ON s.id_alumno = r.id_alumno AND s.programa_sk = r.programa_sk
    )
    UPDATE dw.fact_retencion_desercion f
    SET resultado_retencion = c.result,
        es_desercion = CASE WHEN c.result = 'NO_EVALUABLE' THEN NULL ELSE c.result = 'DESERTOR' END,
        conteo_evaluable = CASE WHEN c.result = 'NO_EVALUABLE' THEN 0 ELSE 1 END,
        conteo_desercion = CASE WHEN c.result = 'DESERTOR' THEN 1 ELSE 0 END
    FROM classified c
    WHERE f.fact_retencion_desercion_id = c.id
      AND f.resultado_retencion IS DISTINCT FROM c.result;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated;
END;
$$;

ALTER FUNCTION etl_control.mature_hop_retention_labels(UUID) OWNER TO dw_owner;

RESET ROLE;

REVOKE ALL ON FUNCTION etl_control.mature_hop_retention_labels(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etl_control.mature_hop_retention_labels(UUID) TO dw_hop_runtime;

COMMENT ON FUNCTION etl_control.mature_hop_retention_labels(UUID) IS
    'After a successful closure publication, re-classifies the cadence predecessor''s published retention snapshot (classify_hop_retention, no fec_egreso evidence) using published coursework. Idempotent; returns updated rows.';
