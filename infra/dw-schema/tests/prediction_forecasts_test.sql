-- PRED-104 (0068): forecast runs and points, constraints and runtime grants.
DO $$
DECLARE
    v_rejected BOOLEAN;
BEGIN
    IF to_regclass('ml_workspace.forecast_run') IS NULL OR to_regclass('ml_workspace.forecast_point') IS NULL THEN
        RAISE EXCEPTION 'PRED-104 forecast tables are missing';
    END IF;
    IF NOT has_table_privilege('dw_prediction_runtime', 'ml_workspace.forecast_run', 'INSERT')
       OR NOT has_table_privilege('dw_prediction_runtime', 'ml_workspace.forecast_point', 'SELECT')
       OR has_table_privilege('dw_reader', 'ml_workspace.forecast_run', 'SELECT') THEN
        RAISE EXCEPTION 'Forecast tables have the wrong grants';
    END IF;

    INSERT INTO ml_workspace.forecast_run
        (run_id, job_id, series_code, program_ref, cadence, horizon, model_kind, model, selection, backtest,
         history_points, created_by)
    VALUES ('00000000-0000-4000-8000-000000001041', '00000000-0000-4000-8000-000000001040',
            'APPLICATIONS_BY_PROGRAM', 'SIS', 'SEMESTRAL', 2, 'linear_trend', '{}', '{}', '{}', 6, 'tester');
    INSERT INTO ml_workspace.forecast_point (run_id, year, period, point_kind, horizon, value)
    VALUES ('00000000-0000-4000-8000-000000001041', 2024, 1, 'HISTORY', NULL, 120);
    INSERT INTO ml_workspace.forecast_point
        (run_id, year, period, point_kind, horizon, value, lower_80, upper_80, lower_95, upper_95)
    VALUES ('00000000-0000-4000-8000-000000001041', 2025, 1, 'FORECAST', 1, 130, 120, 140, 110, 150);

    v_rejected := FALSE;
    BEGIN
        INSERT INTO ml_workspace.forecast_point
            (run_id, year, period, point_kind, horizon, value, lower_80, upper_80, lower_95, upper_95)
        VALUES ('00000000-0000-4000-8000-000000001041', 2025, 2, 'FORECAST', 2, 130, 140, 120, 110, 150);
    EXCEPTION WHEN check_violation THEN
        v_rejected := TRUE;
    END;
    IF NOT v_rejected THEN
        RAISE EXCEPTION 'Inverted forecast bands must be rejected';
    END IF;

    v_rejected := FALSE;
    BEGIN
        INSERT INTO ml_workspace.forecast_run
            (run_id, job_id, series_code, program_ref, cadence, horizon, model_kind, model, selection, backtest,
             history_points, created_by)
        VALUES ('00000000-0000-4000-8000-000000001042', '00000000-0000-4000-8000-000000001040',
                'STUDENTS_BY_FACULTY', 'SIS', 'SEMESTRAL', 2, 'linear_trend', '{}', '{}', '{}', 6, 'tester');
    EXCEPTION WHEN check_violation THEN
        v_rejected := TRUE;
    END;
    IF NOT v_rejected THEN
        RAISE EXCEPTION 'Unknown forecast series must be rejected';
    END IF;

    DELETE FROM ml_workspace.forecast_run WHERE run_id = '00000000-0000-4000-8000-000000001041';
    IF EXISTS (SELECT 1 FROM ml_workspace.forecast_point WHERE run_id = '00000000-0000-4000-8000-000000001041') THEN
        RAISE EXCEPTION 'Forecast points must be removed with their run';
    END IF;
END;
$$;

SELECT 'PRED-104 forecast runs, points, bands and grants are valid' AS result;
