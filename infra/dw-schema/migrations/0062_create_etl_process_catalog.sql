-- LM-002 (#350): Load Manager catalog of the Hop workflows that the admin
-- portal may launch through dw-control-service and Hop Server (LM-001).
-- The parameter contract mirrors EXECUTABLE_WORKFLOWS in
-- etl-layer/apache-hop/scripts/validate_project.py and
-- docs/dw/hop-server-contract.md; change them together.

DO $$
BEGIN
    IF to_regclass('etl_control.schema_migration') IS NULL
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dw_owner') THEN
        RAISE EXCEPTION '0062 requires the etl_control schema and dw_owner';
    END IF;
END;
$$;

SET ROLE dw_owner;

CREATE TABLE IF NOT EXISTS etl_control.etl_process (
    process_code VARCHAR(32) PRIMARY KEY,
    display_name VARCHAR(120) NOT NULL,
    description TEXT NOT NULL,
    -- Relative to the Hop project home; Hop Server resolves it as
    -- ${PROJECT_HOME}/<workflow_file>.
    workflow_file VARCHAR(255) NOT NULL UNIQUE,
    -- Exact Hop parameters dw-control-service may send for this workflow.
    parameter_names TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    -- NULL: the process cannot be scheduled (manual only).
    schedule_mode VARCHAR(32) NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT ck_etl_process_code CHECK (process_code ~ '^[A-Z][A-Z0-9_]{1,31}$'),
    CONSTRAINT ck_etl_process_display_name CHECK (btrim(display_name) <> ''),
    CONSTRAINT ck_etl_process_workflow_file CHECK (workflow_file ~ '^workflows/[a-z0-9_]+\.hwf$'),
    CONSTRAINT ck_etl_process_parameter_names CHECK (
        array_position(parameter_names, NULL) IS NULL
        AND parameter_names <@ ARRAY[
            'P_RUN_ID', 'P_REQUESTED_GESTION', 'P_REQUESTED_PERIODO',
            'P_EXECUTION_KIND', 'P_RETRY_OF_RUN_ID'
        ]::TEXT[]
    ),
    CONSTRAINT ck_etl_process_schedule_mode CHECK (
        schedule_mode IS NULL OR schedule_mode IN ('AUTO_PENDING_CLOSURES', 'NO_PARAMETERS')
    )
);

INSERT INTO etl_control.etl_process (
    process_code, display_name, description, workflow_file, parameter_names, schedule_mode
) VALUES
    (
        'VERTICAL_LOAD',
        'Carga vertical del DW',
        'Extrae las nueve fuentes de Jachasun, construye dimensiones y hechos y publica atómicamente un periodo académico cerrado.',
        'workflows/wf_vertical_uatf_datos_smoke.hwf',
        ARRAY['P_RUN_ID', 'P_REQUESTED_GESTION', 'P_REQUESTED_PERIODO', 'P_EXECUTION_KIND', 'P_RETRY_OF_RUN_ID'],
        'AUTO_PENDING_CLOSURES'
    ),
    (
        'CATALOG_SYNC',
        'Sincronización del catálogo académico',
        'Sincroniza facultades y programas de Jachasun con el catálogo de Auth Service.',
        'workflows/wf_sync_academic_catalog.hwf',
        ARRAY[]::TEXT[],
        'NO_PARAMETERS'
    ),
    (
        'PUBLISH_STAGED',
        'Publicación de una ejecución preparada',
        'Reintenta la publicación atómica de una ejecución cuyo staging ya está sellado.',
        'workflows/wf_hop_publish_staged_run.hwf',
        ARRAY['P_RUN_ID'],
        NULL
    )
ON CONFLICT (process_code) DO NOTHING;

RESET ROLE;

ALTER TABLE etl_control.etl_process OWNER TO dw_owner;

COMMENT ON TABLE etl_control.etl_process IS
    'Load Manager: workflows del proyecto Hop que el admin-portal puede ejecutar o programar.';
COMMENT ON COLUMN etl_control.etl_process.workflow_file IS
    'Ruta relativa al PROJECT_HOME del proyecto Hop dss-uatf-etl.';
COMMENT ON COLUMN etl_control.etl_process.parameter_names IS
    'Parámetros Hop exactos que dw-control-service puede enviar al workflow.';
COMMENT ON COLUMN etl_control.etl_process.schedule_mode IS
    'Modo de programación permitido; NULL si el proceso solo se ejecuta manualmente.';
