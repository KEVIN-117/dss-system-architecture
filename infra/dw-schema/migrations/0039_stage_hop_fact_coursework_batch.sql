-- 0039: set-based FACT_CURSADO staging.
--
-- stage_hop_fact_coursework() is called once per notas_planilla row. Each call
-- resolves the student by scanning every staged DIM_ESTUDIANTE row of the run
-- (the jsonb predicate is not indexable), which measured ~140 ms/row on a real
-- Jachasun snapshot: ~11 min for 4,670 rows and hours for a regular semester.
--
-- stage_hop_fact_coursework_batch() receives a chunk of rows
-- [{"row_ordinal": n, "source_data": {...}}, ...] and stages it with set-based
-- validation and key resolution. Semantics match the per-row function:
--   * same grain/key/closure checks and the [0,100] grade range;
--   * the student must have exactly one SCD2 version valid at the closure,
--     looked up by id_alumno in this run's staged INSERTs and in dw (minus
--     versions closed by this run);
--   * program/subject/period keys go through resolve_hop_fact_dimension_key;
--   * the published record is identical (including the 0033 abandonment map).
-- The per-row function is kept for compatibility.

DO $$
BEGIN
    IF to_regprocedure('etl_control.stage_hop_fact_coursework(uuid,bigint,jsonb)') IS NULL
       OR to_regprocedure('etl_control.resolve_hop_fact_dimension_key(uuid,character varying,text)') IS NULL
       OR to_regclass('etl_work.hop_publication_row') IS NULL
       OR to_regclass('etl_work.hop_publication_batch') IS NULL THEN
        RAISE EXCEPTION '0039 requires the existing FACT_CURSADO staging API';
    END IF;
END;
$$;

SET ROLE dw_owner;

CREATE OR REPLACE FUNCTION etl_control.stage_hop_fact_coursework_batch(
    p_run_id UUID,
    p_rows JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control, etl_work, dw
AS $$
DECLARE
    c_max_rows CONSTANT INTEGER := 20000;
    v_run etl_control.etl_execution;
    v_closure etl_control.academic_period_closure;
    v_bad_rows BIGINT;
    v_bad_grades BIGINT;
    v_example TEXT;
    v_program_keys JSONB;
    v_subject_keys JSONB;
    v_student_keys JSONB;
    v_period_sk BIGINT;
    v_bad_students BIGINT;
    v_bad_count BIGINT;
    v_inserted BIGINT;
BEGIN
    IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
        RAISE EXCEPTION 'Lote FACT_CURSADO vacío o inválido' USING ERRCODE = '23514';
    END IF;
    IF jsonb_array_length(p_rows) > c_max_rows THEN
        RAISE EXCEPTION 'Lote FACT_CURSADO de % filas excede el máximo de %',
            jsonb_array_length(p_rows), c_max_rows USING ERRCODE = '23514';
    END IF;

    SELECT * INTO STRICT v_run FROM etl_control.etl_execution WHERE run_id = p_run_id FOR KEY SHARE;
    IF v_run.status <> 'EN_EJECUCION' OR v_run.requested_by <> session_user
       OR v_run.execution_kind NOT IN ('CIERRE_ACADEMICO','REPROCESO') OR v_run.closure_id IS NULL THEN
        RAISE EXCEPTION 'FACT_CURSADO requiere un cierre/reproceso elegible solicitado por el actor' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO STRICT v_closure FROM etl_control.academic_period_closure
    WHERE closure_id = v_run.closure_id FOR KEY SHARE;
    IF v_closure.status <> 'CERRADO' OR v_closure.effective_at > clock_timestamp() THEN
        RAISE EXCEPTION 'El cierre de FACT_CURSADO no está elegible' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM etl_work.hop_publication_batch b
               WHERE b.run_id = p_run_id AND b.target_code = 'FACT_CURSADO') THEN
        RAISE EXCEPTION 'No se pueden agregar filas después de sellar el lote FACT_CURSADO'
            USING ERRCODE = '23514';
    END IF;

    -- Grain, keys and grade range.
    WITH src AS (
        SELECT e->>'row_ordinal' AS ord_text, e->'source_data' AS d
        FROM jsonb_array_elements(p_rows) AS e
    )
    SELECT
        count(*) FILTER (WHERE
            ord_text IS NULL OR ord_text::bigint < 1
            OR d IS NULL OR jsonb_typeof(d) <> 'object'
            OR nullif(d->>'id_matricula','') IS NULL
            OR nullif(d->>'id_alumno','') IS NULL
            OR nullif(btrim(d->>'id_programa'),'') IS NULL
            OR nullif(d->>'id_materia','') IS NULL
            OR nullif(d->>'estado','') IS NULL
            OR nullif(d->>'id_gestion','')::smallint IS DISTINCT FROM v_closure.gestion
            OR nullif(d->>'id_periodo','')::smallint IS DISTINCT FROM v_closure.periodo),
        count(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM unnest(ARRAY['nota','nota_2da','nota_ex_mesa','pparcial','sparcial','tparcial','cparcial']) AS f(name)
            WHERE nullif(d->>f.name,'') IS NOT NULL
              AND ((d->>f.name)::numeric < 0 OR (d->>f.name)::numeric > 100))),
        min(d->>'id_matricula') FILTER (WHERE EXISTS (
            SELECT 1 FROM unnest(ARRAY['nota','nota_2da','nota_ex_mesa','pparcial','sparcial','tparcial','cparcial']) AS f(name)
            WHERE nullif(d->>f.name,'') IS NOT NULL
              AND ((d->>f.name)::numeric < 0 OR (d->>f.name)::numeric > 100)))
    INTO v_bad_rows, v_bad_grades, v_example
    FROM src;
    IF v_bad_rows > 0 THEN
        RAISE EXCEPTION 'Intento de cursado sin clave/grano válido para el cierre solicitado (% filas del lote)',
            v_bad_rows USING ERRCODE = '23514';
    END IF;
    IF v_bad_grades > 0 THEN
        RAISE EXCEPTION 'Nota fuera del rango aprobado [0,100]; fila FACT_CURSADO bloqueada (% filas, p. ej. id_matricula %)',
            v_bad_grades, v_example USING ERRCODE = '23514';
    END IF;

    -- Conformed dimension keys: one resolver call per distinct natural key.
    SELECT jsonb_object_agg(k, etl_control.resolve_hop_fact_dimension_key(p_run_id, 'programa', k))
    INTO v_program_keys
    FROM (SELECT DISTINCT btrim(e->'source_data'->>'id_programa')::char(3)::text AS k
          FROM jsonb_array_elements(p_rows) AS e) AS s;
    SELECT jsonb_object_agg(k, etl_control.resolve_hop_fact_dimension_key(p_run_id, 'materia', k))
    INTO v_subject_keys
    FROM (SELECT DISTINCT (e->'source_data'->>'id_materia')::integer::text AS k
          FROM jsonb_array_elements(p_rows) AS e) AS s;
    v_period_sk := etl_control.resolve_hop_fact_dimension_key(
        p_run_id, 'periodo_academico', v_closure.gestion::text || '-' || v_closure.periodo::text);

    -- SCD2 student version valid at the closure, by id_alumno.
    WITH ids AS (
        SELECT DISTINCT (e->'source_data'->>'id_alumno')::integer AS id_alumno
        FROM jsonb_array_elements(p_rows) AS e
    ), candidates AS (
        SELECT (r.record_data->>'id_alumno')::integer AS id_alumno,
               (r.record_data->>'estudiante_sk')::bigint AS sk
        FROM etl_work.hop_publication_row r
        JOIN ids ON ids.id_alumno = (r.record_data->>'id_alumno')::integer
        WHERE r.run_id = p_run_id AND r.target_code = 'DIM_ESTUDIANTE'
          AND r.operation = 'INSERT'
          AND r.record_data->>'member_type' = 'STANDARD'
          AND (r.record_data->>'valid_from')::timestamptz <= v_closure.effective_at
          AND ((r.record_data->>'valid_to') IS NULL
               OR (r.record_data->>'valid_to')::timestamptz > v_closure.effective_at)
        UNION
        SELECT d.id_alumno, d.estudiante_sk
        FROM dw.dim_estudiante d
        JOIN ids ON ids.id_alumno = d.id_alumno
        WHERE d.member_type = 'STANDARD'
          AND d.valid_from <= v_closure.effective_at
          AND (d.valid_to IS NULL OR d.valid_to > v_closure.effective_at)
          AND NOT EXISTS (
              SELECT 1 FROM etl_work.hop_publication_row c
              WHERE c.run_id = p_run_id AND c.target_code = 'DIM_ESTUDIANTE'
                AND c.operation = 'CLOSE'
                AND (c.record_data->>'estudiante_sk')::bigint = d.estudiante_sk
                AND (c.record_data->>'valid_to')::timestamptz <= v_closure.effective_at
          )
    ), resolved AS (
        SELECT ids.id_alumno, count(c.sk) AS versions, min(c.sk) AS sk
        FROM ids LEFT JOIN candidates c USING (id_alumno)
        GROUP BY ids.id_alumno
    )
    SELECT count(*) FILTER (WHERE versions <> 1),
           min(versions) FILTER (WHERE versions <> 1),
           min(id_alumno::text) FILTER (WHERE versions <> 1),
           jsonb_object_agg(id_alumno::text, sk) FILTER (WHERE versions = 1)
    INTO v_bad_students, v_bad_count, v_example, v_student_keys
    FROM resolved;
    IF v_bad_students > 0 THEN
        RAISE EXCEPTION 'Se esperaba una única versión SCD2 para id_alumno/id_ra en %; encontradas % (% alumnos, p. ej. id_alumno %)',
            v_closure.effective_at, v_bad_count, v_bad_students, v_example USING ERRCODE = '23514';
    END IF;

    INSERT INTO etl_work.hop_publication_row (
        run_id, target_code, row_ordinal, operation, natural_key, record_data
    )
    SELECT p_run_id, 'FACT_CURSADO', s.ord, 'INSERT', s.id_matricula::text,
        jsonb_build_object(
            'estudiante_sk', (v_student_keys->>s.id_alumno::text)::bigint,
            'programa_sk', (v_program_keys->>s.id_programa)::bigint,
            'materia_sk', (v_subject_keys->>s.id_materia::text)::bigint,
            'periodo_academico_sk', v_period_sk,
            'id_matricula_origen', s.id_matricula,
            'grupo_degenerado', nullif(s.d->>'grupo','')::smallint,
            'nota_final', nullif(s.d->>'nota','')::numeric,
            'nota_complementaria', nullif(s.d->>'nota_2da','')::numeric,
            'nota_examen_mesa', nullif(s.d->>'nota_ex_mesa','')::numeric,
            'nota_parcial_1', nullif(s.d->>'pparcial','')::numeric,
            'nota_parcial_2', nullif(s.d->>'sparcial','')::numeric,
            'nota_parcial_3', nullif(s.d->>'tparcial','')::numeric,
            'nota_parcial_4', nullif(s.d->>'cparcial','')::numeric,
            'estado_origen', s.state,
            'es_aprobado', NULL, 'es_reprobado', NULL,
            'es_abandono', CASE
                WHEN upper(btrim(s.state)) IN ('X','I') THEN TRUE
                WHEN upper(btrim(s.state)) IN ('A','R','H','C','S','D') THEN FALSE
                ELSE NULL
            END,
            'es_repeticion', NULL,
            'conteo_intento', 1
        )
    FROM (
        SELECT (e->>'row_ordinal')::bigint AS ord,
               e->'source_data' AS d,
               (e->'source_data'->>'id_matricula')::integer AS id_matricula,
               (e->'source_data'->>'id_alumno')::integer AS id_alumno,
               btrim(e->'source_data'->>'id_programa')::char(3)::text AS id_programa,
               (e->'source_data'->>'id_materia')::integer AS id_materia,
               nullif(e->'source_data'->>'estado','') AS state
        FROM jsonb_array_elements(p_rows) AS e
    ) AS s;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    RETURN v_inserted;
END;
$$;

ALTER FUNCTION etl_control.stage_hop_fact_coursework_batch(UUID,JSONB) OWNER TO dw_owner;

RESET ROLE;

REVOKE ALL ON FUNCTION etl_control.stage_hop_fact_coursework_batch(UUID,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etl_control.stage_hop_fact_coursework_batch(UUID,JSONB) TO dw_hop_runtime;

COMMENT ON FUNCTION etl_control.stage_hop_fact_coursework_batch(UUID,JSONB) IS
    'Stages a chunk of FACT_CURSADO rows ([{row_ordinal, source_data}]) with set-based validation and key resolution; same semantics and record as stage_hop_fact_coursework().';
