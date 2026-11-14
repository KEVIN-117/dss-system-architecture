-- 0038: resolve FACT_ADMISION students through the application link.
--
-- 0028 resolved the academic student by public.postulantes.id_ra and aborted
-- when one RA mapped to several academic records. Profiling Jachasun showed
-- that RA is not an application key: 10-35% of each cut has several students
-- per RA (re-enrolments/career changes), so every real cut aborted, and 45,654
-- unique RA matches pointed to a student of a different program.
--
-- The operational link is academico.alumnos.id_postulante =
-- public.postulantes.id_alumno restricted to the applied program (61,036
-- matches; program equal in 100% and RA equal in 99.98%). Hop sends:
--   id_alumno               chosen academic student (earliest enrolment of the
--                           application in the applied program) or null
--   alumno_link_count       number of academic students linked to the
--                           application in that program (lineage, >= 0)
--   alumno_fec_inscripcion  enrolment date of the chosen student
--
-- A linked student enrolled after the closure is not yet part of the SCD2
-- snapshot of that closure (same rule as 0030), so the application uses the
-- UNKNOWN student member instead of aborting. Any other linked student must
-- resolve to exactly one valid SCD2 version.

DO $$
BEGIN
    IF to_regprocedure('etl_control.stage_hop_fact_admission(uuid,bigint,jsonb)') IS NULL
       OR to_regprocedure('etl_control.resolve_hop_admission_student_key(uuid,character varying,integer,timestamp with time zone)') IS NULL
       OR to_regclass('etl_control.etl_execution') IS NULL
       OR to_regclass('etl_control.academic_period_closure') IS NULL THEN
        RAISE EXCEPTION '0038 requires the existing admission staging and student resolution functions';
    END IF;
END;
$$;

SET ROLE dw_owner;

CREATE OR REPLACE FUNCTION etl_control.stage_hop_fact_admission(
    p_run_id UUID,
    p_row_ordinal BIGINT,
    p_source_data JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control, etl_work, dw
AS $$
DECLARE
    v_run etl_control.etl_execution;
    v_closure etl_control.academic_period_closure;
    v_student_sk BIGINT;
    v_program_sk BIGINT;
    v_period_sk BIGINT;
    v_admission_sk BIGINT;
    v_id_alumno INTEGER;
    v_id_alumno_postulante INTEGER;
    v_link_count INTEGER;
    v_fec_inscripcion DATE;
    v_id_programa CHAR(3);
    v_gestion SMALLINT;
    v_periodo SMALLINT;
    v_id_acceso CHAR(2);
    v_estado CHAR(1);
    v_record JSONB;
BEGIN
    IF p_source_data IS NULL OR jsonb_typeof(p_source_data)<>'object' OR p_row_ordinal<1 THEN
        RAISE EXCEPTION 'Fila FACT_ADMISION incompleta' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO STRICT v_run FROM etl_control.etl_execution WHERE run_id=p_run_id FOR KEY SHARE;
    IF v_run.status<>'EN_EJECUCION' OR v_run.requested_by<>session_user
       OR v_run.execution_kind NOT IN ('CIERRE_ACADEMICO','REPROCESO') OR v_run.closure_id IS NULL THEN
        RAISE EXCEPTION 'FACT_ADMISION requiere un cierre/reproceso elegible solicitado por el actor' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO STRICT v_closure FROM etl_control.academic_period_closure WHERE closure_id=v_run.closure_id FOR KEY SHARE;
    IF v_closure.status<>'CERRADO' OR v_closure.effective_at>clock_timestamp() THEN
        RAISE EXCEPTION 'El cierre de FACT_ADMISION no está elegible' USING ERRCODE = '23514';
    END IF;

    -- Fail closed on the 0028 payload: it lacks the application link.
    IF NOT (p_source_data ? 'alumno_link_count') THEN
        RAISE EXCEPTION 'FACT_ADMISION requiere alumno_link_count (vínculo alumnos.id_postulante); actualice pl_fact_admision_mvp.hpl'
            USING ERRCODE = '23514';
    END IF;

    v_id_alumno := nullif(p_source_data->>'id_alumno','')::integer;
    v_id_alumno_postulante := nullif(p_source_data->>'id_alumno_postulante','')::integer;
    v_link_count := nullif(p_source_data->>'alumno_link_count','')::integer;
    v_fec_inscripcion := nullif(p_source_data->>'alumno_fec_inscripcion','')::date;
    v_id_programa := nullif(btrim(p_source_data->>'id_programa'),'')::char(3);
    v_gestion := nullif(p_source_data->>'id_gestion','')::smallint;
    v_periodo := nullif(p_source_data->>'id_periodo','')::smallint;
    v_id_acceso := nullif(btrim(p_source_data->>'id_acceso'),'')::char(2);
    v_estado := nullif(btrim(p_source_data->>'estado'),'')::char(1);

    IF v_id_alumno_postulante IS NULL OR v_id_programa IS NULL
       OR (v_gestion IS NULL) <> (v_periodo IS NULL)
       OR (v_gestion IS NOT NULL AND (v_gestion<>v_closure.gestion OR v_periodo<>v_closure.periodo)) THEN
        RAISE EXCEPTION 'Postulación sin clave de origen o grano válido para el cierre solicitado' USING ERRCODE = '23514';
    END IF;
    IF v_link_count IS NULL OR v_link_count < 0
       OR (v_link_count > 0) <> (v_id_alumno IS NOT NULL)
       OR (v_id_alumno IS NOT NULL AND v_fec_inscripcion IS NULL) THEN
        RAISE EXCEPTION 'El vínculo académico de la postulación % es inconsistente (alumnos=%, id_alumno=%)',
            v_id_alumno_postulante, v_link_count, v_id_alumno USING ERRCODE = '23514';
    END IF;

    IF v_id_alumno IS NULL OR v_fec_inscripcion > v_closure.effective_at::date THEN
        -- Not (yet) an academic student at this closure: UNKNOWN member.
        v_student_sk := etl_control.resolve_hop_admission_student_key(
            p_run_id, NULL, NULL, v_closure.effective_at
        );
    ELSE
        -- id_ra is deliberately not passed: identity is id_alumno only.
        v_student_sk := etl_control.resolve_hop_admission_student_key(
            p_run_id, NULL, v_id_alumno, v_closure.effective_at
        );
    END IF;
    v_program_sk := etl_control.resolve_hop_fact_dimension_key(p_run_id,'programa',v_id_programa::text);
    v_period_sk := CASE WHEN v_gestion IS NULL THEN
        etl_control.resolve_hop_fact_dimension_key(p_run_id,'periodo_academico',NULL)
        ELSE etl_control.resolve_hop_fact_dimension_key(p_run_id,'periodo_academico',v_gestion::text||'-'||v_periodo::text) END;
    v_admission_sk := etl_control.resolve_hop_fact_dimension_key(p_run_id,'admision',v_id_acceso::text);

    v_record := jsonb_build_object(
        'estudiante_sk',v_student_sk,'programa_sk',v_program_sk,
        'periodo_academico_sk',v_period_sk,'admision_sk',v_admission_sk,
        'id_alumno_origen',v_id_alumno_postulante,'id_programa_origen',v_id_programa,
        'id_gestion_origen',v_gestion,'id_periodo_origen',v_periodo,
        'conteo_postulacion',1,
        'es_admitido',CASE v_estado WHEN 'A' THEN TRUE WHEN 'P' THEN FALSE ELSE NULL END,
        'puntaje_examen',nullif(p_source_data->>'nota','')::integer,
        'estado_origen',v_estado
    );
    RETURN etl_control.stage_hop_publication_row(
        p_run_id,'FACT_ADMISION',p_row_ordinal,'INSERT',v_id_alumno_postulante::text,v_record
    );
END;
$$;

ALTER FUNCTION etl_control.stage_hop_fact_admission(UUID,BIGINT,JSONB) OWNER TO dw_owner;

RESET ROLE;

REVOKE ALL ON FUNCTION etl_control.stage_hop_fact_admission(UUID,BIGINT,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etl_control.stage_hop_fact_admission(UUID,BIGINT,JSONB) TO dw_hop_runtime;

COMMENT ON FUNCTION etl_control.stage_hop_fact_admission(UUID,BIGINT,JSONB) IS
    'Stages FACT_ADMISION. Resolves the academic student through academico.alumnos.id_postulante = postulantes.id_alumno in the applied program (chosen by Hop); students enrolled after the closure and unlinked applications use UNKNOWN; keeps postulantes.id_alumno as source lineage.';
