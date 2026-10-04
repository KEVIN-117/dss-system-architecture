-- DW-MVP-003: run-scoped prepared rows and the only Hop path to published DW tables.
-- The Hop login can stage prepared rows, but cannot write directly to dw or etl_control.

DO $$
BEGIN
    IF to_regclass('etl_control.schema_migration') IS NULL
       OR to_regclass('etl_control.etl_execution') IS NULL
       OR to_regclass('etl_control.etl_source_manifest') IS NULL
       OR to_regclass('dw.fact_admision') IS NULL
       OR to_regclass('dw.fact_cursado') IS NULL
       OR to_regclass('dw.fact_retencion_desercion') IS NULL
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dw_hop_runtime') THEN
        RAISE EXCEPTION 'Migraciones 0001-0010 deben estar aplicadas antes de 0011';
    END IF;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA etl_control;
DO $$
DECLARE
    v_extension_schema NAME;
BEGIN
    SELECT n.nspname INTO v_extension_schema
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pgcrypto';
    IF v_extension_schema IS DISTINCT FROM 'etl_control' THEN
        -- IF NOT EXISTS does not relocate an extension installed earlier in public.
        ALTER EXTENSION pgcrypto SET SCHEMA etl_control;
    END IF;
END;
$$;

SET ROLE dw_owner;

CREATE TABLE etl_work.hop_publication_batch (
    run_id UUID NOT NULL REFERENCES etl_control.etl_execution (run_id) ON DELETE RESTRICT,
    target_code VARCHAR(40) NOT NULL,
    expected_rows BIGINT NOT NULL CHECK (expected_rows >= 0),
    batch_sha256 CHAR(64) NOT NULL CHECK (batch_sha256 ~ '^[0-9a-f]{64}$'),
    sealed_by VARCHAR(255) NOT NULL,
    sealed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (run_id, target_code),
    CONSTRAINT ck_hop_publication_target CHECK (target_code IN (
        'DIM_ESTUDIANTE', 'DIM_PROGRAMA', 'DIM_MATERIA', 'DIM_PERIODO_ACADEMICO',
        'DIM_ADMISION', 'FACT_ADMISION', 'FACT_CURSADO', 'FACT_RETENCION_DESERCION'
    ))
);

CREATE TABLE etl_work.hop_publication_row (
    run_id UUID NOT NULL,
    target_code VARCHAR(40) NOT NULL,
    row_ordinal BIGINT NOT NULL CHECK (row_ordinal > 0),
    operation VARCHAR(12) NOT NULL CHECK (operation IN ('INSERT', 'UPSERT', 'CLOSE')),
    natural_key TEXT NOT NULL CHECK (btrim(natural_key) <> ''),
    record_data JSONB NOT NULL CHECK (jsonb_typeof(record_data) = 'object'),
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (run_id, target_code, row_ordinal),
    UNIQUE (run_id, target_code, operation, natural_key)
);

CREATE INDEX idx_hop_publication_row_run_target
    ON etl_work.hop_publication_row (run_id, target_code, row_ordinal);

ALTER TABLE etl_work.hop_publication_batch OWNER TO dw_owner;
ALTER TABLE etl_work.hop_publication_row OWNER TO dw_owner;

RESET ROLE;

REVOKE ALL ON etl_work.hop_publication_batch, etl_work.hop_publication_row FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA etl_work FROM PUBLIC;
REVOKE ALL ON FUNCTION etl_control.digest(BYTEA, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etl_control.digest(BYTEA, TEXT) TO dw_owner;
GRANT USAGE ON SCHEMA etl_work TO dw_hop_runtime;
GRANT SELECT ON dw.dim_estudiante, dw.dim_programa, dw.dim_materia,
    dw.dim_periodo_academico, dw.dim_admision TO dw_hop_runtime;

SET ROLE dw_owner;

CREATE OR REPLACE FUNCTION etl_work.hop_publication_batch_sha256(
    p_run_id UUID, p_target_code VARCHAR(40)
)
RETURNS CHAR(64)
LANGUAGE plpgsql
SET search_path = pg_catalog, etl_control, etl_work
AS $$
DECLARE
    v_row RECORD;
    v_state BYTEA := etl_control.digest(convert_to('DW-HOP-BATCH-V1', 'UTF8'), 'sha256');
BEGIN
    FOR v_row IN
        SELECT row_ordinal, record_data
        FROM etl_work.hop_publication_row
        WHERE run_id = p_run_id AND target_code = p_target_code
        ORDER BY row_ordinal
    LOOP
        v_state := etl_control.digest(
            v_state || convert_to(v_row.row_ordinal::text || ':' || v_row.record_data::text, 'UTF8'),
            'sha256'
        );
    END LOOP;
    RETURN encode(v_state, 'hex')::char(64);
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.reserve_hop_dimension_key(p_dimension VARCHAR(32))
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_sequence TEXT;
    v_key BIGINT;
BEGIN
    v_sequence := CASE p_dimension
        WHEN 'estudiante' THEN 'dw.dim_estudiante_estudiante_sk_seq'
        WHEN 'programa' THEN 'dw.dim_programa_programa_sk_seq'
        WHEN 'materia' THEN 'dw.dim_materia_materia_sk_seq'
        WHEN 'periodo_academico' THEN 'dw.dim_periodo_academico_periodo_academico_sk_seq'
        WHEN 'admision' THEN 'dw.dim_admision_admision_sk_seq'
        ELSE NULL
    END;
    IF v_sequence IS NULL THEN
        RAISE EXCEPTION 'Dimensión no autorizada para reservar surrogate key'
            USING ERRCODE = '42501';
    END IF;
    EXECUTE 'SELECT nextval($1::regclass)' INTO v_key USING v_sequence;
    RETURN v_key;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.stage_hop_publication_row(
    p_run_id UUID,
    p_target_code VARCHAR(40),
    p_row_ordinal BIGINT,
    p_operation VARCHAR(12),
    p_natural_key TEXT,
    p_record_data JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control, etl_work
AS $$
DECLARE
    v_run etl_control.etl_execution;
    v_row_id BIGINT;
BEGIN
    SELECT * INTO STRICT v_run
    FROM etl_control.etl_execution
    WHERE run_id = p_run_id
    FOR KEY SHARE;

    IF v_run.status <> 'EN_EJECUCION' OR v_run.requested_by <> session_user THEN
        RAISE EXCEPTION 'Solo el solicitante puede preparar filas de su ejecución EN_EJECUCION'
            USING ERRCODE = '42501';
    END IF;
    IF p_target_code NOT IN (
        'DIM_ESTUDIANTE', 'DIM_PROGRAMA', 'DIM_MATERIA', 'DIM_PERIODO_ACADEMICO',
        'DIM_ADMISION', 'FACT_ADMISION', 'FACT_CURSADO', 'FACT_RETENCION_DESERCION'
    ) OR (p_target_code <> 'DIM_ESTUDIANTE' AND p_operation = 'CLOSE')
       OR (p_target_code IN ('FACT_ADMISION', 'FACT_CURSADO', 'FACT_RETENCION_DESERCION')
           AND p_operation <> 'INSERT') THEN
        RAISE EXCEPTION 'Operación o destino de publicación no autorizado'
            USING ERRCODE = '42501';
    END IF;
    IF p_record_data IS NULL OR jsonb_typeof(p_record_data) <> 'object'
       OR btrim(coalesce(p_natural_key, '')) = '' OR p_row_ordinal < 1 THEN
        RAISE EXCEPTION 'Fila de publicación incompleta' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM etl_work.hop_publication_batch b
               WHERE b.run_id = p_run_id AND b.target_code = p_target_code) THEN
        RAISE EXCEPTION 'No se pueden agregar filas después de sellar el lote %', p_target_code
            USING ERRCODE = '23514';
    END IF;

    INSERT INTO etl_work.hop_publication_row (
        run_id, target_code, row_ordinal, operation, natural_key, record_data
    ) VALUES (
        p_run_id, p_target_code, p_row_ordinal, p_operation, p_natural_key, p_record_data
    ) RETURNING row_ordinal INTO v_row_id;
    RETURN v_row_id;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.seal_hop_publication_batch(
    p_run_id UUID,
    p_target_code VARCHAR(40),
    p_expected_rows BIGINT
)
RETURNS etl_work.hop_publication_batch
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control, etl_work
AS $$
DECLARE
    v_run etl_control.etl_execution;
    v_actual BIGINT;
    v_min_ordinal BIGINT;
    v_max_ordinal BIGINT;
    v_batch etl_work.hop_publication_batch;
BEGIN
    SELECT * INTO STRICT v_run FROM etl_control.etl_execution
    WHERE run_id = p_run_id FOR UPDATE;
    IF v_run.status <> 'EN_EJECUCION' OR v_run.requested_by <> session_user THEN
        RAISE EXCEPTION 'Solo el solicitante puede sellar su ejecución EN_EJECUCION'
            USING ERRCODE = '42501';
    END IF;
    IF p_target_code NOT IN (
        'DIM_ESTUDIANTE', 'DIM_PROGRAMA', 'DIM_MATERIA', 'DIM_PERIODO_ACADEMICO',
        'DIM_ADMISION', 'FACT_ADMISION', 'FACT_CURSADO', 'FACT_RETENCION_DESERCION'
    ) OR p_expected_rows < 0 THEN
        RAISE EXCEPTION 'Declaración de lote inválida' USING ERRCODE = '23514';
    END IF;
    SELECT count(*), min(row_ordinal), max(row_ordinal)
      INTO v_actual, v_min_ordinal, v_max_ordinal
    FROM etl_work.hop_publication_row
    WHERE run_id = p_run_id AND target_code = p_target_code;
    IF v_actual <> p_expected_rows
       OR (p_expected_rows > 0 AND (v_min_ordinal <> 1 OR v_max_ordinal <> p_expected_rows)) THEN
        RAISE EXCEPTION 'Conteo de lote %: declarado %, preparado %', p_target_code, p_expected_rows, v_actual
            USING ERRCODE = '23514';
    END IF;

    INSERT INTO etl_work.hop_publication_batch (
        run_id, target_code, expected_rows, batch_sha256, sealed_by
    ) VALUES (
        p_run_id, p_target_code, p_expected_rows,
        etl_work.hop_publication_batch_sha256(p_run_id, p_target_code), session_user
    )
    RETURNING * INTO v_batch;
    RETURN v_batch;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.publish_hop_staged_run(
    p_run_id UUID,
    p_lock_token UUID,
    p_reason TEXT
)
RETURNS etl_control.etl_execution
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control, etl_work, dw
AS $$
DECLARE
    v_run etl_control.etl_execution;
    v_lock etl_control.etl_execution_lock;
    v_expected TEXT[] := ARRAY[
        'DIM_ESTUDIANTE', 'DIM_PROGRAMA', 'DIM_MATERIA', 'DIM_PERIODO_ACADEMICO',
        'DIM_ADMISION', 'FACT_ADMISION', 'FACT_CURSADO', 'FACT_RETENCION_DESERCION'
    ];
    v_target TEXT;
    v_step etl_control.etl_execution_step;
    v_result etl_control.etl_execution;
    v_changed BIGINT := 0;
BEGIN
    IF btrim(coalesce(p_reason, '')) = '' THEN
        RAISE EXCEPTION 'La publicación requiere motivo' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO STRICT v_run FROM etl_control.etl_execution
    WHERE run_id = p_run_id FOR UPDATE;
    IF v_run.status <> 'PUBLICANDO' THEN
        RAISE EXCEPTION 'La ejecución debe estar PUBLICANDO antes de aplicar cambios'
            USING ERRCODE = '23514';
    END IF;

    -- Lock the lease row for the whole transaction. A competing publisher cannot
    -- recover/replace an expired lease while this transaction is applying the DW.
    SELECT * INTO STRICT v_lock FROM etl_control.etl_execution_lock
    WHERE run_id = p_run_id AND resource_key = 'dw:mvp-publication'
      AND lock_token = p_lock_token AND released_at IS NULL
      AND lease_expires_at > clock_timestamp()
    FOR UPDATE;

    IF (SELECT count(*) FROM etl_work.hop_publication_batch WHERE run_id = p_run_id) <> cardinality(v_expected)
       OR EXISTS (
            SELECT 1 FROM unnest(v_expected) AS x(target_code)
            WHERE NOT EXISTS (
                SELECT 1 FROM etl_work.hop_publication_batch b
                WHERE b.run_id = p_run_id AND b.target_code = x.target_code
            )
       ) THEN
        RAISE EXCEPTION 'La publicación requiere los ocho lotes preparados y sellados'
            USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
        SELECT 1 FROM etl_work.hop_publication_batch b
        WHERE b.run_id = p_run_id
          AND (b.expected_rows <> (
                SELECT count(*) FROM etl_work.hop_publication_row r
                WHERE r.run_id = b.run_id AND r.target_code = b.target_code
              ) OR b.batch_sha256 IS DISTINCT FROM
                etl_work.hop_publication_batch_sha256(b.run_id, b.target_code))
    ) THEN
        RAISE EXCEPTION 'Un lote cambió después de sellarse; se bloquea la publicación'
            USING ERRCODE = '23514';
    END IF;

    -- Replace only facts in the requested closure/period. For a global historical
    -- execution, replace the complete fact constellation. MVCC keeps the old
    -- publication visible until this function commits.
    IF v_run.closure_id IS NULL AND v_run.requested_gestion IS NULL THEN
        DELETE FROM dw.fact_admision;
        DELETE FROM dw.fact_cursado;
        DELETE FROM dw.fact_retencion_desercion;
    ELSE
        DELETE FROM dw.fact_admision f
        WHERE (v_run.closure_id IS NOT NULL AND EXISTS (
                   SELECT 1 FROM dw.dim_periodo_academico p
                   WHERE p.periodo_academico_sk = f.periodo_academico_sk
                     AND p.closure_id = v_run.closure_id
               )) OR (v_run.closure_id IS NULL
                   AND f.id_gestion_origen = v_run.requested_gestion
                   AND f.id_periodo_origen = v_run.requested_periodo);
        DELETE FROM dw.fact_cursado f USING dw.dim_periodo_academico p
        WHERE p.periodo_academico_sk = f.periodo_academico_sk
          AND ((v_run.closure_id IS NOT NULL AND p.closure_id = v_run.closure_id)
            OR (v_run.closure_id IS NULL AND p.gestion = v_run.requested_gestion
                AND p.periodo = v_run.requested_periodo));
        DELETE FROM dw.fact_retencion_desercion f
        WHERE (v_run.closure_id IS NOT NULL AND f.closure_id = v_run.closure_id)
           OR (v_run.closure_id IS NULL AND EXISTS (
                SELECT 1 FROM dw.dim_periodo_academico p
                WHERE p.periodo_academico_sk = f.periodo_academico_sk
                  AND p.gestion = v_run.requested_gestion
                  AND p.periodo = v_run.requested_periodo
           ));
    END IF;

    -- Dimensions are supplied by Hop as validated physical row objects. Target
    -- identifiers are selected only from the fixed allowlist above.
    FOR v_target IN SELECT unnest(v_expected[1:5]) LOOP
        IF v_target = 'DIM_ESTUDIANTE' THEN
            UPDATE dw.dim_estudiante d
            SET valid_to = (r.record_data->>'valid_to')::timestamptz,
                is_current = FALSE,
                updated_at = clock_timestamp()
            FROM etl_work.hop_publication_row r
            WHERE r.run_id = p_run_id AND r.target_code = v_target
              AND r.operation = 'CLOSE'
              AND d.estudiante_sk = (r.record_data->>'estudiante_sk')::bigint
              AND d.member_type = 'STANDARD' AND d.is_current
              AND (r.record_data->>'valid_to')::timestamptz > d.valid_from;
            GET DIAGNOSTICS v_changed = ROW_COUNT;
            IF v_changed <> (
                SELECT count(*) FROM etl_work.hop_publication_row r
                WHERE r.run_id = p_run_id AND r.target_code = v_target AND r.operation = 'CLOSE'
            ) THEN
                RAISE EXCEPTION 'El lote SCD2 intenta cerrar una versión ausente, histórica o con vigencia inválida'
                    USING ERRCODE = '23514';
            END IF;

            INSERT INTO dw.dim_estudiante (
                estudiante_sk, member_type, technical_label, id_ra, id_alumno, id_sexo,
                estado_civil, nac_pais, id_colegio, colegio, tipo_colegio, turno_colegio,
                area_colegio, cod_localidad, localidad, cod_pais, cod_departamento,
                cod_provincia, gestion_egreso_colegio, fec_inscripcion, fec_egreso,
                estado_academico, tipo_alumno, source_run_id, created_at, updated_at,
                valid_from, valid_to, is_current, attribute_hash_scd2
            )
            SELECT x.estudiante_sk, x.member_type, x.technical_label, x.id_ra, x.id_alumno,
                x.id_sexo, x.estado_civil, x.nac_pais, x.id_colegio, x.colegio, x.tipo_colegio,
                x.turno_colegio, x.area_colegio, x.cod_localidad, x.localidad, x.cod_pais,
                x.cod_departamento, x.cod_provincia, x.gestion_egreso_colegio, x.fec_inscripcion,
                x.fec_egreso, x.estado_academico, x.tipo_alumno, p_run_id, clock_timestamp(),
                clock_timestamp(), x.valid_from, x.valid_to, x.is_current, x.attribute_hash_scd2
            FROM etl_work.hop_publication_row r
            CROSS JOIN LATERAL jsonb_populate_record(NULL::dw.dim_estudiante, r.record_data) x
            WHERE r.run_id = p_run_id AND r.target_code = v_target AND r.operation = 'INSERT';
        ELSE
            -- The five conforming dimensions are inserted/upserted by surrogate key.
            -- Updated column lists are explicit so created_at and primary keys remain immutable.
            CASE v_target
            WHEN 'DIM_PROGRAMA' THEN
                INSERT INTO dw.dim_programa
                SELECT (jsonb_populate_record(NULL::dw.dim_programa, r.record_data)).*
                FROM etl_work.hop_publication_row r
                WHERE r.run_id = p_run_id AND r.target_code = v_target AND r.operation IN ('INSERT','UPSERT')
                ON CONFLICT (programa_sk) DO UPDATE SET
                    member_type=EXCLUDED.member_type, technical_label=EXCLUDED.technical_label,
                    id_programa=EXCLUDED.id_programa, programa=EXCLUDED.programa,
                    id_facultad=EXCLUDED.id_facultad, facultad=EXCLUDED.facultad,
                    facultad_abreviatura=EXCLUDED.facultad_abreviatura, id_nivel=EXCLUDED.id_nivel,
                    nivel=EXCLUDED.nivel, sede=EXCLUDED.sede, tipo_academico=EXCLUDED.tipo_academico,
                    activo=EXCLUDED.activo, source_run_id=p_run_id, updated_at=clock_timestamp();
            WHEN 'DIM_MATERIA' THEN
                INSERT INTO dw.dim_materia
                SELECT (jsonb_populate_record(NULL::dw.dim_materia, r.record_data)).*
                FROM etl_work.hop_publication_row r
                WHERE r.run_id = p_run_id AND r.target_code = v_target AND r.operation IN ('INSERT','UPSERT')
                ON CONFLICT (materia_sk) DO UPDATE SET
                    member_type=EXCLUDED.member_type, technical_label=EXCLUDED.technical_label,
                    id_materia=EXCLUDED.id_materia, sigla=EXCLUDED.sigla, materia=EXCLUDED.materia,
                    id_programa=EXCLUDED.id_programa, id_plan=EXCLUDED.id_plan,
                    id_materia_padre=EXCLUDED.id_materia_padre, ciclo=EXCLUDED.ciclo,
                    nivel_academico=EXCLUDED.nivel_academico, horas_teoricas=EXCLUDED.horas_teoricas,
                    horas_practicas=EXCLUDED.horas_practicas, creditos=EXCLUDED.creditos,
                    source_run_id=p_run_id, updated_at=clock_timestamp();
            WHEN 'DIM_PERIODO_ACADEMICO' THEN
                INSERT INTO dw.dim_periodo_academico
                SELECT (jsonb_populate_record(NULL::dw.dim_periodo_academico, r.record_data)).*
                FROM etl_work.hop_publication_row r
                WHERE r.run_id = p_run_id AND r.target_code = v_target AND r.operation IN ('INSERT','UPSERT')
                ON CONFLICT (periodo_academico_sk) DO UPDATE SET
                    member_type=EXCLUDED.member_type, technical_label=EXCLUDED.technical_label,
                    gestion=EXCLUDED.gestion, periodo=EXCLUDED.periodo, closure_id=EXCLUDED.closure_id,
                    effective_at=EXCLUDED.effective_at, source_run_id=p_run_id,
                    updated_at=clock_timestamp();
            WHEN 'DIM_ADMISION' THEN
                INSERT INTO dw.dim_admision
                SELECT (jsonb_populate_record(NULL::dw.dim_admision, r.record_data)).*
                FROM etl_work.hop_publication_row r
                WHERE r.run_id = p_run_id AND r.target_code = v_target AND r.operation IN ('INSERT','UPSERT')
                ON CONFLICT (admision_sk) DO UPDATE SET
                    member_type=EXCLUDED.member_type, technical_label=EXCLUDED.technical_label,
                    id_acceso=EXCLUDED.id_acceso, source_run_id=p_run_id,
                    updated_at=clock_timestamp();
            END CASE;
        END IF;
    END LOOP;

    INSERT INTO dw.fact_admision (
        estudiante_sk, programa_sk, periodo_academico_sk, admision_sk, id_alumno_origen,
        id_programa_origen, id_gestion_origen, id_periodo_origen, conteo_postulacion,
        es_admitido, puntaje_examen, estado_origen, run_id
    )
    SELECT x.estudiante_sk, x.programa_sk, x.periodo_academico_sk, x.admision_sk,
        x.id_alumno_origen, x.id_programa_origen, x.id_gestion_origen, x.id_periodo_origen,
        x.conteo_postulacion, x.es_admitido, x.puntaje_examen, x.estado_origen, p_run_id
    FROM etl_work.hop_publication_row r
    CROSS JOIN LATERAL jsonb_populate_record(NULL::dw.fact_admision, r.record_data) x
    WHERE r.run_id = p_run_id AND r.target_code = 'FACT_ADMISION';
    INSERT INTO dw.fact_cursado (
        estudiante_sk, programa_sk, materia_sk, periodo_academico_sk, id_matricula_origen,
        grupo_degenerado, nota_final, nota_complementaria, nota_examen_mesa, nota_parcial_1,
        nota_parcial_2, nota_parcial_3, nota_parcial_4, estado_origen, es_aprobado,
        es_reprobado, es_abandono, es_repeticion, conteo_intento, run_id
    )
    SELECT x.estudiante_sk, x.programa_sk, x.materia_sk, x.periodo_academico_sk,
        x.id_matricula_origen, x.grupo_degenerado, x.nota_final, x.nota_complementaria,
        x.nota_examen_mesa, x.nota_parcial_1, x.nota_parcial_2, x.nota_parcial_3,
        x.nota_parcial_4, x.estado_origen, x.es_aprobado, x.es_reprobado,
        x.es_abandono, x.es_repeticion, x.conteo_intento, p_run_id
    FROM etl_work.hop_publication_row r
    CROSS JOIN LATERAL jsonb_populate_record(NULL::dw.fact_cursado, r.record_data) x
    WHERE r.run_id = p_run_id AND r.target_code = 'FACT_CURSADO';
    INSERT INTO dw.fact_retencion_desercion (
        estudiante_sk, programa_sk, periodo_academico_sk, closure_id, materias_cursadas,
        materias_aprobadas, materias_reprobadas, materias_arrastradas, ppa_acumulado,
        resultado_retencion, es_desercion, conteo_snapshot, conteo_evaluable,
        conteo_desercion, run_id
    )
    SELECT x.estudiante_sk, x.programa_sk, x.periodo_academico_sk, x.closure_id,
        x.materias_cursadas, x.materias_aprobadas, x.materias_reprobadas,
        x.materias_arrastradas, x.ppa_acumulado, x.resultado_retencion,
        x.es_desercion, x.conteo_snapshot, x.conteo_evaluable, x.conteo_desercion,
        p_run_id
    FROM etl_work.hop_publication_row r
    CROSS JOIN LATERAL jsonb_populate_record(NULL::dw.fact_retencion_desercion, r.record_data) x
    WHERE r.run_id = p_run_id AND r.target_code = 'FACT_RETENCION_DESERCION';

    PERFORM etl_control.register_etl_execution_step(
        p_run_id, 'atomic_dw_publish'::varchar(100), 'PUBLICACION'::varchar(20),
        'EXITOSO'::varchar(16), 90::smallint,
        'etl_control.publish_hop_staged_run'::text, 'dw-mvp-atomic-publisher-1'::varchar(255),
        jsonb_build_object('target_batches', cardinality(v_expected))
    );

    UPDATE etl_control.etl_execution_lock
    SET released_by = session_user, released_at = clock_timestamp(),
        release_reason = p_reason
    WHERE lock_id = v_lock.lock_id AND lock_token = p_lock_token
      AND released_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El lease de publicación no pudo liberarse';
    END IF;

    v_result := etl_control.complete_etl_execution(p_run_id, session_user::varchar(255), p_reason);

    IF v_run.closure_id IS NOT NULL THEN
        PERFORM etl_control.transition_academic_period_closure(
            v_run.requested_gestion, v_run.requested_periodo, 'PROCESADO',
            'system:hop-atomic-publisher', p_reason, NULL, p_run_id
        );
    END IF;

    DELETE FROM etl_work.hop_publication_row WHERE run_id = p_run_id;
    RETURN v_result;
END;
$$;

ALTER FUNCTION etl_control.reserve_hop_dimension_key(VARCHAR) OWNER TO dw_owner;
ALTER FUNCTION etl_control.stage_hop_publication_row(UUID, VARCHAR, BIGINT, VARCHAR, TEXT, JSONB) OWNER TO dw_owner;
ALTER FUNCTION etl_control.seal_hop_publication_batch(UUID, VARCHAR, BIGINT) OWNER TO dw_owner;
ALTER FUNCTION etl_control.publish_hop_staged_run(UUID, UUID, TEXT) OWNER TO dw_owner;

RESET ROLE;

REVOKE ALL ON FUNCTION etl_control.reserve_hop_dimension_key(VARCHAR),
    etl_control.stage_hop_publication_row(UUID, VARCHAR, BIGINT, VARCHAR, TEXT, JSONB),
    etl_control.seal_hop_publication_batch(UUID, VARCHAR, BIGINT),
    etl_control.publish_hop_staged_run(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION etl_work.hop_publication_batch_sha256(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etl_control.reserve_hop_dimension_key(VARCHAR),
    etl_control.stage_hop_publication_row(UUID, VARCHAR, BIGINT, VARCHAR, TEXT, JSONB),
    etl_control.seal_hop_publication_batch(UUID, VARCHAR, BIGINT),
    etl_control.publish_hop_staged_run(UUID, UUID, TEXT) TO dw_hop_runtime;

COMMENT ON FUNCTION etl_control.publish_hop_staged_run(UUID, UUID, TEXT) IS
    'Atomic Hop publisher. Revalidates and locks the fencing lease, applies eight sealed prepared batches, replaces only the requested fact scope, releases the lease and completes the execution in one transaction.';
COMMENT ON TABLE etl_work.hop_publication_row IS
    'Run-scoped prepared DW rows; access is only through the Hop staging API and payloads are removed atomically after successful publication.';
