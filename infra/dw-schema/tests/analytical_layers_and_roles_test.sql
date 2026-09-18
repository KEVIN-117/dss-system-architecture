-- DW-003 integration test. Run after scripts/apply-migrations.sh.

BEGIN;

CREATE ROLE dw_untrusted_test NOLOGIN;

DO $$
DECLARE
    v_schema TEXT;
    v_role TEXT;
BEGIN
    FOREACH v_schema IN ARRAY ARRAY['staging', 'etl_work', 'etl_control', 'dw', 'ml_workspace'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = v_schema) THEN
            RAISE EXCEPTION 'No existe el esquema esperado: %', v_schema;
        END IF;

        IF (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname = v_schema) <> 'dw_owner' THEN
            RAISE EXCEPTION 'El esquema % no pertenece a dw_owner', v_schema;
        END IF;
    END LOOP;

    FOREACH v_role IN ARRAY ARRAY[
        'dw_owner', 'dw_staging_writer', 'dw_transformer', 'dw_control_operator',
        'dw_publisher', 'dw_ml_writer', 'dw_reader'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_roles
            WHERE rolname = v_role
              AND NOT rolcanlogin
              AND NOT rolsuper
              AND NOT rolcreaterole
              AND NOT rolcreatedb
        ) THEN
            RAISE EXCEPTION 'Rol ausente o con privilegios administrativos: %', v_role;
        END IF;
    END LOOP;

    IF NOT has_schema_privilege('dw_staging_writer', 'staging', 'USAGE')
       OR has_schema_privilege('dw_staging_writer', 'dw', 'USAGE')
       OR NOT has_schema_privilege('dw_reader', 'dw', 'USAGE')
       OR has_schema_privilege('dw_reader', 'staging', 'USAGE')
       OR has_schema_privilege('dw_untrusted_test', 'staging', 'USAGE') THEN
        RAISE EXCEPTION 'La matriz de USAGE por esquema no cumple mínimo privilegio';
    END IF;

    IF NOT has_table_privilege('dw_control_operator', 'etl_control.academic_period_closure', 'INSERT')
       OR has_table_privilege('dw_control_operator', 'etl_control.academic_period_closure', 'UPDATE')
       OR NOT has_table_privilege('dw_control_operator', 'etl_control.academic_period_closure_event', 'SELECT') THEN
        RAISE EXCEPTION 'Los privilegios de operación de cierres son incorrectos';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM etl_control.schema_migration
        WHERE version = '0001'
          AND checksum_sha256 = '0e38be04cd827406c5391d1528edb6321cad502469d827ed92dba9a2e742f554'
    ) OR NOT EXISTS (
        SELECT 1
        FROM etl_control.schema_migration
        WHERE version = '0002'
    ) THEN
        RAISE EXCEPTION 'El historial de migraciones no contiene las bases esperadas';
    END IF;
END;
$$;

SET LOCAL ROLE dw_control_operator;

INSERT INTO etl_control.academic_period_closure (
    gestion, periodo, created_by_subject, closure_reason
) VALUES (
    2031, 8, 'dsa:role-test', 'Prueba de operador con privilegios mínimos'
);

SELECT etl_control.transition_academic_period_closure(
    2031::smallint,
    8::smallint,
    'CERRADO'::varchar(16),
    'dsa:role-test'::varchar(255),
    'Cierre autorizado de prueba'::text,
    '2031-11-30 18:00:00-04'::timestamptz
);

RESET ROLE;

DO $$
BEGIN
    IF (SELECT status FROM etl_control.academic_period_closure
        WHERE gestion = 2031 AND periodo = 8) <> 'CERRADO'
       OR (SELECT COUNT(*) FROM etl_control.academic_period_closure_event e
           JOIN etl_control.academic_period_closure c ON c.closure_id = e.closure_id
           WHERE c.gestion = 2031 AND c.periodo = 8) <> 2 THEN
        RAISE EXCEPTION 'El operador de control no pudo operar el cierre con privilegios mínimos';
    END IF;
END;
$$;

SET LOCAL ROLE dw_owner;
CREATE TABLE staging.permission_fixture (fixture_id BIGSERIAL PRIMARY KEY);
RESET ROLE;

DO $$
BEGIN
    IF NOT has_table_privilege('dw_staging_writer', 'staging.permission_fixture', 'INSERT')
       OR NOT has_table_privilege('dw_transformer', 'staging.permission_fixture', 'SELECT')
       OR has_table_privilege('dw_reader', 'staging.permission_fixture', 'SELECT')
       OR has_table_privilege('dw_untrusted_test', 'staging.permission_fixture', 'SELECT') THEN
        RAISE EXCEPTION 'Los privilegios por defecto de staging son incorrectos';
    END IF;
END;
$$;

ROLLBACK;
