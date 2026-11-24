"""Persistence of program forecasts (PRED-104). PostgreSQL is authoritative; SQLite supports tests.

One ``forecast_run`` per series, program and job carries the fitted model, the
model selection and its backtest; ``forecast_point`` holds the observed history
and the projection with its 80 %/95 % bands. Runs are immutable: the published
forecast of a series and program is its latest run.
"""

from __future__ import annotations

import json
import os
import sqlite3
from typing import Any, Mapping, Sequence


class _ClosingSqliteConnection(sqlite3.Connection):
    def __exit__(self, exc_type, exc, tb):
        try:
            return super().__exit__(exc_type, exc, tb)
        finally:
            self.close()


_RUN_COLUMNS = ("run_id", "job_id", "series_code", "program_ref", "cadence", "horizon", "model_kind", "model",
                "selection", "backtest", "history_points", "created_by", "created_at")
_POINT_COLUMNS = ("run_id", "year", "period", "point_kind", "horizon", "value", "lower_80", "upper_80",
                  "lower_95", "upper_95")
_JSON_COLUMNS = ("model", "selection", "backtest")


class ForecastStore:
    def __init__(self, dsn: str | None = None):
        self.dsn = str(dsn or os.getenv("PREDICTION_DATABASE_URL", ""))
        if not self.dsn:
            raise RuntimeError("PREDICTION_DATABASE_URL must be configured.")
        if not self.dsn.startswith(("sqlite:", "postgresql:", "postgres:")):
            self.dsn = "sqlite://" + self.dsn
        self._sqlite = self.dsn.startswith("sqlite:")
        if self._sqlite:
            self.path = self.dsn.removeprefix("sqlite://")
            with self._connect() as c:
                c.executescript("""CREATE TABLE IF NOT EXISTS forecast_run (
                    run_id TEXT PRIMARY KEY, job_id TEXT NOT NULL, series_code TEXT NOT NULL,
                    program_ref TEXT NOT NULL, cadence TEXT NOT NULL, horizon INTEGER NOT NULL,
                    model_kind TEXT NOT NULL, model TEXT NOT NULL, selection TEXT NOT NULL, backtest TEXT NOT NULL,
                    history_points INTEGER NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
                    CREATE TABLE IF NOT EXISTS forecast_point (
                    run_id TEXT NOT NULL REFERENCES forecast_run(run_id) ON DELETE CASCADE,
                    year INTEGER NOT NULL, period INTEGER NOT NULL, point_kind TEXT NOT NULL, horizon INTEGER,
                    value REAL NOT NULL, lower_80 REAL, upper_80 REAL, lower_95 REAL, upper_95 REAL,
                    PRIMARY KEY(run_id, year, period));""")

    def _connect(self):
        if self._sqlite:
            c = sqlite3.connect(self.path, timeout=15, isolation_level="IMMEDIATE", factory=_ClosingSqliteConnection)
            c.row_factory = sqlite3.Row
            return c
        import psycopg
        from psycopg.rows import dict_row
        return psycopg.connect(self.dsn, autocommit=False, row_factory=dict_row)

    @property
    def _runs(self) -> str:
        return "forecast_run" if self._sqlite else "ml_workspace.forecast_run"

    @property
    def _points(self) -> str:
        return "forecast_point" if self._sqlite else "ml_workspace.forecast_point"

    @property
    def _ph(self) -> str:
        return "?" if self._sqlite else "%s"

    def _json(self, value: Any) -> Any:
        if self._sqlite:
            return json.dumps(value, sort_keys=True)
        from psycopg.types.json import Jsonb
        return Jsonb(value)

    def save_run(self, run: Mapping[str, Any], points: Sequence[Mapping[str, Any]]) -> None:
        self.save_runs([(run, points)])

    def save_runs(self, runs: Sequence[tuple[Mapping[str, Any], Sequence[Mapping[str, Any]]]]) -> None:
        """Insert every run of a job and its points in one transaction (all or nothing)."""
        with self._connect() as c:
            for run, points in runs:
                values = [self._json(run[col]) if col in _JSON_COLUMNS else run[col] for col in _RUN_COLUMNS]
                c.execute(f"INSERT INTO {self._runs} ({','.join(_RUN_COLUMNS)}) "
                          f"VALUES ({','.join([self._ph] * len(_RUN_COLUMNS))})", values)
                for point in points:
                    c.execute(f"INSERT INTO {self._points} ({','.join(_POINT_COLUMNS)}) "
                              f"VALUES ({','.join([self._ph] * len(_POINT_COLUMNS))})",
                              [run["run_id"] if col == "run_id" else point.get(col) for col in _POINT_COLUMNS])

    def delete_job_runs(self, job_id: str) -> int:
        """Remove every run of a job (used when the job is cancelled after saving)."""
        with self._connect() as c:
            c.execute(f"DELETE FROM {self._points} WHERE run_id IN (SELECT run_id FROM {self._runs} WHERE job_id={self._ph})",
                      (job_id,))
            return c.execute(f"DELETE FROM {self._runs} WHERE job_id={self._ph}", (job_id,)).rowcount

    def _decode(self, row: Any) -> dict[str, Any]:
        result = dict(row)
        for key in _JSON_COLUMNS:
            if isinstance(result.get(key), str):
                result[key] = json.loads(result[key])
        for key, value in list(result.items()):
            if hasattr(value, "isoformat"):
                result[key] = value.isoformat()
        if result.get("run_id") is not None:
            result["run_id"] = str(result["run_id"])
        if result.get("job_id") is not None:
            result["job_id"] = str(result["job_id"])
        return result

    def latest(self, series_code: str, program_ref: str, cadence: str | None = None) -> dict[str, Any] | None:
        """Latest run of a series and program, with its history and projection points."""
        ph = self._ph
        where = f"series_code={ph} AND program_ref={ph}" + (f" AND cadence={ph}" if cadence else "")
        args: list[Any] = [series_code, program_ref] + ([cadence] if cadence else [])
        with self._connect() as c:
            row = c.execute(f"SELECT * FROM {self._runs} WHERE {where} ORDER BY created_at DESC, run_id DESC LIMIT 1",
                            args).fetchone()
            if not row:
                return None
            run = self._decode(row)
            points = c.execute(f"SELECT * FROM {self._points} WHERE run_id={ph} ORDER BY year, period",
                               (row["run_id"],)).fetchall()
        run["points"] = [self._point(dict(p)) for p in points]
        return run

    @staticmethod
    def _point(row: dict[str, Any]) -> dict[str, Any]:
        interval = None
        if row.get("lower_80") is not None:
            interval = {"0.8": {"lower": row["lower_80"], "upper": row["upper_80"]},
                        "0.95": {"lower": row["lower_95"], "upper": row["upper_95"]}}
        return {"year": row["year"], "period": row["period"], "kind": row["point_kind"], "horizon": row["horizon"],
                "value": row["value"], "interval": interval}

    def list_latest(self, series_code: str, cadence: str | None = None) -> list[dict[str, Any]]:
        """Latest run summary of every program forecast for a series (no points)."""
        ph = self._ph
        where = f"series_code={ph}" + (f" AND cadence={ph}" if cadence else "")
        args: list[Any] = [series_code] + ([cadence] if cadence else [])
        sql = (f"SELECT r.* FROM {self._runs} r WHERE {where.replace('series_code', 'r.series_code').replace('cadence', 'r.cadence')} "
               f"AND r.created_at = (SELECT max(o.created_at) FROM {self._runs} o "
               f"WHERE o.series_code = r.series_code AND o.program_ref = r.program_ref AND o.cadence = r.cadence) "
               f"ORDER BY r.program_ref")
        with self._connect() as c:
            rows = c.execute(sql, args).fetchall()
        return [self._decode(row) for row in rows]
