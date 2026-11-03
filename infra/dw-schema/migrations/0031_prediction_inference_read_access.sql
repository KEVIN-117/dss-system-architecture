-- PRED-006: use a dedicated read-only role for point-in-time feature resolution.
DO $$
BEGIN
    IF to_regclass('dw.fact_cursado') IS NULL
       OR to_regclass('dw.fact_retencion_desercion') IS NULL
       OR to_regclass('dw.dim_estudiante') IS NULL
       OR to_regclass('dw.dim_programa') IS NULL
       OR to_regclass('dw.dim_periodo_academico') IS NULL
       OR to_regclass('etl_control.academic_period_closure') IS NULL
       OR to_regclass('etl_control.etl_execution') IS NULL THEN
        RAISE EXCEPTION 'PRED-006 requires the current DW schema';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dw_prediction_reader') THEN
        CREATE ROLE dw_prediction_reader NOLOGIN;
    END IF;
END;
$$;

GRANT USAGE ON SCHEMA dw, etl_control TO dw_prediction_reader;
GRANT SELECT ON TABLE
    dw.fact_cursado,
    dw.fact_retencion_desercion,
    dw.dim_estudiante,
    dw.dim_programa,
    dw.dim_periodo_academico,
    etl_control.academic_period_closure,
    etl_control.etl_execution
TO dw_prediction_reader;
