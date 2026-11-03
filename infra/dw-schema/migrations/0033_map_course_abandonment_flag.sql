-- 0033: map only documented formal course-abandonment source codes.
-- Unknown and tacit/no-evaluation codes remain NULL; they are not negative labels.
DO $$
BEGIN
    IF to_regprocedure('etl_control.stage_hop_fact_coursework(uuid,bigint,jsonb)') IS NULL THEN
        RAISE EXCEPTION '0033 requires etl_control.stage_hop_fact_coursework(uuid,bigint,jsonb)';
    END IF;
END;
$$;

SET ROLE dw_owner;
DO $$
DECLARE
    v_definition TEXT;
    v_old CONSTANT TEXT := $old$
        -- Jachasun's DDL has no approved domain/meaning for coursework estado.
        -- Keep the raw code; business flags remain unknown, never inferred.
        'es_aprobado',NULL,'es_reprobado',NULL,'es_abandono',NULL,'es_repeticion',NULL,
$old$;
    v_new CONSTANT TEXT := $new$
        -- Source contract: X/I are formal abandonment; A/R/H/C/S/D are observed
        -- non-abandonment outcomes. U/Z/T and any unrecognized value stay unknown.
        'es_aprobado',NULL,'es_reprobado',NULL,
        'es_abandono',CASE
            WHEN upper(btrim(v_state)) IN ('X','I') THEN TRUE
            WHEN upper(btrim(v_state)) IN ('A','R','H','C','S','D') THEN FALSE
            ELSE NULL
        END,
        'es_repeticion',NULL,
$new$;
BEGIN
    v_definition := pg_get_functiondef(
        'etl_control.stage_hop_fact_coursework(uuid,bigint,jsonb)'::REGPROCEDURE
    );

    IF position(v_new IN v_definition) > 0 THEN
        RAISE NOTICE '0033 course-abandonment mapping is already installed';
        RETURN;
    END IF;
    IF position(v_old IN v_definition) = 0 THEN
        RAISE EXCEPTION '0033 found an unknown coursework flag mapping; refusing to rewrite it';
    END IF;
    IF length(v_definition) - length(replace(v_definition, v_old, ''))
       <> length(v_old) THEN
        RAISE EXCEPTION '0033 expected exactly one legacy coursework flag mapping';
    END IF;

    v_definition := replace(v_definition, v_old, v_new);
    EXECUTE v_definition;

    v_definition := pg_get_functiondef(
        'etl_control.stage_hop_fact_coursework(uuid,bigint,jsonb)'::REGPROCEDURE
    );
    IF position(v_new IN v_definition) = 0 THEN
        RAISE EXCEPTION '0033 could not verify the coursework flag mapping after replacement';
    END IF;
END;
$$;
RESET ROLE;

COMMENT ON FUNCTION etl_control.stage_hop_fact_coursework(UUID, BIGINT, JSONB) IS
    'Stages coursework facts and maps only documented formal abandonment codes X/I; unknown source states remain NULL.';
