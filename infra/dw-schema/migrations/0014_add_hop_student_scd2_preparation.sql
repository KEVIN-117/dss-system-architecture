-- DW-MVP-004 / Req. 6.4: prepare student SCD2 transitions in the private
-- publication area. Published dimensions are still changed only by 0011's
-- atomic publisher.
DO $$
BEGIN
    IF to_regclass('etl_control.etl_execution') IS NULL
       OR to_regclass('etl_control.academic_period_closure') IS NULL
       OR to_regclass('etl_work.hop_publication_row') IS NULL
       OR to_regclass('dw.dim_estudiante') IS NULL
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dw_hop_runtime') THEN
        RAISE EXCEPTION 'DW-004, DW-006, SCD2 y publisher deben existir antes de 0014';
    END IF;
END;
$$;

SET ROLE dw_owner;

CREATE OR REPLACE FUNCTION etl_control.prepare_hop_student_scd2(
    p_run_id UUID,
    p_student JSONB
)
RETURNS SMALLINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control, etl_work, dw
AS $$
DECLARE
    v_run etl_control.etl_execution;
    v_closure etl_control.academic_period_closure;
    v_incoming dw.dim_estudiante%ROWTYPE;
    v_current dw.dim_estudiante%ROWTYPE;
    v_match_count BIGINT;
    v_identity_key TEXT;
    v_lock_key TEXT;
    v_canonical TEXT := '';
    v_hash CHAR(64);
    v_new_sk BIGINT;
    v_ordinal BIGINT;
    v_staged_row_id BIGINT;
    v_staged_count SMALLINT := 0;
    v_value TEXT;
BEGIN
    -- Hop requests transform metadata with NULL bind values. Keep that describe
    -- path side-effect free and return SQL NULL for its sentinel source row.
    IF p_run_id IS NULL OR p_student IS NULL OR p_student = 'null'::JSONB THEN
        RETURN NULL;
    END IF;

    SELECT * INTO STRICT v_run
    FROM etl_control.etl_execution
    WHERE run_id = p_run_id
    FOR KEY SHARE;
    IF v_run.status <> 'EN_EJECUCION' OR v_run.requested_by <> session_user
       OR v_run.closure_id IS NULL OR v_run.requested_cut_at IS NULL THEN
        RAISE EXCEPTION 'SCD2 requiere la ejecución activa del solicitante y un cierre autorizado'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO STRICT v_closure
    FROM etl_control.academic_period_closure
    WHERE closure_id = v_run.closure_id
    FOR KEY SHARE;
    IF v_closure.status <> 'CERRADO'
       OR v_closure.effective_at <> v_run.requested_cut_at
       OR v_closure.effective_at > clock_timestamp() THEN
        RAISE EXCEPTION 'El corte SCD2 ya no corresponde a un cierre elegible'
            USING ERRCODE = '23514';
    END IF;

    SELECT * INTO v_incoming
    FROM jsonb_populate_record(NULL::dw.dim_estudiante, p_student);
    IF v_incoming.id_alumno IS NULL OR v_incoming.fec_inscripcion IS NULL
       OR v_incoming.estado_academico IS NULL OR v_incoming.tipo_alumno IS NULL
       OR (v_incoming.id_ra IS NULL AND v_incoming.id_alumno IS NULL) THEN
        RAISE EXCEPTION 'La observación de estudiante no cumple las claves y campos obligatorios del contrato'
            USING ERRCODE = '23514';
    END IF;
    IF v_incoming.id_ra IS NOT NULL
       AND coalesce((p_student->>'_demographic_match')::BOOLEAN, FALSE) IS NOT TRUE THEN
        RAISE EXCEPTION 'No existe perfil uatf_datos para el id_ra informado; snapshot SCD2 bloqueado'
            USING ERRCODE = '23514';
    END IF;

    v_identity_key := CASE
        WHEN v_incoming.id_ra IS NOT NULL THEN 'RA:' || v_incoming.id_ra
        ELSE 'ALUMNO:' || v_incoming.id_alumno::TEXT
    END;

    -- Serialize using the same stable identity lock order as the DW overlap
    -- trigger; serialize row ordinals per run so concurrent Hop copies cannot
    -- create gaps or duplicate ordinals in the sealed student batch.
    FOR v_lock_key IN
        SELECT lock_key
        FROM unnest(ARRAY[
            'DW-HOP-RUN:' || p_run_id::TEXT,
            CASE WHEN v_incoming.id_ra IS NOT NULL THEN 'RA:' || v_incoming.id_ra END,
            'ALUMNO:' || v_incoming.id_alumno::TEXT
        ]) AS lock_keys(lock_key)
        WHERE lock_key IS NOT NULL
        ORDER BY lock_key
    LOOP
        PERFORM pg_advisory_xact_lock(
            hashtextextended('dw.dim_estudiante.scd2:' || v_lock_key, 0)
        );
    END LOOP;

    SELECT count(*) INTO v_match_count
    FROM dw.dim_estudiante d
    WHERE d.member_type = 'STANDARD' AND d.is_current
      AND ((v_incoming.id_ra IS NOT NULL AND d.id_ra = v_incoming.id_ra)
        OR d.id_alumno = v_incoming.id_alumno);
    IF v_match_count > 1 THEN
        RAISE EXCEPTION 'Los identificadores de estudiante apuntan a más de una identidad vigente'
            USING ERRCODE = '23514';
    END IF;
    IF v_match_count = 1 THEN
        SELECT * INTO STRICT v_current
        FROM dw.dim_estudiante d
        WHERE d.member_type = 'STANDARD' AND d.is_current
          AND ((v_incoming.id_ra IS NOT NULL AND d.id_ra = v_incoming.id_ra)
            OR d.id_alumno = v_incoming.id_alumno)
        FOR UPDATE;

        -- Do not auto-merge an RA and an alternate academic identity when one
        -- appears later or either identifier changes its association.
        IF v_current.id_ra IS DISTINCT FROM v_incoming.id_ra
           OR v_current.id_alumno IS DISTINCT FROM v_incoming.id_alumno THEN
            RAISE EXCEPTION 'Conflicto de reconciliación id_ra/id_alumno; requiere aprobación DSA/TI'
                USING ERRCODE = '23514';
        END IF;
        IF v_current.attribute_hash_scd2 IS NULL THEN
            RAISE EXCEPTION 'La versión vigente no tiene hash SCD2; requiere reconciliación controlada'
                USING ERRCODE = '23514';
        END IF;
        IF v_current.valid_from > v_closure.effective_at THEN
            RAISE EXCEPTION 'El cierre solicitado antecede la versión SCD2 vigente'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- Length-prefix each value and encode NULL as length -1. This makes the
    -- serialization stable for Unicode, delimiters, empty strings and nulls.
    v_value := v_incoming.id_sexo::TEXT;
    v_canonical := v_canonical || 'id_sexo=' || coalesce(octet_length(v_value)::TEXT, '-1') || ':' || coalesce(v_value, '') || '|';
    v_value := v_incoming.estado_civil::TEXT;
    v_canonical := v_canonical || 'estado_civil=' || coalesce(octet_length(v_value)::TEXT, '-1') || ':' || coalesce(v_value, '') || '|';
    v_value := v_incoming.nac_pais::TEXT;
    v_canonical := v_canonical || 'nac_pais=' || coalesce(octet_length(v_value)::TEXT, '-1') || ':' || coalesce(v_value, '') || '|';
    v_value := v_incoming.id_colegio::TEXT;
    v_canonical := v_canonical || 'id_colegio=' || coalesce(octet_length(v_value)::TEXT, '-1') || ':' || coalesce(v_value, '') || '|';
    v_value := v_incoming.colegio::TEXT;
    v_canonical := v_canonical || 'colegio=' || coalesce(octet_length(v_value)::TEXT, '-1') || ':' || coalesce(v_value, '') || '|';
    v_value := v_incoming.tipo_colegio::TEXT;
    v_canonical := v_canonical || 'tipo_colegio=' || coalesce(octet_length(v_value)::TEXT, '-1') || ':' || coalesce(v_value, '') || '|';
    v_value := v_incoming.turno_colegio::TEXT;
    v_canonical := v_canonical || 'turno_colegio=' || coalesce(octet_length(v_value)::TEXT, '-1') || ':' || coalesce(v_value, '') || '|';
    v_value := v_incoming.area_colegio::TEXT;
    v_canonical := v_canonical || 'area_colegio=' || coalesce(octet_length(v_value)::TEXT, '-1') || ':' || coalesce(v_value, '') || '|';
    v_value := v_incoming.cod_localidad::TEXT;
    v_canonical := v_canonical || 'cod_localidad=' || coalesce(octet_length(v_value)::TEXT, '-1') || ':' || coalesce(v_value, '') || '|';
    v_value := v_incoming.localidad::TEXT;
    v_canonical := v_canonical || 'localidad=' || coalesce(octet_length(v_value)::TEXT, '-1') || ':' || coalesce(v_value, '') || '|';
    v_value := v_incoming.cod_pais::TEXT;
    v_canonical := v_canonical || 'cod_pais=' || coalesce(octet_length(v_value)::TEXT, '-1') || ':' || coalesce(v_value, '') || '|';
    v_value := v_incoming.cod_departamento::TEXT;
    v_canonical := v_canonical || 'cod_departamento=' || coalesce(octet_length(v_value)::TEXT, '-1') || ':' || coalesce(v_value, '') || '|';
    v_value := v_incoming.cod_provincia::TEXT;
    v_canonical := v_canonical || 'cod_provincia=' || coalesce(octet_length(v_value)::TEXT, '-1') || ':' || coalesce(v_value, '') || '|';
    v_value := v_incoming.gestion_egreso_colegio::TEXT;
    v_canonical := v_canonical || 'gestion_egreso_colegio=' || coalesce(octet_length(v_value)::TEXT, '-1') || ':' || coalesce(v_value, '') || '|';
    v_value := v_incoming.fec_inscripcion::TEXT;
    v_canonical := v_canonical || 'fec_inscripcion=' || coalesce(octet_length(v_value)::TEXT, '-1') || ':' || coalesce(v_value, '') || '|';
    v_value := v_incoming.fec_egreso::TEXT;
    v_canonical := v_canonical || 'fec_egreso=' || coalesce(octet_length(v_value)::TEXT, '-1') || ':' || coalesce(v_value, '') || '|';
    v_value := v_incoming.estado_academico::TEXT;
    v_canonical := v_canonical || 'estado_academico=' || coalesce(octet_length(v_value)::TEXT, '-1') || ':' || coalesce(v_value, '') || '|';
    v_value := v_incoming.tipo_alumno::TEXT;
    v_canonical := v_canonical || 'tipo_alumno=' || coalesce(octet_length(v_value)::TEXT, '-1') || ':' || coalesce(v_value, '') || '|';
    v_hash := encode(etl_control.digest(convert_to(v_canonical, 'UTF8'), 'sha256'), 'hex')::CHAR(64);

    IF v_match_count = 1 AND v_current.attribute_hash_scd2 = v_hash THEN
        IF v_current.valid_from = v_closure.effective_at THEN
            RETURN 0;
        END IF;
        -- Same attributes in a later closure need no artificial version.
        RETURN 0;
    END IF;
    IF v_match_count = 1 AND v_current.valid_from = v_closure.effective_at THEN
        RAISE EXCEPTION 'Atributos distintos para la misma identidad y fecha efectiva'
            USING ERRCODE = '23514';
    END IF;

    SELECT coalesce(max(row_ordinal), 0) INTO v_ordinal
    FROM etl_work.hop_publication_row
    WHERE run_id = p_run_id AND target_code = 'DIM_ESTUDIANTE';

    IF v_match_count = 1 THEN
        v_ordinal := v_ordinal + 1;
        SELECT etl_control.stage_hop_publication_row(
            p_run_id, 'DIM_ESTUDIANTE'::VARCHAR(40), v_ordinal, 'CLOSE'::VARCHAR(12),
            'CLOSE:' || v_identity_key,
            jsonb_build_object('estudiante_sk', v_current.estudiante_sk,
                               'valid_to', v_closure.effective_at)
        ) INTO v_staged_row_id;
        v_staged_count := v_staged_count + 1;
    END IF;

    v_new_sk := nextval('dw.dim_estudiante_estudiante_sk_seq'::REGCLASS);
    v_ordinal := v_ordinal + 1;
    SELECT etl_control.stage_hop_publication_row(
        p_run_id, 'DIM_ESTUDIANTE'::VARCHAR(40), v_ordinal, 'INSERT'::VARCHAR(12),
        'VERSION:' || v_identity_key || ':' || v_closure.effective_at::TEXT,
        jsonb_build_object(
            'estudiante_sk', v_new_sk, 'member_type', 'STANDARD', 'technical_label', NULL,
            'id_ra', v_incoming.id_ra, 'id_alumno', v_incoming.id_alumno,
            'id_sexo', v_incoming.id_sexo, 'estado_civil', v_incoming.estado_civil,
            'nac_pais', v_incoming.nac_pais, 'id_colegio', v_incoming.id_colegio,
            'colegio', v_incoming.colegio, 'tipo_colegio', v_incoming.tipo_colegio,
            'turno_colegio', v_incoming.turno_colegio, 'area_colegio', v_incoming.area_colegio,
            'cod_localidad', v_incoming.cod_localidad, 'localidad', v_incoming.localidad,
            'cod_pais', v_incoming.cod_pais, 'cod_departamento', v_incoming.cod_departamento,
            'cod_provincia', v_incoming.cod_provincia,
            'gestion_egreso_colegio', v_incoming.gestion_egreso_colegio,
            'fec_inscripcion', v_incoming.fec_inscripcion, 'fec_egreso', v_incoming.fec_egreso,
            'estado_academico', v_incoming.estado_academico, 'tipo_alumno', v_incoming.tipo_alumno,
            'source_run_id', p_run_id, 'created_at', clock_timestamp(),
            'updated_at', clock_timestamp(), 'valid_from', v_closure.effective_at,
            'valid_to', NULL, 'is_current', TRUE, 'attribute_hash_scd2', v_hash
        )
    ) INTO v_staged_row_id;
    v_staged_count := v_staged_count + 1;
    RETURN v_staged_count;
END;
$$;

ALTER FUNCTION etl_control.prepare_hop_student_scd2(UUID, JSONB) OWNER TO dw_owner;
RESET ROLE;

REVOKE ALL ON FUNCTION etl_control.prepare_hop_student_scd2(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etl_control.prepare_hop_student_scd2(UUID, JSONB) TO dw_hop_runtime;

COMMENT ON FUNCTION etl_control.prepare_hop_student_scd2(UUID, JSONB) IS
    'Compara un snapshot completo de estudiante con la versión vigente, calcula hash SCD2 canónico y prepara CLOSE/INSERT solo en staging privado; requiere ejecución y cierre elegibles.';
