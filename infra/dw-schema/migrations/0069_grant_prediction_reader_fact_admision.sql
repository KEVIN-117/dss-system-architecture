-- PRED-104/PRED-108: allow the read-only prediction DW role to read dw.fact_admision
-- for APPLICATIONS_BY_PROGRAM and ADMITTED_BY_PROGRAM forecasts.
DO $$
BEGIN
    IF to_regclass('dw.fact_admision') IS NULL THEN
        RAISE EXCEPTION '0069 requires dw.fact_admision';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dw_prediction_reader') THEN
        RAISE EXCEPTION '0069 requires the dw_prediction_reader role from 0031';
    END IF;
END;
$$;

GRANT SELECT ON TABLE dw.fact_admision TO dw_prediction_reader;
