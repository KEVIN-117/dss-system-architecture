-- 0041: a student is present at a closure once enrolled OR once they have
-- coursework in a cut at or before it.
--
-- 0030 excluded from a historical SCD2 snapshot every student whose
-- fec_inscripcion is after the closure. In Jachasun fec_inscripcion is
-- rewritten by system migrations (22,450 students carry 2003-10-03 and ~22k
-- were re-registered in January 2015), so before 2015 almost all coursework
-- belongs to "future" students and FACT_CURSADO cannot resolve them: every
-- historical cut aborted. Hop now sends the first recorded coursework
-- (first_coursework_gestion/periodo) and both rules accept it as presence
-- evidence. The same rule applies to the admission student link (0038).

DO $$
BEGIN
    IF to_regprocedure('etl_control.prepare_hop_student_scd2(uuid,jsonb)') IS NULL
       OR to_regprocedure('etl_control.stage_hop_fact_admission(uuid,bigint,jsonb)') IS NULL THEN
        RAISE EXCEPTION '0041 requires the SCD2 preparation and admission staging functions';
    END IF;
END;
$$;

SET ROLE dw_owner;

DO $$
DECLARE
    v_definition TEXT;
    c_scd2_old CONSTANT TEXT := $old$
    -- Do not publish a student in a historical snapshot before enrollment.
    IF v_incoming.fec_inscripcion > v_closure.effective_at::DATE THEN
        RETURN 0;
    END IF;
$old$;
    c_scd2_new CONSTANT TEXT := $new$
    -- 0041: present once enrolled or once coursework exists at/before the cut
    -- (fec_inscripcion is rewritten by source system migrations).
    IF v_incoming.fec_inscripcion > v_closure.effective_at::DATE
       AND NOT coalesce(
           (nullif(p_student->>'first_coursework_gestion', '')::smallint,
            nullif(p_student->>'first_coursework_periodo', '')::smallint)
           <= (v_closure.gestion, v_closure.periodo), FALSE) THEN
        RETURN 0;
    END IF;
$new$;
    c_adm_old CONSTANT TEXT :=
        'IF v_id_alumno IS NULL OR v_fec_inscripcion > v_closure.effective_at::date THEN';
    c_adm_new CONSTANT TEXT :=
        'IF v_id_alumno IS NULL OR (v_fec_inscripcion > v_closure.effective_at::date /* 0041 */'
        || ' AND NOT coalesce((nullif(p_source_data->>''alumno_first_coursework_gestion'','''')::smallint,'
        || ' nullif(p_source_data->>''alumno_first_coursework_periodo'','''')::smallint)'
        || ' <= (v_closure.gestion, v_closure.periodo), FALSE)) THEN';
BEGIN
    v_definition := pg_get_functiondef('etl_control.prepare_hop_student_scd2(uuid,jsonb)'::REGPROCEDURE);
    IF position('-- 0041: present once enrolled' IN v_definition) = 0 THEN
        IF length(v_definition) - length(replace(v_definition, c_scd2_old, '')) <> length(c_scd2_old) THEN
            RAISE EXCEPTION '0041 expected exactly one enrolment exclusion block in prepare_hop_student_scd2';
        END IF;
        EXECUTE replace(v_definition, c_scd2_old, c_scd2_new);
    END IF;

    v_definition := pg_get_functiondef('etl_control.stage_hop_fact_admission(uuid,bigint,jsonb)'::REGPROCEDURE);
    IF position('/* 0041 */' IN v_definition) = 0 THEN
        IF length(v_definition) - length(replace(v_definition, c_adm_old, '')) <> length(c_adm_old) THEN
            RAISE EXCEPTION '0041 expected exactly one enrolment rule in stage_hop_fact_admission';
        END IF;
        EXECUTE replace(v_definition, c_adm_old, c_adm_new);
    END IF;
END;
$$;

RESET ROLE;
