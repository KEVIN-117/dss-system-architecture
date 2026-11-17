-- 0060: an out-of-range partial grade no longer blocks the FACT_CURSADO cut.
--
-- Jachasun academico.notas_planilla has one row from 2008-1 to 2021-2 with a
-- partial grade outside [0,100]: id_matricula 1919623 (2012-1),
-- tparcial = 600, while nota = 59 and the other partials are 57 and 58 (most
-- likely a typo for 60). Until now the whole 2012-1 cut was rejected because
-- of it.
--
-- New rule, adopted by the team for the historical load:
--   * Partial grades (pparcial, sparcial, tparcial, cparcial) outside [0,100]
--     are staged as NULL (no value). The row is kept. Each annulled value is
--     recorded as a non-blocking WARN in etl_control.etl_execution_error
--     (error_code COURSEWORK_PARTIAL_GRADE_OUT_OF_RANGE) with id_matricula, the
--     field and the original value, so it can be audited and reported to the
--     DSA.
--   * Final grades (nota, nota_2da, nota_ex_mesa) outside [0,100] still block
--     the cut: they decide pass/fail (0044) and must be fixed at the source.
--   * Partial grades only feed the "presentado" count of 0040/0045, where a
--     NULL partial counts as "not taken", like a 0.
--
-- Implementation: the existing batch function (0039, patched by 0042/0044) is
-- renamed to stage_hop_fact_coursework_batch_core and a wrapper with the
-- original name and signature sanitizes the chunk before calling it, so Hop
-- does not change. The core function stops being executable by the runtime.
-- The per-row function (0015) is not used by Hop and keeps the strict rule.

DO $$
BEGIN
    IF to_regprocedure('etl_control.stage_hop_fact_coursework_batch(uuid,jsonb)') IS NULL
       OR to_regprocedure('etl_control.record_etl_execution_error(uuid,character varying,character varying,text,text,boolean,bigint,jsonb)') IS NULL THEN
        RAISE EXCEPTION '0060 requires the FACT_CURSADO batch staging API (0039) and record_etl_execution_error (0003)';
    END IF;
    IF to_regprocedure('etl_control.stage_hop_fact_coursework_batch_core(uuid,jsonb)') IS NOT NULL THEN
        RAISE EXCEPTION '0060 found stage_hop_fact_coursework_batch_core already defined';
    END IF;
END;
$$;

SET ROLE dw_owner;

ALTER FUNCTION etl_control.stage_hop_fact_coursework_batch(UUID, JSONB)
    RENAME TO stage_hop_fact_coursework_batch_core;

CREATE FUNCTION etl_control.stage_hop_fact_coursework_batch(
    p_run_id UUID,
    p_rows JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control, etl_work, dw
AS $$
DECLARE
    c_partials CONSTANT TEXT[] := ARRAY['pparcial', 'sparcial', 'tparcial', 'cparcial'];
    v_rows JSONB := p_rows;
    v_issue RECORD;
BEGIN
    IF p_rows IS NOT NULL AND jsonb_typeof(p_rows) = 'array' THEN
        FOR v_issue IN
            SELECT e.ord, e.elem->'source_data'->>'id_matricula' AS id_matricula, f.name AS field,
                   e.elem->'source_data'->>f.name AS original_value
            FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS e(elem, ord)
            CROSS JOIN unnest(c_partials) AS f(name)
            WHERE jsonb_typeof(e.elem->'source_data') = 'object'
              AND nullif(e.elem->'source_data'->>f.name, '') IS NOT NULL
              AND (e.elem->'source_data'->>f.name) ~ '^\s*[-+]?[0-9]*\.?[0-9]+\s*$'
              AND ((e.elem->'source_data'->>f.name)::numeric < 0
                   OR (e.elem->'source_data'->>f.name)::numeric > 100)
            ORDER BY e.ord, f.name
        LOOP
            PERFORM etl_control.record_etl_execution_error(
                p_run_id, 'WARN', 'COURSEWORK_PARTIAL_GRADE_OUT_OF_RANGE',
                'Nota parcial fuera del rango [0,100] en academico.notas_planilla',
                format('Nota parcial %s = %s de id_matricula %s anulada (sin valor); la fila se conserva',
                       v_issue.field, v_issue.original_value, v_issue.id_matricula),
                FALSE, NULL,
                jsonb_build_object('id_matricula', v_issue.id_matricula, 'field', v_issue.field,
                                   'original_value', v_issue.original_value, 'staged_value', NULL));
            v_rows := jsonb_set(v_rows, ARRAY[(v_issue.ord - 1)::text, 'source_data', v_issue.field], 'null'::jsonb);
        END LOOP;
    END IF;
    RETURN etl_control.stage_hop_fact_coursework_batch_core(p_run_id, v_rows);
END;
$$;

ALTER FUNCTION etl_control.stage_hop_fact_coursework_batch(UUID, JSONB) OWNER TO dw_owner;

RESET ROLE;

REVOKE ALL ON FUNCTION etl_control.stage_hop_fact_coursework_batch_core(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION etl_control.stage_hop_fact_coursework_batch_core(UUID, JSONB) FROM dw_hop_runtime;
REVOKE ALL ON FUNCTION etl_control.stage_hop_fact_coursework_batch(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etl_control.stage_hop_fact_coursework_batch(UUID, JSONB) TO dw_hop_runtime;

COMMENT ON FUNCTION etl_control.stage_hop_fact_coursework_batch_core(UUID, JSONB) IS
    'Strict FACT_CURSADO batch staging (0039/0042/0044). Called only by stage_hop_fact_coursework_batch().';
COMMENT ON FUNCTION etl_control.stage_hop_fact_coursework_batch(UUID, JSONB) IS
    'Stages a chunk of FACT_CURSADO rows. Partial grades outside [0,100] are staged as NULL and recorded as non-blocking WARN COURSEWORK_PARTIAL_GRADE_OUT_OF_RANGE; final grades outside [0,100] still block (0060).';

DO $$
BEGIN
    IF has_function_privilege('dw_hop_runtime', 'etl_control.stage_hop_fact_coursework_batch_core(uuid,jsonb)', 'EXECUTE')
       OR NOT has_function_privilege('dw_hop_runtime', 'etl_control.stage_hop_fact_coursework_batch(uuid,jsonb)', 'EXECUTE') THEN
        RAISE EXCEPTION '0060 privileges are not as expected';
    END IF;
END;
$$;
