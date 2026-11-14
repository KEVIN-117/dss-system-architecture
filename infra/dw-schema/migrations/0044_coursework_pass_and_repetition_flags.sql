-- 0044: derive es_aprobado / es_reprobado / es_repeticion for FACT_CURSADO.
--
-- Until now the three flags were always NULL because the institutional rules
-- were pending (docs/dw/source-contracts/informe-investigacion-reglas-dw.md).
-- Rules adopted for the MVP:
--   * Pass outcome (numeric): effective grade = GREATEST(nota, nota_2da,
--     nota_ex_mesa). >= 51 passed; > 0 and < 51 failed; 0 or no grade stays
--     unknown (NULL), because a zero is not proof of a failed evaluation.
--     notas_planilla.estado is NOT used: observed 'A' rows carry grades < 51.
--   * Repetition: the same person (id_alumno) has an attempt of the same
--     subject (id_materia) in an earlier academic closure (dim_periodo_academico
--     .effective_at). Attempts in the same closure are not repetitions.
-- Both staging APIs (per-row and batch) use the same helpers so their records
-- stay identical, and existing facts are backfilled with the same rules.

DO $$
BEGIN
    IF to_regprocedure('etl_control.stage_hop_fact_coursework(uuid,bigint,jsonb)') IS NULL
       OR to_regprocedure('etl_control.stage_hop_fact_coursework_batch(uuid,jsonb)') IS NULL
       OR to_regclass('dw.fact_cursado') IS NULL THEN
        RAISE EXCEPTION '0044 requires the FACT_CURSADO staging API (0015/0039)';
    END IF;
END;
$$;

SET ROLE dw_owner;

CREATE OR REPLACE FUNCTION etl_control.coursework_pass_outcome(
    p_nota NUMERIC,
    p_nota_2da NUMERIC,
    p_nota_ex_mesa NUMERIC
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
    SELECT CASE
        WHEN GREATEST(p_nota, p_nota_2da, p_nota_ex_mesa) IS NULL
          OR GREATEST(p_nota, p_nota_2da, p_nota_ex_mesa) = 0 THEN NULL
        ELSE GREATEST(p_nota, p_nota_2da, p_nota_ex_mesa) >= 51
    END
$$;

CREATE OR REPLACE FUNCTION etl_control.coursework_has_prior_attempt(
    p_id_alumno INTEGER,
    p_id_materia INTEGER,
    p_before TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = pg_catalog, dw
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM dw.dim_estudiante e
        JOIN dw.fact_cursado f ON f.estudiante_sk = e.estudiante_sk
        JOIN dw.dim_materia m ON m.materia_sk = f.materia_sk
        JOIN dw.dim_periodo_academico p ON p.periodo_academico_sk = f.periodo_academico_sk
        WHERE e.member_type = 'STANDARD'
          AND e.id_alumno = p_id_alumno
          AND m.id_materia = p_id_materia
          AND p.effective_at < p_before
    )
$$;

ALTER FUNCTION etl_control.coursework_pass_outcome(NUMERIC,NUMERIC,NUMERIC) OWNER TO dw_owner;
ALTER FUNCTION etl_control.coursework_has_prior_attempt(INTEGER,INTEGER,TIMESTAMPTZ) OWNER TO dw_owner;

-- Patch both staging functions in place (same approach as 0042), so the rest
-- of their validated bodies is untouched.
DO $$
DECLARE
    v_definition TEXT;
    c_batch_pass_old CONSTANT TEXT := $old$'es_aprobado', NULL, 'es_reprobado', NULL,$old$;
    c_batch_pass_new CONSTANT TEXT := $new$-- 0044: numeric pass rule and prior-attempt repetition.
            'es_aprobado', etl_control.coursework_pass_outcome(
                nullif(s.d->>'nota','')::numeric, nullif(s.d->>'nota_2da','')::numeric,
                nullif(s.d->>'nota_ex_mesa','')::numeric),
            'es_reprobado', NOT etl_control.coursework_pass_outcome(
                nullif(s.d->>'nota','')::numeric, nullif(s.d->>'nota_2da','')::numeric,
                nullif(s.d->>'nota_ex_mesa','')::numeric),$new$;
    c_batch_rep_old CONSTANT TEXT := $old$'es_repeticion', NULL,$old$;
    c_batch_rep_new CONSTANT TEXT := $new$'es_repeticion', etl_control.coursework_has_prior_attempt(
                s.id_alumno, s.id_materia, v_closure.effective_at),$new$;
    c_row_pass_old CONSTANT TEXT := $old$'es_aprobado',NULL,'es_reprobado',NULL,$old$;
    c_row_pass_new CONSTANT TEXT := $new$-- 0044: numeric pass rule and prior-attempt repetition.
        'es_aprobado',etl_control.coursework_pass_outcome(
            nullif(p_source_data->>'nota','')::numeric,nullif(p_source_data->>'nota_2da','')::numeric,
            nullif(p_source_data->>'nota_ex_mesa','')::numeric),
        'es_reprobado',NOT etl_control.coursework_pass_outcome(
            nullif(p_source_data->>'nota','')::numeric,nullif(p_source_data->>'nota_2da','')::numeric,
            nullif(p_source_data->>'nota_ex_mesa','')::numeric),$new$;
    c_row_rep_old CONSTANT TEXT := $old$'es_repeticion',NULL,$old$;
    c_row_rep_new CONSTANT TEXT := $new$'es_repeticion',etl_control.coursework_has_prior_attempt(
            v_id_alumno,v_id_materia,v_closure.effective_at),$new$;
BEGIN
    v_definition := pg_get_functiondef('etl_control.stage_hop_fact_coursework_batch(uuid,jsonb)'::REGPROCEDURE);
    IF position('-- 0044: numeric pass rule' IN v_definition) = 0 THEN
        IF length(v_definition) - length(replace(v_definition, c_batch_pass_old, '')) <> length(c_batch_pass_old)
           OR length(v_definition) - length(replace(v_definition, c_batch_rep_old, '')) <> length(c_batch_rep_old) THEN
            RAISE EXCEPTION '0044 expected exactly one NULL pass/repetition flag in stage_hop_fact_coursework_batch';
        END IF;
        EXECUTE replace(replace(v_definition, c_batch_pass_old, c_batch_pass_new), c_batch_rep_old, c_batch_rep_new);
    END IF;

    v_definition := pg_get_functiondef('etl_control.stage_hop_fact_coursework(uuid,bigint,jsonb)'::REGPROCEDURE);
    IF position('-- 0044: numeric pass rule' IN v_definition) = 0 THEN
        IF length(v_definition) - length(replace(v_definition, c_row_pass_old, '')) <> length(c_row_pass_old)
           OR length(v_definition) - length(replace(v_definition, c_row_rep_old, '')) <> length(c_row_rep_old) THEN
            RAISE EXCEPTION '0044 expected exactly one NULL pass/repetition flag in stage_hop_fact_coursework';
        END IF;
        EXECUTE replace(replace(v_definition, c_row_pass_old, c_row_pass_new), c_row_rep_old, c_row_rep_new);
    END IF;
END;
$$;

-- Backfill published facts with the same rules. Repetition: an attempt whose
-- closure is later than the person's first closure for that subject.
WITH attempt AS (
    SELECT f.fact_cursado_id,
           etl_control.coursework_pass_outcome(f.nota_final, f.nota_complementaria, f.nota_examen_mesa) AS passed,
           CASE
               WHEN e.member_type <> 'STANDARD' OR e.id_alumno IS NULL
                 OR m.member_type <> 'STANDARD' OR p.effective_at IS NULL THEN NULL
               ELSE p.effective_at > min(p.effective_at) OVER (PARTITION BY e.id_alumno, m.id_materia)
           END AS repeated
    FROM dw.fact_cursado f
    JOIN dw.dim_estudiante e ON e.estudiante_sk = f.estudiante_sk
    JOIN dw.dim_materia m ON m.materia_sk = f.materia_sk
    JOIN dw.dim_periodo_academico p ON p.periodo_academico_sk = f.periodo_academico_sk
)
UPDATE dw.fact_cursado f
SET es_aprobado = a.passed,
    es_reprobado = NOT a.passed,
    es_repeticion = a.repeated
FROM attempt a
WHERE a.fact_cursado_id = f.fact_cursado_id
  AND (f.es_aprobado IS DISTINCT FROM a.passed
       OR f.es_reprobado IS DISTINCT FROM NOT a.passed
       OR f.es_repeticion IS DISTINCT FROM a.repeated);

RESET ROLE;

REVOKE ALL ON FUNCTION etl_control.coursework_pass_outcome(NUMERIC,NUMERIC,NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION etl_control.coursework_has_prior_attempt(INTEGER,INTEGER,TIMESTAMPTZ) FROM PUBLIC;

COMMENT ON FUNCTION etl_control.coursework_pass_outcome(NUMERIC,NUMERIC,NUMERIC) IS
    'MVP pass rule: GREATEST(nota, nota_2da, nota_ex_mesa) >= 51 passed, > 0 failed, 0 or NULL unknown.';
COMMENT ON FUNCTION etl_control.coursework_has_prior_attempt(INTEGER,INTEGER,TIMESTAMPTZ) IS
    'MVP repetition rule: the person already has an attempt of the subject in an earlier academic closure.';
