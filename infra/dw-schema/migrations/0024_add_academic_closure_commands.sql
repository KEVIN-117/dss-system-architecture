-- DW-CONTROL-004: expose narrowly scoped, audited closure commands to the API.
-- Runtime LOGINs and their passwords are provisioned separately by TI/DBA.

DO $$
BEGIN
    IF to_regclass('etl_control.academic_period_closure') IS NULL
       OR to_regclass('etl_control.academic_period_closure_event') IS NULL
       OR to_regprocedure(
            'etl_control.transition_academic_period_closure(smallint,smallint,character varying,character varying,text,timestamp with time zone,uuid)'
       ) IS NULL THEN
        RAISE EXCEPTION '0024 requires the academic closure calendar and transition function';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dw_owner')
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dw_control_reader') THEN
        RAISE EXCEPTION '0024 requires dw_owner and dw_control_reader roles';
    END IF;
END;
$$;

DO $$
DECLARE
    v_role TEXT;
BEGIN
    FOREACH v_role IN ARRAY ARRAY['dw_control_api', 'dw_control_service'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role) THEN
            EXECUTE format(
                'CREATE ROLE %I NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
                v_role
            );
        END IF;
        EXECUTE format(
            'ALTER ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
            v_role
        );
    END LOOP;
END;
$$;

ALTER ROLE dw_control_api NOINHERIT;
ALTER ROLE dw_control_service INHERIT;

GRANT dw_control_reader, dw_control_api TO dw_control_service;

DO $$
DECLARE
    v_database TEXT := current_database();
BEGIN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO dw_control_service', v_database);
END;
$$;

SET ROLE dw_owner;

CREATE OR REPLACE FUNCTION etl_control.create_academic_period_closure(
    p_gestion SMALLINT,
    p_periodo SMALLINT,
    p_actor_subject VARCHAR(255),
    p_reason TEXT
)
RETURNS etl_control.academic_period_closure
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_closure etl_control.academic_period_closure;
BEGIN
    IF p_gestion IS NULL OR p_gestion < 2000 OR p_periodo IS NULL OR p_periodo <= 0 THEN
        RAISE EXCEPTION 'La gestión y el periodo deben ser válidos'
            USING ERRCODE = '22023';
    END IF;

    IF btrim(COALESCE(p_actor_subject, '')) = '' OR btrim(COALESCE(p_reason, '')) = '' THEN
        RAISE EXCEPTION 'El actor y el motivo son obligatorios'
            USING ERRCODE = '22023';
    END IF;
    IF length(p_reason) > 2000 THEN
        RAISE EXCEPTION 'El motivo excede el máximo permitido'
            USING ERRCODE = '22023';
    END IF;

    INSERT INTO etl_control.academic_period_closure (
        gestion, periodo, status, created_by_subject, closure_reason
    ) VALUES (
        p_gestion, p_periodo, 'PENDIENTE', p_actor_subject, p_reason
    )
    RETURNING * INTO v_closure;

    RETURN v_closure;
END;
$$;

CREATE OR REPLACE FUNCTION etl_control.request_academic_period_closure_transition(
    p_closure_id BIGINT,
    p_to_status VARCHAR(16),
    p_actor_subject VARCHAR(255),
    p_reason TEXT,
    p_effective_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS etl_control.academic_period_closure
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, etl_control
AS $$
DECLARE
    v_gestion SMALLINT;
    v_periodo SMALLINT;
    v_closure etl_control.academic_period_closure;
BEGIN
    IF p_closure_id IS NULL OR p_closure_id <= 0 THEN
        RAISE EXCEPTION 'El identificador del cierre debe ser válido'
            USING ERRCODE = '22023';
    END IF;

    IF p_to_status IS NULL OR p_to_status NOT IN ('CERRADO', 'REABIERTO') THEN
        RAISE EXCEPTION 'La API solo puede cerrar o reabrir un periodo'
            USING ERRCODE = '22023';
    END IF;

    IF btrim(COALESCE(p_actor_subject, '')) = '' OR btrim(COALESCE(p_reason, '')) = '' THEN
        RAISE EXCEPTION 'El actor y el motivo son obligatorios'
            USING ERRCODE = '22023';
    END IF;
    IF length(p_reason) > 2000 THEN
        RAISE EXCEPTION 'El motivo excede el máximo permitido'
            USING ERRCODE = '22023';
    END IF;

    IF p_to_status = 'CERRADO' AND p_effective_at IS NULL THEN
        RAISE EXCEPTION 'CERRADO requiere fecha efectiva'
            USING ERRCODE = '22023';
    END IF;

    IF p_to_status = 'REABIERTO' AND p_effective_at IS NOT NULL THEN
        RAISE EXCEPTION 'REABIERTO no acepta fecha efectiva'
            USING ERRCODE = '22023';
    END IF;

    SELECT closure.gestion, closure.periodo
    INTO v_gestion, v_periodo
    FROM etl_control.academic_period_closure AS closure
    WHERE closure.closure_id = p_closure_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe el cierre académico solicitado'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT transitioned.*
    INTO v_closure
    FROM etl_control.transition_academic_period_closure(
        v_gestion,
        v_periodo,
        p_to_status,
        p_actor_subject,
        p_reason,
        p_effective_at,
        NULL
    ) AS transitioned;

    RETURN v_closure;
END;
$$;

RESET ROLE;

REVOKE ALL ON FUNCTION etl_control.create_academic_period_closure(SMALLINT, SMALLINT, VARCHAR, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION etl_control.request_academic_period_closure_transition(BIGINT, VARCHAR, VARCHAR, TEXT, TIMESTAMPTZ)
    FROM PUBLIC;

GRANT USAGE ON SCHEMA etl_control TO dw_control_api;
GRANT EXECUTE ON FUNCTION etl_control.create_academic_period_closure(SMALLINT, SMALLINT, VARCHAR, TEXT)
    TO dw_control_api;
GRANT EXECUTE ON FUNCTION etl_control.request_academic_period_closure_transition(BIGINT, VARCHAR, VARCHAR, TEXT, TIMESTAMPTZ)
    TO dw_control_api;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON etl_control.academic_period_closure, etl_control.academic_period_closure_event
    FROM dw_control_api, dw_control_service;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA etl_control FROM dw_control_api, dw_control_service;

DO $$
DECLARE
    v_create_function REGPROCEDURE :=
        'etl_control.create_academic_period_closure(smallint,smallint,character varying,text)'::REGPROCEDURE;
    v_transition_function REGPROCEDURE :=
        'etl_control.request_academic_period_closure_transition(bigint,character varying,character varying,text,timestamp with time zone)'::REGPROCEDURE;
BEGIN
    IF NOT has_function_privilege('dw_control_service', v_create_function, 'EXECUTE')
       OR NOT has_function_privilege('dw_control_service', v_transition_function, 'EXECUTE')
       OR has_table_privilege('dw_control_service', 'etl_control.academic_period_closure', 'INSERT')
       OR has_table_privilege('dw_control_service', 'etl_control.academic_period_closure', 'UPDATE')
       OR has_table_privilege('dw_control_service', 'etl_control.academic_period_closure_event', 'INSERT')
       OR has_table_privilege('dw_control_service', 'etl_control.academic_period_closure_event', 'UPDATE')
       OR has_function_privilege(
            'dw_control_service',
            'etl_control.transition_academic_period_closure(smallint,smallint,character varying,character varying,text,timestamp with time zone,uuid)'::REGPROCEDURE,
            'EXECUTE'
       ) THEN
        RAISE EXCEPTION 'dw_control_service must use only the scoped audited closure command functions';
    END IF;
END;
$$;

COMMENT ON ROLE dw_control_api IS
    'NOLOGIN role for narrowly scoped audited closure commands; no direct table writes.';
COMMENT ON ROLE dw_control_service IS
    'NOLOGIN composition of closure read and command grants for the dedicated service LOGIN.';
