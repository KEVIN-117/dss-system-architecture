-- 0042: resolve staged SCD2 students once per FACT_CURSADO chunk.
--
-- In 0039 the staged branch of the student lookup joined the chunk ids to
-- etl_work.hop_publication_row on a jsonb expression. Inside the function the
-- planner sees jsonb_array_elements() as 100 rows and the staging table with
-- stale statistics, so it picks a nested loop that re-parses every staged
-- DIM_ESTUDIANTE record for every id of the chunk. On a first historical load
-- (all ~27k students staged, dw.dim_estudiante empty) that is ~138M jsonb
-- parses per 5,000-row chunk, spilled to disk: >14 min per chunk instead of
-- ~70 ms. The staged versions are now extracted once into a materialized CTE
-- and joined on integers. Semantics are unchanged.

DO $$
BEGIN
    IF to_regprocedure('etl_control.stage_hop_fact_coursework_batch(uuid,jsonb)') IS NULL THEN
        RAISE EXCEPTION '0042 requires stage_hop_fact_coursework_batch (0039)';
    END IF;
END;
$$;

SET ROLE dw_owner;

DO $$
DECLARE
    v_definition TEXT;
    c_old CONSTANT TEXT := $old$
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
$old$;
    c_new CONSTANT TEXT := $new$
    WITH ids AS MATERIALIZED (
        SELECT DISTINCT (e->'source_data'->>'id_alumno')::integer AS id_alumno
        FROM jsonb_array_elements(p_rows) AS e
    ), staged AS MATERIALIZED (
        -- 0042: parse each staged version once, then join on integers.
        SELECT (r.record_data->>'id_alumno')::integer AS id_alumno,
               (r.record_data->>'estudiante_sk')::bigint AS sk
        FROM etl_work.hop_publication_row r
        WHERE r.run_id = p_run_id AND r.target_code = 'DIM_ESTUDIANTE'
          AND r.operation = 'INSERT'
          AND r.record_data->>'member_type' = 'STANDARD'
          AND (r.record_data->>'valid_from')::timestamptz <= v_closure.effective_at
          AND ((r.record_data->>'valid_to') IS NULL
               OR (r.record_data->>'valid_to')::timestamptz > v_closure.effective_at)
    ), candidates AS (
        SELECT s.id_alumno, s.sk
        FROM staged s
        JOIN ids ON ids.id_alumno = s.id_alumno
        UNION
$new$;
BEGIN
    v_definition := pg_get_functiondef('etl_control.stage_hop_fact_coursework_batch(uuid,jsonb)'::REGPROCEDURE);
    IF position('-- 0042: parse each staged version once' IN v_definition) = 0 THEN
        IF length(v_definition) - length(replace(v_definition, c_old, '')) <> length(c_old) THEN
            RAISE EXCEPTION '0042 expected exactly one staged student lookup in stage_hop_fact_coursework_batch';
        END IF;
        EXECUTE replace(v_definition, c_old, c_new);
    END IF;
END;
$$;

RESET ROLE;
