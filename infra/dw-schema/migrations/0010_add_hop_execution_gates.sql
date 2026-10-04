-- DW-MVP-002: controlled Hop execution API, exact source gate, and fenced lease.
-- Apply after 0009. Existing migrations are immutable.

DO $$
BEGIN
    IF to_regclass('etl_control.etl_execution') IS NULL
       OR to_regclass('etl_control.etl_source_manifest') IS NULL
       OR to_regclass('etl_control.etl_execution_lock') IS NULL
       OR to_regclass('dw.fact_admision') IS NULL THEN
        RAISE EXCEPTION 'DW-004 and DW-MVP-001 migrations must be applied before DW-MVP-002';
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dw_hop_runtime') THEN
        CREATE ROLE dw_hop_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    END IF;
    ALTER ROLE dw_hop_runtime NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    IF EXISTS (
        SELECT 1 FROM pg_auth_members
        WHERE member = (SELECT oid FROM pg_roles WHERE rolname = 'dw_hop_runtime')
    ) THEN
        RAISE EXCEPTION 'dw_hop_runtime must not inherit membership in another role';
    END IF;
END;
$$;

SET ROLE dw_owner;

CREATE OR REPLACE FUNCTION etl_control.create_hop_etl_execution(
    p_run_id UUID,
    p_execution_kind VARCHAR(24),
    p_closure_id BIGINT DEFAULT NULL,
    p_requested_gestion SMALLINT DEFAULT NULL,
    p_requested_periodo SMALLINT DEFAULT NULL,
    p_requested_cut_at TIMESTAMPTZ DEFAULT NULL,
    p_retry_of_run_id UUID DEFAULT NULL,
    p_request_reason TEXT DEFAULT NULL
)
RETURNS etl_control.etl_execution
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_execution etl_control.etl_execution;
    v_parent etl_control.etl_execution;
    v_closure etl_control.academic_period_closure;
    v_last_success TIMESTAMPTZ;
    v_last_reopen TIMESTAMPTZ;
    v_actor TEXT := session_user;
BEGIN
    IF p_run_id IS NULL OR btrim(coalesce(v_actor, '')) = ''
       OR btrim(coalesce(p_request_reason, '')) = '' THEN
        RAISE EXCEPTION 'run_id, identidad de sesión y motivo son obligatorios'
            USING ERRCODE = '23514';
    END IF;

    IF p_execution_kind = 'HISTORICA' THEN
        IF p_closure_id IS NOT NULL OR p_retry_of_run_id IS NOT NULL THEN
            RAISE EXCEPTION 'HISTORICA no admite closure_id ni retry_of_run_id'
                USING ERRCODE = '23514';
        END IF;
        IF (p_requested_gestion IS NULL) <> (p_requested_periodo IS NULL)
           OR (p_requested_gestion IS NOT NULL AND
               (p_requested_gestion < 2000 OR p_requested_periodo <= 0)) THEN
            RAISE EXCEPTION 'El periodo histórico debe ser un par gestion/periodo válido'
                USING ERRCODE = '23514';
        END IF;
    ELSIF p_execution_kind = 'CIERRE_ACADEMICO' THEN
        IF p_closure_id IS NULL OR p_retry_of_run_id IS NOT NULL THEN
            RAISE EXCEPTION 'CIERRE_ACADEMICO requiere closure_id y no admite retry_of_run_id'
                USING ERRCODE = '23514';
        END IF;

        SELECT * INTO v_closure
        FROM etl_control.academic_period_closure
        WHERE closure_id = p_closure_id
        FOR UPDATE;

        IF NOT FOUND OR v_closure.status <> 'CERRADO'
           OR v_closure.effective_at > clock_timestamp()
           OR v_closure.processed_run_id IS NOT NULL THEN
            RAISE EXCEPTION 'El cierre académico no es elegible'
                USING ERRCODE = '23514';
        END IF;

        IF EXISTS (
            SELECT 1 FROM etl_control.etl_execution e
            WHERE e.closure_id = p_closure_id
              AND e.status IN ('SOLICITADA', 'EN_EJECUCION', 'PUBLICANDO', 'EXITOSA')
        ) THEN
            RAISE EXCEPTION 'El cierre ya tiene una ejecución activa o exitosa; cancele/falle el intento o reabra el cierre antes de reprocesar'
                USING ERRCODE = '23514';
        END IF;

        p_requested_gestion := v_closure.gestion;
        p_requested_periodo := v_closure.periodo;
        p_requested_cut_at := v_closure.effective_at;
    ELSIF p_execution_kind = 'REPROCESO' THEN
        IF p_retry_of_run_id IS NULL THEN
            RAISE EXCEPTION 'REPROCESO requiere retry_of_run_id' USING ERRCODE = '23514';
        END IF;

        SELECT * INTO v_parent
        FROM etl_control.etl_execution
        WHERE run_id = p_retry_of_run_id
        FOR KEY SHARE;

        IF NOT FOUND OR v_parent.status NOT IN ('EXITOSA', 'FALLIDA', 'CANCELADA') THEN
            RAISE EXCEPTION 'REPROCESO requiere una ejecución previa terminal'
                USING ERRCODE = '23514';
        END IF;

        IF v_parent.closure_id IS DISTINCT FROM p_closure_id THEN
            RAISE EXCEPTION 'El reproceso debe conservar el mismo closure_id que la ejecución anterior'
                USING ERRCODE = '23514';
        END IF;

        IF p_closure_id IS NULL THEN
            IF p_requested_gestion IS DISTINCT FROM v_parent.requested_gestion
               OR p_requested_periodo IS DISTINCT FROM v_parent.requested_periodo
               OR p_requested_cut_at IS DISTINCT FROM v_parent.requested_cut_at THEN
                RAISE EXCEPTION 'El reproceso global debe conservar el corte del intento anterior'
                    USING ERRCODE = '23514';
            END IF;
        END IF;

        IF EXISTS (
            SELECT 1 FROM etl_control.etl_execution e
            WHERE (
                    (p_closure_id IS NOT NULL AND e.closure_id = p_closure_id)
                 OR (p_closure_id IS NULL AND e.closure_id IS NULL
                     AND e.requested_gestion IS NOT DISTINCT FROM p_requested_gestion
                     AND e.requested_periodo IS NOT DISTINCT FROM p_requested_periodo
                     AND e.requested_cut_at IS NOT DISTINCT FROM p_requested_cut_at)
            )
              AND e.status IN ('SOLICITADA', 'EN_EJECUCION', 'PUBLICANDO')
        ) THEN
            RAISE EXCEPTION 'Ya existe otra ejecución activa para este alcance'
                USING ERRCODE = '23514';
        END IF;

        IF p_closure_id IS NOT NULL THEN
            SELECT * INTO v_closure
            FROM etl_control.academic_period_closure
            WHERE closure_id = p_closure_id
            FOR UPDATE;

            IF NOT FOUND OR v_closure.status <> 'CERRADO'
               OR v_closure.effective_at > clock_timestamp()
               OR v_closure.processed_run_id IS NOT NULL THEN
                RAISE EXCEPTION 'El cierre del reproceso debe estar cerrado, vigente y sin procesamiento vigente'
                    USING ERRCODE = '23514';
            END IF;

            SELECT max(ended_at) INTO v_last_success
            FROM etl_control.etl_execution
            WHERE closure_id = p_closure_id AND status = 'EXITOSA';

            IF v_last_success IS NOT NULL THEN
                SELECT max(occurred_at) INTO v_last_reopen
                FROM etl_control.academic_period_closure_event
                WHERE closure_id = p_closure_id
                  AND to_status = 'REABIERTO'
                  AND occurred_at > v_last_success;

                IF v_last_reopen IS NULL OR NOT EXISTS (
                    SELECT 1 FROM etl_control.academic_period_closure_event e
                    WHERE e.closure_id = p_closure_id
                      AND e.to_status = 'CERRADO'
                      AND e.occurred_at > v_last_reopen
                ) THEN
                    RAISE EXCEPTION 'El cierre con publicación previa debe reabrirse y volver a cerrarse antes del reproceso'
                        USING ERRCODE = '23514';
                END IF;
            END IF;

            p_requested_gestion := v_closure.gestion;
            p_requested_periodo := v_closure.periodo;
            p_requested_cut_at := v_closure.effective_at;
        ELSE
            IF (p_requested_gestion IS NULL) <> (p_requested_periodo IS NULL)
               OR (p_requested_gestion IS NOT NULL AND
                   (p_requested_gestion < 2000 OR p_requested_periodo <= 0)) THEN
                RAISE EXCEPTION 'El periodo del reproceso debe ser un par gestion/periodo válido'
                    USING ERRCODE = '23514';
            END IF;
        END IF;
    ELSE
        RAISE EXCEPTION 'execution_kind no reconocido: %', p_execution_kind
            USING ERRCODE = '23514';
    END IF;

    INSERT INTO etl_control.etl_execution (
        run_id, execution_kind, closure_id, retry_of_run_id, requested_gestion,
        requested_periodo, requested_cut_at, requested_by
    ) VALUES (
        p_run_id, p_execution_kind, p_closure_id, p_retry_of_run_id,
        p_requested_gestion, p_requested_periodo, p_requested_cut_at, v_actor
    ) RETURNING * INTO v_execution;

    INSERT INTO etl_control.etl_execution_event (
        run_id, previous_status, new_status, actor, reason
    ) VALUES (
        p_run_id, NULL, 'SOLICITADA', v_actor, p_request_reason
    );

    RETURN v_execution;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.start_hop_etl_execution(
    p_run_id UUID, p_reason TEXT
)
RETURNS etl_control.etl_execution
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
    SELECT etl_control.start_etl_execution(p_run_id, session_user::varchar(255), p_reason);
$$;

CREATE OR REPLACE FUNCTION etl_control.assert_hop_source_manifests(
    p_run_id UUID
)
RETURNS SMALLINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT count(*) INTO v_count
    FROM etl_control.etl_source_manifest m
    WHERE m.run_id = p_run_id;

    IF v_count <> 9 THEN
        RAISE EXCEPTION 'El flujo directo requiere exactamente nueve manifiestos; encontrados: %', v_count
            USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
        WITH expected(contract_id, source_schema, source_object) AS (
            VALUES
                ('public.uatf_datos', 'public', 'uatf_datos'),
                ('academico.alumnos', 'academico', 'alumnos'),
                ('public.postulantes', 'public', 'postulantes'),
                ('academico.alm_programas', 'academico', 'alm_programas'),
                ('academico.pln_materias', 'academico', 'pln_materias'),
                ('academico.notas_planilla', 'academico', 'notas_planilla'),
                ('academico.alm_programas_facultades', 'academico', 'alm_programas_facultades'),
                ('public.prs_colegios', 'public', 'prs_colegios'),
                ('public.lugar_localidad', 'public', 'lugar_localidad')
        )
        SELECT 1
        FROM expected e
        LEFT JOIN etl_control.etl_source_manifest m
          ON m.run_id = p_run_id AND m.source_contract_id = e.contract_id
        WHERE m.manifest_id IS NULL
           OR m.source_schema <> e.source_schema
           OR m.source_object <> e.source_object
           OR m.status <> 'COMPLETO'
           OR m.record_count IS NULL
           OR m.source_schema_sha256 IS NULL
    ) OR EXISTS (
        SELECT 1 FROM etl_control.etl_source_manifest m
        WHERE m.run_id = p_run_id
          AND m.source_contract_id NOT IN (
              'public.uatf_datos', 'academico.alumnos', 'public.postulantes',
              'academico.alm_programas', 'academico.pln_materias',
              'academico.notas_planilla', 'academico.alm_programas_facultades',
              'public.prs_colegios', 'public.lugar_localidad'
          )
    ) THEN
        RAISE EXCEPTION 'Falta un manifiesto completo esperado o hay un contrato fuente no autorizado'
            USING ERRCODE = '23514';
    END IF;

    RETURN 9;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.acquire_hop_publication_lock(
    p_run_id UUID,
    p_lease_seconds INTEGER DEFAULT 900
)
RETURNS etl_control.etl_execution_lock
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_status VARCHAR(16);
    v_old_lock etl_control.etl_execution_lock;
    v_lock etl_control.etl_execution_lock;
    v_actor TEXT := session_user;
BEGIN
    IF p_lease_seconds < 60 OR p_lease_seconds > 3600 THEN
        RAISE EXCEPTION 'El lease debe estar entre 60 y 3600 segundos' USING ERRCODE = '23514';
    END IF;

    PERFORM pg_advisory_xact_lock(2130706430, 1);

    SELECT status INTO v_status
    FROM etl_control.etl_execution
    WHERE run_id = p_run_id
    FOR UPDATE;

    IF NOT FOUND OR v_status <> 'EN_EJECUCION' THEN
        RAISE EXCEPTION 'Solo una ejecución EN_EJECUCION puede adquirir el lock de publicación'
            USING ERRCODE = '23514';
    END IF;

    FOR v_old_lock IN
        SELECT * FROM etl_control.etl_execution_lock
        WHERE resource_key = 'dw:mvp-publication'
          AND released_at IS NULL
          AND lease_expires_at <= clock_timestamp()
        FOR UPDATE
    LOOP
        IF EXISTS (
            SELECT 1 FROM etl_control.etl_execution
            WHERE run_id = v_old_lock.run_id AND status IN ('EN_EJECUCION', 'PUBLICANDO')
        ) THEN
            PERFORM etl_control.record_etl_execution_error(
                v_old_lock.run_id, 'ERROR', 'HOP_LOCK_LEASE_EXPIRED',
                'El lease de publicación venció antes de completar la ejecución',
                'La ejecución fue marcada FALLIDA al recuperar el lock expirado', TRUE, NULL,
                jsonb_build_object('resource_key', 'dw:mvp-publication')
            );
            PERFORM etl_control.fail_etl_execution(
                v_old_lock.run_id, 'system:hop-lock-reaper',
                'Lease de publicación expirado y recuperado por una ejecución posterior'
            );
        END IF;

        UPDATE etl_control.etl_execution_lock
        SET released_by = 'system:hop-lock-reaper',
            released_at = clock_timestamp(),
            release_reason = 'Lease expirado; recuperación controlada'
        WHERE lock_id = v_old_lock.lock_id;
    END LOOP;

    INSERT INTO etl_control.etl_execution_lock (
        run_id, resource_key, lock_token, acquired_by, lease_expires_at
    ) VALUES (
        p_run_id, 'dw:mvp-publication', gen_random_uuid(), v_actor,
        clock_timestamp() + make_interval(secs => p_lease_seconds)
    ) RETURNING * INTO v_lock;

    RETURN v_lock;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.renew_hop_publication_lock(
    p_run_id UUID,
    p_lock_token UUID,
    p_lease_seconds INTEGER DEFAULT 900
)
RETURNS etl_control.etl_execution_lock
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_lock etl_control.etl_execution_lock;
BEGIN
    IF p_lease_seconds < 60 OR p_lease_seconds > 3600 THEN
        RAISE EXCEPTION 'El lease debe estar entre 60 y 3600 segundos' USING ERRCODE = '23514';
    END IF;
    PERFORM pg_advisory_xact_lock(2130706430, 1);

    UPDATE etl_control.etl_execution_lock
    SET lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds)
    WHERE run_id = p_run_id
      AND resource_key = 'dw:mvp-publication'
      AND lock_token = p_lock_token
      AND released_at IS NULL
      AND lease_expires_at > clock_timestamp()
    RETURNING * INTO v_lock;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lock inexistente, vencido o ajeno a esta ejecución'
            USING ERRCODE = '55P03';
    END IF;
    RETURN v_lock;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.release_hop_publication_lock(
    p_run_id UUID,
    p_lock_token UUID,
    p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
BEGIN
    IF btrim(coalesce(p_reason, '')) = '' THEN
        RAISE EXCEPTION 'La liberación requiere motivo' USING ERRCODE = '23514';
    END IF;
    PERFORM pg_advisory_xact_lock(2130706430, 1);

    UPDATE etl_control.etl_execution_lock
    SET released_by = session_user,
        released_at = clock_timestamp(),
        release_reason = p_reason
    WHERE run_id = p_run_id
      AND resource_key = 'dw:mvp-publication'
      AND lock_token = p_lock_token
      AND released_at IS NULL
      AND lease_expires_at > clock_timestamp();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se liberó el lock: token inválido, lease vencido o lock ya liberado'
            USING ERRCODE = '55P03';
    END IF;
    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.begin_hop_publication(
    p_run_id UUID,
    p_lock_token UUID,
    p_reason TEXT
)
RETURNS etl_control.etl_execution
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM etl_control.etl_execution_lock l
        WHERE l.run_id = p_run_id
          AND l.resource_key = 'dw:mvp-publication'
          AND l.lock_token = p_lock_token
          AND l.released_at IS NULL
          AND l.lease_expires_at > clock_timestamp()
    ) THEN
        RAISE EXCEPTION 'Se requiere el lock de publicación activo de esta ejecución'
            USING ERRCODE = '55P03';
    END IF;

    PERFORM etl_control.assert_hop_source_manifests(p_run_id);
    RETURN etl_control.begin_etl_publication(p_run_id, session_user::varchar(255), p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.fail_hop_etl_execution(
    p_run_id UUID, p_reason TEXT
)
RETURNS etl_control.etl_execution
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
    SELECT etl_control.fail_etl_execution(p_run_id, session_user::varchar(255), p_reason);
$$;

ALTER FUNCTION etl_control.create_hop_etl_execution(UUID, VARCHAR, BIGINT, SMALLINT, SMALLINT, TIMESTAMPTZ, UUID, TEXT) OWNER TO dw_owner;
ALTER FUNCTION etl_control.start_hop_etl_execution(UUID, TEXT) OWNER TO dw_owner;
ALTER FUNCTION etl_control.assert_hop_source_manifests(UUID) OWNER TO dw_owner;
ALTER FUNCTION etl_control.acquire_hop_publication_lock(UUID, INTEGER) OWNER TO dw_owner;
ALTER FUNCTION etl_control.renew_hop_publication_lock(UUID, UUID, INTEGER) OWNER TO dw_owner;
ALTER FUNCTION etl_control.release_hop_publication_lock(UUID, UUID, TEXT) OWNER TO dw_owner;
ALTER FUNCTION etl_control.begin_hop_publication(UUID, UUID, TEXT) OWNER TO dw_owner;
ALTER FUNCTION etl_control.fail_hop_etl_execution(UUID, TEXT) OWNER TO dw_owner;

RESET ROLE;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA etl_control FROM PUBLIC;
DO $$
BEGIN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO dw_hop_runtime', current_database());
END;
$$;
GRANT USAGE ON SCHEMA etl_control TO dw_hop_runtime;
GRANT SELECT ON etl_control.etl_execution,
    etl_control.etl_execution_event,
    etl_control.etl_execution_step,
    etl_control.etl_execution_metric,
    etl_control.etl_execution_error,
    etl_control.etl_source_manifest TO dw_hop_runtime;

GRANT EXECUTE ON FUNCTION etl_control.create_hop_etl_execution(UUID, VARCHAR, BIGINT, SMALLINT, SMALLINT, TIMESTAMPTZ, UUID, TEXT),
    etl_control.start_hop_etl_execution(UUID, TEXT),
    etl_control.register_etl_execution_step(UUID, VARCHAR, VARCHAR, VARCHAR, SMALLINT, TEXT, VARCHAR, JSONB),
    etl_control.record_etl_execution_metric(UUID, VARCHAR, NUMERIC, VARCHAR, BIGINT, JSONB),
    etl_control.record_etl_execution_error(UUID, VARCHAR, VARCHAR, TEXT, TEXT, BOOLEAN, BIGINT, JSONB),
    etl_control.register_etl_source_manifest(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, CHAR, TEXT, VARCHAR, CHAR, SMALLINT, SMALLINT, TIMESTAMPTZ, BIGINT, JSONB),
    etl_control.acquire_hop_publication_lock(UUID, INTEGER),
    etl_control.renew_hop_publication_lock(UUID, UUID, INTEGER),
    etl_control.release_hop_publication_lock(UUID, UUID, TEXT),
    etl_control.begin_hop_publication(UUID, UUID, TEXT),
    etl_control.fail_hop_etl_execution(UUID, TEXT)
TO dw_hop_runtime;

COMMENT ON ROLE dw_hop_runtime IS
    'NOLOGIN least-privilege group for Apache Hop. DBA provisions a LOGIN separately; no direct DML on etl_control or dw is granted by this migration.';
COMMENT ON FUNCTION etl_control.create_hop_etl_execution(UUID, VARCHAR, BIGINT, SMALLINT, SMALLINT, TIMESTAMPTZ, UUID, TEXT) IS
    'Creates a Hop execution using session_user as audited actor; validates closure and retry eligibility atomically.';
COMMENT ON FUNCTION etl_control.assert_hop_source_manifests(UUID) IS
    'Internal gate requiring the exact nine approved DW-001 contracts, complete with counts and source schema hashes.';
COMMENT ON FUNCTION etl_control.begin_hop_publication(UUID, UUID, TEXT) IS
    'Hop-only publication gate: validates the active fencing token and exact nine-source manifest set before entering PUBLICANDO.';
