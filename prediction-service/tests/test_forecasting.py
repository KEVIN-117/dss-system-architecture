"""PRED-104: program forecasts -- models, backtesting, series building, jobs and API."""
from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from fastapi.testclient import TestClient

from forecasting.backtest import backtest, select_model
from forecasting.models import SeriesPoint, fit, minimum_points, next_period
from forecasting.series_extract import ADMITTED, APPLICATIONS, ENROLLED, build_series
from forecasting.service import (
    ForecastCancelled,
    ForecastError,
    ForecastParams,
    run_forecast_job,
    validate_forecast_params,
)
from inference import InferenceFailure, Principal
from main import app
from training.forecast_store import ForecastStore
from training.job_store import JobStatus, JobStore


def semester_series(n: int, base: float = 100.0, slope: float = 5.0, second_term: float = 8.0,
                    noise: float = 0.0, seed: int = 3, start=(2016, 1)) -> list[SeriesPoint]:
    rng = np.random.default_rng(seed)
    points, (year, period) = [], start
    for t in range(n):
        value = base + slope * t + (second_term if period == 2 else 0.0) + (rng.normal(0, noise) if noise else 0.0)
        points.append(SeriesPoint(year, period, value))
        year, period = next_period(year, period, "SEMESTRAL")
    return points


def annual_series(values: list[float], start: int = 2015) -> list[SeriesPoint]:
    return [SeriesPoint(start + i, 1, v) for i, v in enumerate(values)]


class ModelTests(unittest.TestCase):
    def test_linear_trend_recovers_slope_and_season(self) -> None:
        model = fit("linear_trend", semester_series(12), "SEMESTRAL")
        self.assertAlmostEqual(model.slope, 5.0, places=4)
        self.assertAlmostEqual(model.coefficients[2], 8.0, places=4)
        projection = model.forecast(3)
        self.assertEqual([(p["year"], p["period"]) for p in projection], [(2022, 1), (2022, 2), (2023, 1)])
        self.assertAlmostEqual(projection[0]["value"], 160.0, places=3)
        self.assertAlmostEqual(projection[1]["value"], 173.0, places=3)

    def test_noisy_trend_has_ordered_widening_bands(self) -> None:
        model = fit("linear_trend", semester_series(16, noise=4.0), "SEMESTRAL")
        self.assertAlmostEqual(model.slope, 5.0, delta=1.0)
        first, last = model.forecast(4)[0], model.forecast(4)[-1]
        for point in (first, last):
            band = point["interval"]
            self.assertLessEqual(band["0.95"]["lower"], band["0.8"]["lower"])
            self.assertLessEqual(band["0.8"]["lower"], band["0.8"]["upper"])
            self.assertLessEqual(band["0.8"]["upper"], band["0.95"]["upper"])
        width = lambda p: p["interval"]["0.8"]["upper"] - p["interval"]["0.8"]["lower"]
        self.assertGreater(width(last), width(first))

    def test_counts_never_go_below_zero(self) -> None:
        model = fit("linear_trend", annual_series([40, 30, 20, 10, 5]), "ANUAL")
        for point in model.forecast(4):
            self.assertGreaterEqual(point["value"], 0.0)
            if point["interval"]:
                self.assertGreaterEqual(point["interval"]["0.95"]["lower"], 0.0)

    def test_seasonal_naive_and_minimum_lengths(self) -> None:
        model = fit("seasonal_naive", semester_series(3), "SEMESTRAL")
        self.assertEqual(model.forecast(1)[0]["value"], semester_series(3)[1].value)
        with self.assertRaisesRegex(ValueError, "at least"):
            fit("linear_trend", semester_series(minimum_points("linear_trend", "SEMESTRAL") - 1), "SEMESTRAL")
        with self.assertRaises(ValueError):
            fit("arima", semester_series(10), "SEMESTRAL")

    def test_lag_model_forecasts_recursively(self) -> None:
        model = fit("linear_trend_lag", annual_series([10, 20, 30, 40, 50, 60, 70]), "ANUAL")
        self.assertAlmostEqual(model.forecast(2)[1]["value"], 90.0, delta=1e-3)


class BacktestTests(unittest.TestCase):
    def test_backtest_only_uses_the_past(self) -> None:
        series = semester_series(10)
        seen: list[int] = []
        real_fit = fit

        def spy(kind, history, cadence):
            seen.append(len(history))
            return real_fit(kind, history, cadence)

        with patch("forecasting.backtest.fit", side_effect=spy):
            result = backtest("linear_trend", series, "SEMESTRAL", horizon=2)
        # Every origin k fits on points [0, k) and is scored on later points.
        self.assertEqual(seen, list(range(minimum_points("linear_trend", "SEMESTRAL"), len(series))))
        self.assertEqual(result["origins"], len(seen))
        self.assertAlmostEqual(result["mae"], 0.0, places=4)

    def test_backtest_detects_a_structural_break(self) -> None:
        values = [50.0] * 6 + [100.0] * 4
        result = backtest("linear_trend", annual_series(values), "ANUAL", horizon=1)
        self.assertGreater(result["mae"], 5.0)
        self.assertIsNotNone(result["interval_coverage"])

    def test_selection_prefers_the_simpler_model_on_ties(self) -> None:
        kind, selection, results = select_model(semester_series(12), "SEMESTRAL", horizon=2)
        self.assertEqual(kind, "linear_trend")
        self.assertIn("simplest", selection["rule"])
        self.assertEqual({r["model"] for r in results}, {"linear_trend", "linear_trend_lag", "seasonal_naive"})

    def test_short_series_fall_back_to_seasonal_naive(self) -> None:
        kind, selection, _ = select_model(semester_series(3), "SEMESTRAL", horizon=2)
        self.assertEqual(kind, "seasonal_naive")
        self.assertTrue(selection["fallback"])
        with self.assertRaises(ValueError):
            select_model(semester_series(2), "SEMESTRAL", horizon=1)


class SeriesBuildingTests(unittest.TestCase):
    def test_series_fill_zero_cuts_from_first_observation(self) -> None:
        cuts = [(2019, 1), (2019, 2), (2020, 1), (2020, 2), (2021, 1)]
        rows = [
            {"program_ref": "SIS", "year": 2019, "period": 2, "applications": 40, "admitted": 30},
            {"program_ref": "SIS", "year": 2020, "period": 2, "applications": 50, "admitted": 35},
            {"program_ref": "SIS", "year": 2020, "period": 3, "applications": 9, "admitted": 9},
            {"program_ref": "MED", "year": 2019, "period": 1, "applications": 10, "admitted": None},
        ]
        series = build_series(rows, "applications", cuts, "SEMESTRAL")
        self.assertEqual([(p.year, p.period, p.value) for p in series["SIS"]],
                         [(2019, 2, 40.0), (2020, 1, 0.0), (2020, 2, 50.0), (2021, 1, 0.0)])
        self.assertEqual(len(series["MED"]), 5)
        self.assertEqual(build_series(rows, "admitted", cuts, "SEMESTRAL")["MED"][0].value, 0.0)
        annual = build_series([{"program_ref": "MED", "year": 2019, "period": 1, "enrolled": 5}],
                              "enrolled", cuts, "ANUAL")
        self.assertEqual([(p.year, p.period) for p in annual["MED"]], [(2019, 1), (2020, 1), (2021, 1)])


class ForecastJobTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.store = ForecastStore(f"sqlite://{Path(self.tmp.name) / 'forecasts.sqlite'}")

    def tearDown(self) -> None:
        self.tmp.cleanup()

    @staticmethod
    def fake_extract(dsn, series_code, programs, cadence):
        series = {"SIS": semester_series(10, slope=4.0), "MED": semester_series(4)}
        return {p: s for p, s in series.items() if p in programs}

    def test_params_validation(self) -> None:
        params = validate_forecast_params({"cadence": "SEMESTRAL", "programs": ["SIS", "SIS"], "horizon": 3})
        self.assertEqual((params.programs, params.horizon), (("SIS",), 3))
        self.assertEqual(params.series_codes, (APPLICATIONS, ADMITTED, ENROLLED))
        for raw, code in (({"cadence": "TRIMESTRAL"}, "INVALID_CADENCE"),
                          ({"cadence": "ANUAL", "series_codes": ["X"]}, "UNKNOWN_SERIES"),
                          ({"cadence": "ANUAL", "horizon": 9}, "INVALID_HORIZON")):
            with self.assertRaises(ForecastError) as ctx:
                validate_forecast_params(raw)
            self.assertEqual(ctx.exception.code, code)

    def test_job_persists_history_and_projection_per_program(self) -> None:
        params = ForecastParams("SEMESTRAL", (APPLICATIONS,), ("SIS", "MED", "DER"), horizon=2)
        summary = run_forecast_job(params, dsn="postgresql://fake", store=self.store, job_id="job-1",
                                   requested_by="op", extract=self.fake_extract)
        self.assertEqual(summary.runs, 2)
        self.assertEqual(summary.skipped, {f"{APPLICATIONS}|DER": "NO_OBSERVATIONS"})
        run = self.store.latest(APPLICATIONS, "SIS", "SEMESTRAL")
        self.assertEqual(run["model_kind"], "linear_trend")
        self.assertAlmostEqual(run["model"]["slope_per_cut"], 4.0, places=4)
        kinds = [p["kind"] for p in run["points"]]
        self.assertEqual((kinds.count("HISTORY"), kinds.count("FORECAST")), (10, 2))
        self.assertEqual(self.store.latest(APPLICATIONS, "MED")["model_kind"], "seasonal_naive")
        self.assertEqual({r["program_ref"] for r in self.store.list_latest(APPLICATIONS)}, {"SIS", "MED"})
        self.assertEqual(self.store.delete_job_runs("job-1"), 2)
        self.assertIsNone(self.store.latest(APPLICATIONS, "SIS"))

    def test_cancellation_saves_nothing(self) -> None:
        calls = {"n": 0}

        def cancel_on_save_check():
            calls["n"] += 1
            return calls["n"] > 1

        with self.assertRaises(ForecastCancelled):
            run_forecast_job(ForecastParams("SEMESTRAL", (APPLICATIONS,), ("SIS",), 2), dsn="postgresql://fake",
                             store=self.store, job_id="job-2", requested_by="op", extract=self.fake_extract,
                             should_cancel=cancel_on_save_check)
        self.assertIsNone(self.store.latest(APPLICATIONS, "SIS"))

    def test_nothing_forecastable_fails_with_a_code(self) -> None:
        with self.assertRaises(ForecastError) as ctx:
            run_forecast_job(ForecastParams("SEMESTRAL", (APPLICATIONS,), ("DER",), 2), dsn="postgresql://fake",
                             store=self.store, job_id="job-3", requested_by="op", extract=self.fake_extract)
        self.assertEqual(ctx.exception.code, "NO_FORECASTABLE_SERIES")

    def test_latest_run_wins(self) -> None:
        params = ForecastParams("SEMESTRAL", (APPLICATIONS,), ("SIS",), 2)
        run_forecast_job(params, dsn="postgresql://fake", store=self.store, job_id="old", requested_by="op",
                         extract=self.fake_extract)
        run_forecast_job(ForecastParams("SEMESTRAL", (APPLICATIONS,), ("SIS",), 4), dsn="postgresql://fake",
                         store=self.store, job_id="new", requested_by="op", extract=self.fake_extract)
        self.assertEqual(self.store.latest(APPLICATIONS, "SIS")["job_id"], "new")
        self.assertEqual(len(self.store.list_latest(APPLICATIONS)), 1)


FORECAST_READ = "prediction:forecast:read"


class ForecastIdentity:
    PRINCIPALS = {
        "operator-token": Principal("operator-1", frozenset(), (), frozenset({"prediction:train"})),
        "reader-token": Principal("rector-1", frozenset({"RECTOR"}), (),
                                  frozenset({FORECAST_READ, "analytics:read", "analytics:global"})),
        "analytics-token": Principal("dean-1", frozenset({"DECANO"}), (), frozenset({"analytics:read"})),
        # PRED-108: academic authorities read only the programs of their scope.
        "dean-token": Principal("dean-2", frozenset({"DECANO"}), ({"facultyId": 1, "careerId": None},),
                                frozenset({FORECAST_READ, "analytics:read", "analytics:faculty"})),
        "director-token": Principal("director-1", frozenset({"DIRECTOR"}), ({"facultyId": 2, "careerId": "MED"},),
                                    frozenset({FORECAST_READ, "analytics:read", "analytics:career"})),
        "unscoped-reader-token": Principal("reader-2", frozenset(), (), frozenset({FORECAST_READ})),
        "dean-publisher-token": Principal("dean-pub", frozenset({"DECANO"}), ({"facultyId": 1, "careerId": None},),
                                          frozenset({FORECAST_READ, "prediction:publish", "analytics:read", "analytics:faculty"})),
        "director-publisher-token": Principal("director-pub", frozenset({"DIRECTOR"}), ({"facultyId": 2, "careerId": "MED"},),
                                              frozenset({FORECAST_READ, "prediction:publish", "analytics:read", "analytics:career"})),
        "rector-publisher-token": Principal("rector-pub", frozenset({"RECTOR"}), (),
                                            frozenset({FORECAST_READ, "prediction:publish", "analytics:read", "analytics:global"})),
    }

    def authenticate(self, token: str) -> Principal:
        if token not in self.PRINCIPALS:
            raise InferenceFailure("INVALID_TOKEN", 401, "invalid")
        return self.PRINCIPALS[token]


class FakeProgramDirectory:
    """SIS belongs to faculty 1 and MED to faculty 2."""

    FACULTIES = {"SIS": 1, "MED": 2}

    def faculties(self, program_refs: list[str]) -> dict[str, int]:
        return {ref: self.FACULTIES[ref] for ref in program_refs if ref in self.FACULTIES}

    def programs_for_cadence(self, cadence: str) -> dict[str, int]:
        return dict(self.FACULTIES)


class ForecastApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {
            "PREDICTION_DATABASE_URL": f"sqlite://{Path(self.tmp.name) / 'jobs.sqlite'}",
            "WORKER_MAX_CONCURRENT_JOBS": "1", "PREDICTION_MAX_QUEUED_JOBS": "2",
            "PREDICTION_DW_DATABASE_URL": "postgresql://fake",
        })
        self.env.start()
        app.state.identity_provider = ForecastIdentity()
        app.state.program_directory = FakeProgramDirectory()
        self.dispatch = patch("training.tasks.forecast_task.apply_async")
        self.dispatch_mock = self.dispatch.start()

    def tearDown(self) -> None:
        self.dispatch.stop()
        del app.state.identity_provider
        del app.state.program_directory
        self.env.stop()
        self.tmp.cleanup()

    def client(self, token: str) -> TestClient:
        return TestClient(app, headers={"Authorization": f"Bearer {token}"})

    def test_forecast_job_is_queued_idempotently_and_runs_in_the_worker(self) -> None:
        operator = self.client("operator-token")
        body = {"cadence": "SEMESTRAL", "series_codes": [APPLICATIONS], "programs": ["SIS"], "horizon": 2}
        response = operator.post("/v1/forecast-jobs", json=body, headers={"Idempotency-Key": "forecast-key-00001"})
        self.assertEqual(response.status_code, 202, response.text)
        job = response.json()
        self.assertEqual((job["job_kind"], job["params"]["horizon"]), ("FORECAST", 2))
        self.dispatch_mock.assert_called_once()
        again = operator.post("/v1/forecast-jobs", json=body, headers={"Idempotency-Key": "forecast-key-00001"})
        self.assertEqual(again.json()["job_id"], job["job_id"])
        self.assertEqual(operator.post("/v1/forecast-jobs", json={**body, "horizon": 3},
                                       headers={"Idempotency-Key": "forecast-key-00001"}).status_code, 409)
        invalid = operator.post("/v1/forecast-jobs", json={**body, "series_codes": ["X"]},
                                headers={"Idempotency-Key": "forecast-key-00002"})
        self.assertEqual((invalid.status_code, invalid.json()["code"]), (422, "UNKNOWN_SERIES"))
        self.assertEqual(self.client("reader-token").post("/v1/forecast-jobs", json=body,
                                                          headers={"Idempotency-Key": "forecast-key-00003"}).status_code, 403)

        from training.tasks import forecast_task
        with patch("forecasting.service.extract_series", side_effect=ForecastJobTests.fake_extract):
            outcome = forecast_task.run(job_id=job["job_id"])
        self.assertEqual(outcome["status"], "SUCCEEDED", outcome)
        record = JobStore().get(job["job_id"])
        self.assertEqual((record.status, record.result_ref), (JobStatus.SUCCEEDED, f"forecast-job:{job['job_id']}"))

        reader = self.client("reader-token")
        one = reader.get(f"/v1/forecasts?series={APPLICATIONS}&program_ref=SIS")
        self.assertEqual(one.status_code, 200, one.text)
        self.assertEqual(sum(p["kind"] == "FORECAST" for p in one.json()["points"]), 2)
        listed = reader.get(f"/v1/forecasts?series={APPLICATIONS}&cadence=SEMESTRAL").json()
        self.assertEqual([r["program_ref"] for r in listed["forecasts"]], ["SIS"])
        self.assertNotIn("points", listed["forecasts"][0])
        self.assertEqual(reader.get(f"/v1/forecasts?series={APPLICATIONS}&program_ref=MED").status_code, 404)
        self.assertEqual(reader.get("/v1/forecasts?series=OTHER").status_code, 422)
        self.assertEqual(self.client("analytics-token").get(f"/v1/forecasts?series={APPLICATIONS}").status_code, 403)
        self.assertEqual(TestClient(app).get(f"/v1/forecasts?series={APPLICATIONS}").status_code, 401)

    def test_forecasts_are_filtered_by_academic_scope(self) -> None:
        run_forecast_job(ForecastParams("SEMESTRAL", (APPLICATIONS,), ("SIS", "MED"), horizon=2),
                         dsn="postgresql://fake", store=ForecastStore(), job_id="scope", requested_by="op",
                         extract=ForecastJobTests.fake_extract)
        listing = f"/v1/forecasts?series={APPLICATIONS}&cadence=SEMESTRAL"

        def programs(token: str) -> list[str]:
            response = self.client(token).get(listing)
            self.assertEqual(response.status_code, 200, response.text)
            return [run["program_ref"] for run in response.json()["forecasts"]]

        # ML operators and the global scope read every program.
        self.assertEqual(programs("operator-token"), ["MED", "SIS"])
        self.assertEqual(programs("reader-token"), ["MED", "SIS"])
        # A dean reads the programs of the faculty; a director only the career.
        self.assertEqual(programs("dean-token"), ["SIS"])
        self.assertEqual(programs("director-token"), ["MED"])
        # prediction:forecast:read without an academic scope sees no program.
        self.assertEqual(programs("unscoped-reader-token"), [])

        def status(token: str, program: str) -> int:
            return self.client(token).get(f"/v1/forecasts?series={APPLICATIONS}&program_ref={program}").status_code

        self.assertEqual((status("dean-token", "SIS"), status("dean-token", "MED")), (200, 403))
        self.assertEqual((status("director-token", "MED"), status("director-token", "SIS")), (200, 403))
        # Out of scope is a 403 even when no forecast exists, so existence does not leak.
        self.assertEqual(status("dean-token", "DER"), 403)
        self.assertEqual(status("reader-token", "DER"), 404)

    def test_cancelled_forecast_job_discards_saved_runs(self) -> None:
        operator = self.client("operator-token")
        job = operator.post("/v1/forecast-jobs", json={"cadence": "SEMESTRAL", "series_codes": [APPLICATIONS],
                                                        "programs": ["SIS"]},
                            headers={"Idempotency-Key": "forecast-key-00004"}).json()
        from training.tasks import forecast_task

        real_save = ForecastStore.save_runs

        def save_then_cancel(store, runs):
            real_save(store, runs)
            JobStore().cancel(job["job_id"], include_running=True)

        with patch("forecasting.service.extract_series", side_effect=ForecastJobTests.fake_extract), \
                patch.object(ForecastStore, "save_runs", save_then_cancel):
            outcome = forecast_task.run(job_id=job["job_id"])
        self.assertEqual(outcome["status"], "CANCELLED")
        self.assertIsNone(ForecastStore().latest(APPLICATIONS, "SIS"))

    def test_portal_publishers_can_submit_and_poll_scoped_forecast_jobs(self) -> None:
        # Dean with prediction:publish submits empty programs -> automatically scoped to SIS.
        dean = self.client("dean-publisher-token")
        dean_res = dean.post(
            "/v1/forecast-jobs",
            json={"cadence": "SEMESTRAL", "series_codes": [APPLICATIONS], "programs": [], "horizon": 3},
            headers={"Idempotency-Key": "pub-forecast-key-0001"},
        )
        self.assertEqual(dean_res.status_code, 202, dean_res.text)
        dean_job = dean_res.json()
        self.assertEqual(dean_job["params"]["programs"], ["SIS"])

        # Dean can poll their FORECAST job via GET /v1/jobs/{job_id}.
        poll = dean.get(f"/v1/jobs/{dean_job['job_id']}")
        self.assertEqual(poll.status_code, 200, poll.text)
        self.assertEqual(poll.json()["job_id"], dean_job["job_id"])

        # Dean cannot request an out-of-scope program explicitly.
        forbidden = dean.post(
            "/v1/forecast-jobs",
            json={"cadence": "SEMESTRAL", "series_codes": [APPLICATIONS], "programs": ["MED"], "horizon": 3},
            headers={"Idempotency-Key": "pub-forecast-key-0002"},
        )
        self.assertEqual(forbidden.status_code, 403)

        # Director is scoped to MED; Rector with global scope keeps programs=[].
        director_res = self.client("director-publisher-token").post(
            "/v1/forecast-jobs",
            json={"cadence": "SEMESTRAL", "series_codes": [APPLICATIONS], "programs": [], "horizon": 2},
            headers={"Idempotency-Key": "pub-forecast-key-0003"},
        )
        self.assertEqual(director_res.status_code, 202, director_res.text)
        self.assertEqual(director_res.json()["params"]["programs"], ["MED"])

        rector_res = self.client("rector-publisher-token").post(
            "/v1/forecast-jobs",
            json={"cadence": "SEMESTRAL", "series_codes": [APPLICATIONS], "programs": [], "horizon": 4},
            headers={"Idempotency-Key": "pub-forecast-key-0004"},
        )
        self.assertEqual(rector_res.status_code, 202, rector_res.text)
        self.assertEqual(rector_res.json()["params"]["programs"], [])


if __name__ == "__main__":
    unittest.main()
