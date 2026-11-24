-- PRED-104 (#373): program forecasts of applications, admitted applicants and
-- enrolled students.
--
-- * forecast_run   one immutable row per series, program and FORECAST job: the
--                  fitted linear model, why it was selected and its
--                  rolling-origin backtest.
-- * forecast_point the observed history (point_kind HISTORY) and the
--                  projection (FORECAST) with 80 % / 95 % bands.
--
-- The published forecast of a series and program is its latest run. Rows are
-- aggregates by program and period; no student data is stored.

DO $$
BEGIN
    IF to_regclass('ml_workspace.training_job') IS NULL THEN
        RAISE EXCEPTION '0068 requires ml_workspace.training_job from 0026';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dw_prediction_runtime') THEN
        RAISE EXCEPTION '0068 requires the dw_prediction_runtime role from 0026';
    END IF;
END;
$$;

SET ROLE dw_owner;

CREATE TABLE ml_workspace.forecast_run (
    run_id UUID PRIMARY KEY,
    job_id UUID NOT NULL,
    series_code TEXT NOT NULL
        CONSTRAINT forecast_run_series_check
        CHECK (series_code IN ('APPLICATIONS_BY_PROGRAM', 'ADMITTED_BY_PROGRAM', 'ENROLLED_BY_PROGRAM')),
    program_ref TEXT NOT NULL CHECK (btrim(program_ref) <> ''),
    cadence TEXT NOT NULL CONSTRAINT forecast_run_cadence_check CHECK (cadence IN ('ANUAL', 'SEMESTRAL')),
    horizon INTEGER NOT NULL CONSTRAINT forecast_run_horizon_check CHECK (horizon BETWEEN 1 AND 8),
    model_kind TEXT NOT NULL
        CONSTRAINT forecast_run_model_check
        CHECK (model_kind IN ('linear_trend', 'linear_trend_lag', 'seasonal_naive')),
    model JSONB NOT NULL,
    selection JSONB NOT NULL,
    backtest JSONB NOT NULL,
    history_points INTEGER NOT NULL CHECK (history_points > 0),
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX forecast_run_latest_idx
    ON ml_workspace.forecast_run (series_code, program_ref, cadence, created_at DESC);
CREATE INDEX forecast_run_job_idx ON ml_workspace.forecast_run (job_id);

CREATE TABLE ml_workspace.forecast_point (
    run_id UUID NOT NULL REFERENCES ml_workspace.forecast_run (run_id) ON DELETE CASCADE,
    year SMALLINT NOT NULL CHECK (year >= 2000),
    period SMALLINT NOT NULL CHECK (period > 0),
    point_kind TEXT NOT NULL CONSTRAINT forecast_point_kind_check CHECK (point_kind IN ('HISTORY', 'FORECAST')),
    horizon INTEGER,
    value DOUBLE PRECISION NOT NULL CHECK (value >= 0),
    lower_80 DOUBLE PRECISION,
    upper_80 DOUBLE PRECISION,
    lower_95 DOUBLE PRECISION,
    upper_95 DOUBLE PRECISION,
    PRIMARY KEY (run_id, year, period),
    CONSTRAINT forecast_point_horizon_check CHECK (
        (point_kind = 'HISTORY' AND horizon IS NULL AND lower_80 IS NULL AND upper_80 IS NULL
            AND lower_95 IS NULL AND upper_95 IS NULL)
        OR (point_kind = 'FORECAST' AND horizon BETWEEN 1 AND 8)
    ),
    CONSTRAINT forecast_point_band_check CHECK (
        lower_80 IS NULL
        OR (lower_95 <= lower_80 AND lower_80 <= upper_80 AND upper_80 <= upper_95)
    )
);

REVOKE ALL ON ml_workspace.forecast_run, ml_workspace.forecast_point
    FROM PUBLIC, dw_ml_writer, dw_prediction_reader, dw_reader;
GRANT USAGE ON SCHEMA ml_workspace TO dw_prediction_runtime;
GRANT SELECT, INSERT, DELETE ON ml_workspace.forecast_run, ml_workspace.forecast_point TO dw_prediction_runtime;

COMMENT ON TABLE ml_workspace.forecast_run IS
    'PRED-104 program forecast runs (applications, admitted, enrolled); the latest run of a series and program is published.';
COMMENT ON TABLE ml_workspace.forecast_point IS
    'PRED-104 observed history and projection with 80 % / 95 % bands of one forecast run.';

RESET ROLE;
