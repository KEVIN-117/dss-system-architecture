"""Program series of applications, admissions and enrolment from the DW (PRED-104).

Only processed closures count: a cut enters a series once its closure is
``PROCESADO`` and its rows come from a successful ETL run, the same publication
rule the OLAP layer uses. Each program's series runs from its first observed
cadence cut to the last processed cadence cut of the DW; cuts in between
without records are real zeros (no applications, nobody enrolled), not gaps.
"""

from __future__ import annotations

from typing import Any, Iterable, Mapping

from forecasting.models import SeriesPoint

APPLICATIONS = "APPLICATIONS_BY_PROGRAM"
ADMITTED = "ADMITTED_BY_PROGRAM"
ENROLLED = "ENROLLED_BY_PROGRAM"
SERIES_CODES = (APPLICATIONS, ADMITTED, ENROLLED)
CADENCE_PERIODS = {"ANUAL": (1,), "SEMESTRAL": (1, 2)}

_ADMISSIONS_SQL = """
SELECT p.id_programa AS program_ref, c.gestion AS year, c.periodo AS period,
       count(*) AS applications,
       count(*) FILTER (WHERE f.es_admitido IS TRUE) AS admitted
FROM dw.fact_admision f
JOIN dw.dim_programa p ON p.programa_sk = f.programa_sk AND p.member_type = 'STANDARD'
JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk = f.periodo_academico_sk AND pa.member_type = 'STANDARD'
JOIN etl_control.academic_period_closure c ON c.closure_id = pa.closure_id
  AND c.status = 'PROCESADO' AND c.processed_at IS NOT NULL AND c.effective_at <= clock_timestamp()
WHERE p.id_programa = ANY(%(programs)s) AND c.periodo = ANY(%(periods)s)
  AND EXISTS (SELECT 1 FROM etl_control.etl_execution run WHERE run.run_id = f.run_id AND run.status = 'EXITOSA')
GROUP BY p.id_programa, c.gestion, c.periodo
"""

# A student counts once per program and cut (SCD2 versions share id_alumno)
# when the retention snapshot shows coursework at that cut.
_ENROLLED_SQL = """
SELECT p.id_programa AS program_ref, c.gestion AS year, c.periodo AS period,
       count(DISTINCT e.id_alumno) AS enrolled
FROM dw.fact_retencion_desercion f
JOIN dw.dim_programa p ON p.programa_sk = f.programa_sk AND p.member_type = 'STANDARD'
JOIN dw.dim_estudiante e ON e.estudiante_sk = f.estudiante_sk AND e.member_type = 'STANDARD'
JOIN etl_control.academic_period_closure c ON c.closure_id = f.closure_id
  AND c.status = 'PROCESADO' AND c.processed_at IS NOT NULL AND c.effective_at <= clock_timestamp()
WHERE p.id_programa = ANY(%(programs)s) AND c.periodo = ANY(%(periods)s)
  AND coalesce(f.materias_cursadas, 0) > 0
  AND EXISTS (SELECT 1 FROM etl_control.etl_execution run WHERE run.run_id = f.run_id AND run.status = 'EXITOSA')
GROUP BY p.id_programa, c.gestion, c.periodo
"""

_PROCESSED_CUTS_SQL = """
SELECT gestion AS year, periodo AS period FROM etl_control.academic_period_closure
WHERE status = 'PROCESADO' AND processed_at IS NOT NULL AND effective_at <= clock_timestamp()
  AND periodo = ANY(%(periods)s)
ORDER BY gestion, periodo
"""

_PROGRAM_REGIME_SQL = """
SELECT id_programa, regimen FROM dw.dim_programa
WHERE member_type = 'STANDARD' AND id_programa = ANY(%(programs)s)
"""


def build_series(rows: Iterable[Mapping[str, Any]], measure: str, processed_cuts: list[tuple[int, int]],
                 cadence: str) -> dict[str, list[SeriesPoint]]:
    """Pure: aggregate rows per program into gap-free series of cadence cuts.

    ``processed_cuts`` are the DW's processed (year, period) cuts of the cadence,
    in order; each program's series starts at its first observed cut.
    """
    periods = CADENCE_PERIODS[cadence]
    grid = [cut for cut in processed_cuts if cut[1] in periods]
    observed: dict[str, dict[tuple[int, int], float]] = {}
    for row in rows:
        cut = (int(row["year"]), int(row["period"]))
        if cut[1] not in periods:
            continue
        observed.setdefault(str(row["program_ref"]), {})[cut] = float(row[measure] or 0)
    series: dict[str, list[SeriesPoint]] = {}
    for program, values in observed.items():
        first = min(values)
        series[program] = [SeriesPoint(year, period, values.get((year, period), 0.0))
                           for year, period in grid if (year, period) >= first]
    return series


def extract_series(dsn: str, series_code: str, programs: list[str], cadence: str) -> dict[str, list[SeriesPoint]]:
    """Read-only DW query for one series code and the programs of one cadence."""
    import psycopg

    if series_code not in SERIES_CODES:
        raise ValueError(f"Unknown series {series_code}.")
    periods = list(CADENCE_PERIODS[cadence])
    regime = "S" if cadence == "SEMESTRAL" else "A"
    with psycopg.connect(dsn, connect_timeout=5, options="-c default_transaction_read_only=on") as connection:
        regimes = dict(connection.execute(_PROGRAM_REGIME_SQL, {"programs": programs}).fetchall())
        mismatched = sorted(program for program in programs if regimes.get(program) != regime)
        if mismatched:
            raise ValueError(f"Programs {mismatched} do not have the {cadence} regime.")
        cuts = [(int(y), int(p)) for y, p in connection.execute(_PROCESSED_CUTS_SQL, {"periods": periods}).fetchall()]
        sql = _ENROLLED_SQL if series_code == ENROLLED else _ADMISSIONS_SQL
        cursor = connection.execute(sql, {"programs": programs, "periods": periods})
        columns = [column.name for column in cursor.description]
        rows = [dict(zip(columns, values)) for values in cursor.fetchall()]
    measure = {APPLICATIONS: "applications", ADMITTED: "admitted", ENROLLED: "enrolled"}[series_code]
    return build_series(rows, measure, cuts, cadence)
