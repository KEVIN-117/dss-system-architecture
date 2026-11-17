-- 0046: ppa_acumulado and materias_arrastradas for FACT_RETENCION_DESERCION.
--
-- Both columns were always NULL because the institutional formulas were
-- pending (docs/dw/source-contracts/informe-investigacion-reglas-dw.md 5.5).
-- MVP rules adopted by the project owner, consistent with 0044:
--   * effective grade and outcome: etl_control.coursework_pass_outcome()
--     (GREATEST(nota, nota_2da, nota_ex_mesa); >= 51 passed, > 0 failed,
--     0 / no grade unknown);
--   * ppa_acumulado: simple mean of the effective grade of every attempt with a
--     known outcome (passed or failed) of the student (id_alumno) in the program
--     in processed closures up to and including the cut. Not credit-weighted:
--     only 130 of 7,647 subjects carry credits in Jachasun;
--   * materias_arrastradas: distinct subjects (id_materia) the student failed in
--     some attempt up to the cut and has not passed in any attempt up to the cut,
--     in the same program;
--   * both stay NULL when the student has no attempt with a known outcome.
-- Values only depend on coursework at or before the cut, so they are computed
-- once when the closure is published (inside mature_hop_retention_labels, in the
-- publication transaction) and are point-in-time by construction.

DO $$
BEGIN
    IF to_regprocedure('etl_control.coursework_pass_outcome(numeric,numeric,numeric)') IS NULL
       OR to_regprocedure('etl_control.relabel_hop_retention_closures(bigint[])') IS NULL
       OR to_regprocedure('etl_control.mature_hop_retention_labels(uuid)') IS NULL THEN
        RAISE EXCEPTION '0046 requires 0044 (pass outcome) and 0045 (regime cadence)';
    END IF;
END;
$$;

SET ROLE dw_owner;

CREATE OR REPLACE FUNCTION etl_control.refresh_hop_retention_performance(
    p_closure_ids BIGINT[]
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control, dw
SET work_mem = '256MB'
AS $$
DECLARE
    v_updated BIGINT;
BEGIN
    IF p_closure_ids IS NULL OR cardinality(p_closure_ids) = 0 THEN
        RETURN 0;
    END IF;

    WITH target_rows AS MATERIALIZED (
        SELECT f.fact_retencion_desercion_id AS id, f.programa_sk, e.id_alumno, c.effective_at
        FROM dw.fact_retencion_desercion f
        JOIN etl_control.academic_period_closure c ON c.closure_id = f.closure_id
        JOIN dw.dim_estudiante e ON e.estudiante_sk = f.estudiante_sk AND e.member_type = 'STANDARD'
        WHERE f.closure_id = ANY (p_closure_ids)
          AND c.status = 'PROCESADO'
    ), history AS MATERIALIZED (
        -- Every evaluated attempt of the target students, read once; the
        -- point-in-time bound is applied by the hash join below (independent
        -- of closure statistics, which made a per-closure nested loop explode).
        SELECT he.id_alumno, fc.programa_sk, hc.effective_at, m.id_materia,
               etl_control.coursework_pass_outcome(fc.nota_final, fc.nota_complementaria, fc.nota_examen_mesa) AS passed,
               GREATEST(fc.nota_final, fc.nota_complementaria, fc.nota_examen_mesa) AS grade
        FROM dw.dim_estudiante he
        JOIN dw.fact_cursado fc ON fc.estudiante_sk = he.estudiante_sk
        JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk = fc.periodo_academico_sk
        JOIN etl_control.academic_period_closure hc ON hc.closure_id = pa.closure_id
          AND hc.status = 'PROCESADO'
        JOIN dw.dim_materia m ON m.materia_sk = fc.materia_sk AND m.member_type = 'STANDARD'
        WHERE he.member_type = 'STANDARD'
          AND he.id_alumno IN (SELECT DISTINCT id_alumno FROM target_rows)
    ), attempts AS MATERIALIZED (
        SELECT t.id, h.id_materia, h.passed, h.grade
        FROM target_rows t
        JOIN history h ON h.id_alumno = t.id_alumno AND h.programa_sk = t.programa_sk
                      AND h.effective_at <= t.effective_at
    ), per_subject AS (
        SELECT id, id_materia, bool_or(passed) AS any_pass, bool_or(NOT passed) AS any_fail
        FROM attempts
        WHERE passed IS NOT NULL
        GROUP BY id, id_materia
    ), carried AS (
        SELECT id, count(*) FILTER (WHERE any_fail AND NOT any_pass)::integer AS carried
        FROM per_subject
        GROUP BY id
    ), performance AS (
        SELECT a.id, round(avg(a.grade) FILTER (WHERE a.passed IS NOT NULL), 2) AS ppa
        FROM attempts a
        GROUP BY a.id
    ), computed AS (
        -- per_subject only holds known outcomes: no row there means no evidence.
        SELECT t.id,
               CASE WHEN cr.id IS NOT NULL THEN p.ppa END AS ppa,
               cr.carried
        FROM target_rows t
        LEFT JOIN carried cr ON cr.id = t.id
        LEFT JOIN performance p ON p.id = t.id
    )
    UPDATE dw.fact_retencion_desercion f
    SET ppa_acumulado = c.ppa,
        materias_arrastradas = c.carried
    FROM computed c
    WHERE f.fact_retencion_desercion_id = c.id
      AND (f.ppa_acumulado IS DISTINCT FROM c.ppa OR f.materias_arrastradas IS DISTINCT FROM c.carried);
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION etl_control.refresh_hop_retention_performance(BIGINT[]) IS
    '0046: computes ppa_acumulado and materias_arrastradas (point in time) for published retention rows of the given PROCESADO closures; returns changed rows. Owner-only.';

-- Maturation also fills the performance attributes of the closure just published.
-- The return value is still the number of relabelled predecessor rows.
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
    v_predecessors BIGINT[];
    v_relabelled BIGINT;
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

    -- 0046: point-in-time performance of the closure just published.
    PERFORM etl_control.refresh_hop_retention_performance(ARRAY[v_closure.closure_id]);

    SELECT array_agg(c.closure_id ORDER BY c.closure_id) INTO v_predecessors
    FROM etl_control.academic_period_closure c
    WHERE c.status = 'PROCESADO'
      AND c.closure_id <> v_closure.closure_id
      AND (
          -- period 1 succeeds the previous-year period 2 (semester) and period 1 (annual)
          (v_closure.periodo = 1 AND c.gestion = v_closure.gestion - 1 AND c.periodo IN (1, 2))
          -- period 2 succeeds the same-year period 1 (semester)
       OR (v_closure.periodo = 2 AND c.gestion = v_closure.gestion AND c.periodo = 1)
          -- period 3 succeeds the previous-year period 3 (0029)
       OR (v_closure.periodo = 3 AND c.gestion = v_closure.gestion - 1 AND c.periodo = 3)
      );
    v_relabelled := etl_control.relabel_hop_retention_closures(v_predecessors);
    RETURN v_relabelled;
END;
$$;

ALTER FUNCTION etl_control.refresh_hop_retention_performance(BIGINT[]) OWNER TO dw_owner;

COMMENT ON COLUMN dw.fact_retencion_desercion.ppa_acumulado IS
    '0046: mean effective grade (coursework_pass_outcome rule) of attempts with known outcome in the program up to the cut; NULL without evidence.';
COMMENT ON COLUMN dw.fact_retencion_desercion.materias_arrastradas IS
    '0046: distinct subjects failed and not yet passed in the program up to the cut; NULL without evidence.';

-- Backfill already published closures (deterministic from DW data).
SELECT etl_control.refresh_hop_retention_performance(ARRAY(
    SELECT closure_id FROM etl_control.academic_period_closure WHERE status = 'PROCESADO'));

RESET ROLE;

REVOKE ALL ON FUNCTION etl_control.refresh_hop_retention_performance(BIGINT[]) FROM PUBLIC;
