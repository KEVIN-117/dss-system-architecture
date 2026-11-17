-- 0045: retention cadence follows the program regime (anual / semestral).
--
-- 0029/0040 chose the expected successor only from the closure period
-- (1 -> 2 same year, 2 -> 1 next year). In Jachasun the regime of a program is
-- academico.alm_programas.tipo, a FK to academico.carreras_tipos
-- ('A' Anual 40 semanas, 'S' Semestral 20 semanas). Annual programs (MED, DER,
-- ENF, ODO, ...) record their whole year in period 1 and never have a period 2,
-- so under the semester cadence they had no RETENIDO at all, ~80% NO_EVALUABLE
-- and false DESERTOR labels (students who simply continue next year).
--
-- Rules (period 3 keeps the 0029 cadence: next-year period 3):
--   regimen 'S', period 1 -> same-year period 2
--   regimen 'S', period 2 -> next-year period 1
--   regimen 'A', period 1 -> next-year period 1
--   regimen 'A', period 2 -> no successor (unexpected for an annual program):
--                            NO_EVALUABLE, never a guessed label
--   unknown regimen       -> no successor: NO_EVALUABLE
-- The regime is the current catalog value; DIM_PROGRAMA does not keep its
-- history (validated stable for 2015-2021 against observed coursework).
--
-- Changes:
--   * dw.dim_programa.regimen, published from Hop like the other attributes;
--   * etl_control.hop_retention_successor(): the single cadence rule;
--   * etl_control.relabel_hop_retention_closures(): recomputes the labels of
--     published retention rows of the given closures from scratch;
--   * prepare_hop_fact_retention() and mature_hop_retention_labels() use them.
-- Existing labels are NOT rewritten here: once regimen is populated run, as
-- the DW owner,
--     SELECT etl_control.relabel_hop_retention_closures(
--         ARRAY(SELECT closure_id FROM etl_control.academic_period_closure
--               WHERE status = 'PROCESADO'));

DO $$
BEGIN
    IF to_regclass('dw.dim_programa') IS NULL
       OR to_regclass('dw.fact_retencion_desercion') IS NULL
       OR to_regprocedure('etl_control.publish_hop_staged_run(uuid,uuid,text)') IS NULL
       OR to_regprocedure('etl_control.classify_hop_retention(boolean,boolean,bigint,boolean)') IS NULL
       OR to_regprocedure('etl_control.prepare_hop_fact_retention(uuid)') IS NULL
       OR to_regprocedure('etl_control.mature_hop_retention_labels(uuid)') IS NULL THEN
        RAISE EXCEPTION '0045 requires the 0040 retention functions and the atomic publisher';
    END IF;
END;
$$;

SET ROLE dw_owner;

ALTER TABLE dw.dim_programa
    ADD COLUMN IF NOT EXISTS regimen VARCHAR(1);
ALTER TABLE dw.dim_programa
    DROP CONSTRAINT IF EXISTS ck_dim_programa_regimen;
ALTER TABLE dw.dim_programa
    ADD CONSTRAINT ck_dim_programa_regimen CHECK (regimen IS NULL OR regimen IN ('A', 'S', 'P'));
COMMENT ON COLUMN dw.dim_programa.regimen IS
    'academico.alm_programas.tipo (academico.carreras_tipos): A Anual, S Semestral, P Programa. Current catalog value, not historized.';

-- Publisher: DIM_PROGRAMA upsert keeps regimen current.
DO $$
DECLARE
    v_definition TEXT;
    c_old CONSTANT TEXT := 'activo=EXCLUDED.activo, source_run_id=p_run_id';
    c_new CONSTANT TEXT := 'activo=EXCLUDED.activo, regimen=EXCLUDED.regimen /* 0045 */, source_run_id=p_run_id';
BEGIN
    v_definition := pg_get_functiondef('etl_control.publish_hop_staged_run(uuid,uuid,text)'::REGPROCEDURE);
    IF position('regimen=EXCLUDED.regimen' IN v_definition) = 0 THEN
        IF length(v_definition) - length(replace(v_definition, c_old, '')) <> length(c_old) THEN
            RAISE EXCEPTION '0045 expected exactly one DIM_PROGRAMA upsert list in publish_hop_staged_run';
        END IF;
        EXECUTE replace(v_definition, c_old, c_new);
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.hop_retention_successor(
    p_gestion SMALLINT,
    p_periodo SMALLINT,
    p_regimen VARCHAR
)
RETURNS TABLE (gestion SMALLINT, periodo SMALLINT)
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
    SELECT s.g::smallint, s.p::smallint
    FROM (SELECT CASE
                     WHEN p_periodo = 3 THEN p_gestion + 1
                     WHEN p_regimen = 'S' AND p_periodo = 1 THEN p_gestion
                     WHEN p_regimen = 'S' AND p_periodo = 2 THEN p_gestion + 1
                     WHEN p_regimen = 'A' AND p_periodo = 1 THEN p_gestion + 1
                 END AS g,
                 CASE
                     WHEN p_periodo = 3 THEN 3
                     WHEN p_regimen = 'S' AND p_periodo = 1 THEN 2
                     WHEN p_regimen = 'S' AND p_periodo = 2 THEN 1
                     WHEN p_regimen = 'A' AND p_periodo = 1 THEN 1
                 END AS p) s;
$$;

COMMENT ON FUNCTION etl_control.hop_retention_successor(SMALLINT,SMALLINT,VARCHAR) IS
    '0045: expected successor closure (gestion, periodo) for a retention row; NULLs when the regime gives no successor.';

-- Recompute published retention labels of the given closures.
CREATE OR REPLACE FUNCTION etl_control.relabel_hop_retention_closures(
    p_closure_ids BIGINT[]
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control, dw
AS $$
DECLARE
    v_updated BIGINT;
BEGIN
    IF p_closure_ids IS NULL OR cardinality(p_closure_ids) = 0 THEN
        RETURN 0;
    END IF;

    WITH target_rows AS MATERIALIZED (
        SELECT f.fact_retencion_desercion_id AS id, f.estudiante_sk, f.programa_sk,
               f.periodo_academico_sk, f.closure_id, e.id_alumno,
               c.gestion, c.periodo, p.regimen
        FROM dw.fact_retencion_desercion f
        JOIN etl_control.academic_period_closure c ON c.closure_id = f.closure_id
        JOIN dw.dim_estudiante e ON e.estudiante_sk = f.estudiante_sk
        JOIN dw.dim_programa p ON p.programa_sk = f.programa_sk
        WHERE f.closure_id = ANY (p_closure_ids)
          AND c.status = 'PROCESADO'
    ), cadence AS MATERIALIZED (
        SELECT DISTINCT t.gestion, t.periodo, t.regimen, s.gestion AS next_gestion, s.periodo AS next_periodo
        FROM target_rows t
        CROSS JOIN LATERAL etl_control.hop_retention_successor(t.gestion, t.periodo, t.regimen) s
    ), successor AS MATERIALIZED (
        SELECT cd.*,
               (SELECT count(*) FROM etl_control.academic_period_closure n
                WHERE n.gestion = cd.next_gestion AND n.periodo = cd.next_periodo
                  AND n.status IN ('CERRADO', 'PROCESADO', 'REABIERTO')) AS candidates,
               (SELECT n.closure_id FROM etl_control.academic_period_closure n
                WHERE n.gestion = cd.next_gestion AND n.periodo = cd.next_periodo
                  AND n.status = 'PROCESADO' AND n.processed_run_id IS NOT NULL
                ORDER BY n.closure_id LIMIT 1) AS processed_closure_id
        FROM cadence cd
    ), partials AS MATERIALIZED (
        SELECT fc.estudiante_sk, fc.programa_sk, fc.periodo_academico_sk,
               sum((coalesce(fc.nota_parcial_1, 0) <> 0)::integer
                 + (coalesce(fc.nota_parcial_2, 0) <> 0)::integer
                 + (coalesce(fc.nota_parcial_3, 0) <> 0)::integer
                 + (coalesce(fc.nota_parcial_4, 0) <> 0)::integer)::bigint AS parciales
        FROM dw.fact_cursado fc
        JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk = fc.periodo_academico_sk
        WHERE pa.closure_id = ANY (p_closure_ids)
        GROUP BY 1, 2, 3
    ), next_coursework AS MATERIALIZED (
        SELECT DISTINCT pa.closure_id, e.id_alumno, fc.programa_sk
        FROM dw.fact_cursado fc
        JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk = fc.periodo_academico_sk
        JOIN dw.dim_estudiante e ON e.estudiante_sk = fc.estudiante_sk AND e.member_type = 'STANDARD'
        WHERE pa.closure_id IN (SELECT processed_closure_id FROM successor WHERE candidates = 1)
    ), classified AS (
        SELECT t.id,
               etl_control.classify_hop_retention(
                   coalesce(s.candidates = 1 AND s.processed_closure_id IS NOT NULL, FALSE),
                   nc.id_alumno IS NOT NULL,
                   coalesce(pt.parciales, 0),
                   FALSE /* 0040: alumnos.fec_egreso is not university egress evidence */
               )::varchar(20) AS result
        FROM target_rows t
        LEFT JOIN successor s
               ON s.gestion = t.gestion AND s.periodo = t.periodo
              AND s.regimen IS NOT DISTINCT FROM t.regimen
        LEFT JOIN partials pt
               ON pt.estudiante_sk = t.estudiante_sk AND pt.programa_sk = t.programa_sk
              AND pt.periodo_academico_sk = t.periodo_academico_sk
        LEFT JOIN next_coursework nc
               ON s.candidates = 1 AND nc.closure_id = s.processed_closure_id
              AND nc.id_alumno = t.id_alumno AND nc.programa_sk = t.programa_sk
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

COMMENT ON FUNCTION etl_control.relabel_hop_retention_closures(BIGINT[]) IS
    '0045: recomputes published retention labels of the given PROCESADO closures with the regime-aware cadence; returns changed rows. Owner-only.';

-- Maturation: when closure X is published, every closure whose expected
-- successor can be X is recomputed (semester predecessor and, for period 1,
-- the previous-year period 1 of annual programs).
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
    RETURN etl_control.relabel_hop_retention_closures(v_predecessors);
END;
$$;

-- Preparation: the expected successor is chosen per row from the program regime.
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

    FOR v_row IN
        WITH student_keys AS (
            SELECT
                (r.record_data->>'estudiante_sk')::bigint AS estudiante_sk,
                nullif(r.record_data->>'id_alumno', '')::integer AS id_alumno
            FROM etl_work.hop_publication_row r
            WHERE r.run_id = p_run_id AND r.target_code = 'DIM_ESTUDIANTE'
              AND r.operation = 'INSERT'

            UNION ALL

            SELECT d.estudiante_sk, d.id_alumno
            FROM dw.dim_estudiante d
            WHERE d.member_type = 'STANDARD'
              AND NOT EXISTS (
                  SELECT 1 FROM etl_work.hop_publication_row r
                  WHERE r.run_id = p_run_id AND r.target_code = 'DIM_ESTUDIANTE'
                    AND r.operation = 'INSERT'
                    AND (r.record_data->>'estudiante_sk')::bigint = d.estudiante_sk
              )
        ), program_regime AS (
            -- 0045: regime staged by this run wins over the published one.
            SELECT DISTINCT ON (x.programa_sk) x.programa_sk, x.regimen
            FROM (
                SELECT (r.record_data->>'programa_sk')::bigint AS programa_sk,
                       nullif(upper(btrim(r.record_data->>'regimen')), '') AS regimen, 0 AS precedence
                FROM etl_work.hop_publication_row r
                WHERE r.run_id = p_run_id AND r.target_code = 'DIM_PROGRAMA'
                  AND r.operation IN ('INSERT', 'UPSERT')
                UNION ALL
                SELECT p.programa_sk, p.regimen, 1
                FROM dw.dim_programa p
            ) x
            ORDER BY x.programa_sk, x.precedence
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
                count(*)::integer AS materias_cursadas,
                count(*) FILTER (WHERE a.mejor_nota > 50)::integer AS materias_aprobadas,
                count(*) FILTER (WHERE a.mejor_nota > 0 AND a.mejor_nota <= 50)::integer AS materias_reprobadas,
                sum(a.parciales_rendidos)::bigint AS parciales_rendidos
            FROM subject_attempts a
            JOIN student_keys k USING (estudiante_sk)
            GROUP BY a.estudiante_sk, a.programa_sk, a.periodo_academico_sk, k.id_alumno
        ), with_successor AS (
            SELECT s.*, nxt.closure_id AS next_closure_id,
                   coalesce(nxt.candidates = 1 AND nxt.closure_id IS NOT NULL, FALSE) AS next_processed
            FROM student_period s
            LEFT JOIN program_regime pr ON pr.programa_sk = s.programa_sk
            CROSS JOIN LATERAL etl_control.hop_retention_successor(
                v_closure.gestion, v_closure.periodo, pr.regimen) cad
            LEFT JOIN LATERAL (
                SELECT count(*) AS candidates,
                       min(c.closure_id) FILTER (
                           WHERE c.status = 'PROCESADO' AND c.processed_run_id IS NOT NULL) AS closure_id
                FROM etl_control.academic_period_closure c
                WHERE c.gestion = cad.gestion AND c.periodo = cad.periodo
                  AND c.status IN ('CERRADO', 'PROCESADO', 'REABIERTO')
            ) nxt ON TRUE
        )
        SELECT
            w.*,
            CASE WHEN w.next_processed THEN EXISTS (
                SELECT 1
                FROM dw.fact_cursado next_f
                JOIN dw.dim_periodo_academico next_period
                  ON next_period.periodo_academico_sk = next_f.periodo_academico_sk
                JOIN dw.dim_estudiante next_student
                  ON next_student.estudiante_sk = next_f.estudiante_sk
                WHERE next_period.closure_id = w.next_closure_id
                  AND next_student.member_type = 'STANDARD'
                  AND next_student.id_alumno = w.id_alumno
                  AND next_f.programa_sk = w.programa_sk
            ) ELSE FALSE END AS has_next_coursework
        FROM with_successor w
        ORDER BY w.id_alumno, w.programa_sk, w.periodo_academico_sk
    LOOP
        v_result := etl_control.classify_hop_retention(
            v_row.next_processed,
            v_row.has_next_coursework,
            v_row.parciales_rendidos,
            FALSE /* 0040: alumnos.fec_egreso is not university egress evidence */
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

ALTER FUNCTION etl_control.hop_retention_successor(SMALLINT,SMALLINT,VARCHAR) OWNER TO dw_owner;
ALTER FUNCTION etl_control.relabel_hop_retention_closures(BIGINT[]) OWNER TO dw_owner;

RESET ROLE;

REVOKE ALL ON FUNCTION etl_control.relabel_hop_retention_closures(BIGINT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etl_control.hop_retention_successor(SMALLINT,SMALLINT,VARCHAR) TO dw_hop_runtime;
