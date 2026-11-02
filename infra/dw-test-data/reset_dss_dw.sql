-- Reset de datos del DW local de desarrollo para pruebas reproducibles.
-- Conserva esquemas, roles/permisos y etl_control.schema_migration.
-- Rechaza cualquier base distinta de dss_dw y cualquier run ETL activo.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
    v_tables TEXT;
BEGIN
    IF current_database() <> 'dss_dw' THEN
        RAISE EXCEPTION 'Reset rechazado: se esperaba dss_dw, base actual: %', current_database();
    END IF;
    IF EXISTS (
        SELECT 1 FROM etl_control.etl_execution
        WHERE status IN ('SOLICITADA', 'EN_EJECUCION', 'PUBLICANDO')
    ) THEN
        RAISE EXCEPTION 'Reset rechazado: hay ejecuciones ETL activas';
    END IF;

    SELECT string_agg(format('%I.%I', schemaname, tablename), ', ' ORDER BY schemaname, tablename)
    INTO v_tables
    FROM pg_tables
    WHERE schemaname IN ('dw', 'etl_control', 'etl_work', 'staging', 'ml_workspace')
      AND NOT (schemaname = 'etl_control' AND tablename = 'schema_migration');

    IF v_tables IS NULL THEN
        RAISE EXCEPTION 'No se encontraron tablas de datos para limpiar';
    END IF;

    EXECUTE 'TRUNCATE TABLE ' || v_tables || ' RESTART IDENTITY CASCADE';
END;
$$;

INSERT INTO dw.dim_estudiante (estudiante_sk, member_type, technical_label)
VALUES (-1, 'UNKNOWN', 'Desconocido'), (0, 'NOT_APPLICABLE', 'No aplica');
INSERT INTO dw.dim_programa (programa_sk, member_type, technical_label)
VALUES (-1, 'UNKNOWN', 'Desconocido'), (0, 'NOT_APPLICABLE', 'No aplica');
INSERT INTO dw.dim_materia (materia_sk, member_type, technical_label)
VALUES (-1, 'UNKNOWN', 'Desconocido'), (0, 'NOT_APPLICABLE', 'No aplica');
INSERT INTO dw.dim_periodo_academico (periodo_academico_sk, member_type, technical_label)
VALUES (-1, 'UNKNOWN', 'Desconocido'), (0, 'NOT_APPLICABLE', 'No aplica');
INSERT INTO dw.dim_admision (admision_sk, member_type, technical_label)
VALUES (-1, 'UNKNOWN', 'Desconocido'), (0, 'NOT_APPLICABLE', 'No aplica');

DO $$
BEGIN
    IF (SELECT count(*) FROM dw.dim_estudiante) <> 2
       OR (SELECT count(*) FROM dw.dim_programa) <> 2
       OR (SELECT count(*) FROM dw.dim_materia) <> 2
       OR (SELECT count(*) FROM dw.dim_periodo_academico) <> 2
       OR (SELECT count(*) FROM dw.dim_admision) <> 2
       OR (SELECT count(*) FROM etl_control.schema_migration) <> 30 THEN
        RAISE EXCEPTION 'Reset incompleto: revise miembros técnicos y registro de migraciones';
    END IF;
END;
$$;

COMMIT;

SELECT 'dim_estudiante' AS objeto, count(*) AS filas FROM dw.dim_estudiante
UNION ALL SELECT 'dim_programa', count(*) FROM dw.dim_programa
UNION ALL SELECT 'dim_materia', count(*) FROM dw.dim_materia
UNION ALL SELECT 'dim_periodo_academico', count(*) FROM dw.dim_periodo_academico
UNION ALL SELECT 'dim_admision', count(*) FROM dw.dim_admision
UNION ALL SELECT 'fact_admision', count(*) FROM dw.fact_admision
UNION ALL SELECT 'fact_cursado', count(*) FROM dw.fact_cursado
UNION ALL SELECT 'fact_retencion_desercion', count(*) FROM dw.fact_retencion_desercion;

