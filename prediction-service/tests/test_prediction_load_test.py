from __future__ import annotations

import unittest

from tests.integration.prediction_load_test import (
    build_inference_payload,
    compose_command,
    summarize,
    worker_crash_command,
)


class PredictionLoadSummaryTests(unittest.TestCase):
    def test_summary_reports_latency_percentiles_and_non_200_errors(self):
        records = [
            {"endpoint": "inference", "status": 200, "latency_seconds": 0.01},
            {"endpoint": "inference", "status": 200, "latency_seconds": 0.02},
            {"endpoint": "inference", "status": 503, "latency_seconds": 0.03},
        ]

        result = summarize(records)["inference"]

        self.assertEqual(result["requests"], 3)
        self.assertEqual(result["successful_responses"], 2)
        self.assertEqual(result["errors"], 1)
        self.assertAlmostEqual(result["error_rate"], 1 / 3, places=6)
        self.assertEqual(result["latency_ms"]["p50"], 20.0)
        self.assertEqual(result["latency_ms"]["p95"], 30.0)

    def test_dashboard_redirect_counts_as_available_but_api_redirect_does_not(self):
        records = [
            {"endpoint": "dashboard", "status": 302, "latency_seconds": 0.01},
            {"endpoint": "inference", "status": 302, "latency_seconds": 0.01},
        ]

        result = summarize(records)

        self.assertEqual(result["dashboard"]["error_rate"], 0.0)
        self.assertEqual(result["inference"]["error_rate"], 1.0)

    def test_empty_measurement_set_is_not_reported_as_zero_latency(self):
        self.assertEqual(summarize([]), {})

    def test_inference_payload_matches_bff_contract(self):
        self.assertEqual(build_inference_payload("6377", "ADM", "79"), {
            "contract_version": "1.0",
            "subject_ref": "6377",
            "program_ref": "ADM",
            "academic_cut": {"cut_id": "79"},
        })

    def test_compose_command_can_target_an_isolated_project(self):
        self.assertEqual(compose_command("ps", "-q", "prediction-worker")[:3],
                         ["docker", "compose", "ps"])

    def test_worker_crash_kills_pid_one_as_container_root(self):
        self.assertEqual(worker_crash_command("container-123"), [
            "docker", "exec", "--user", "0", "--detach", "container-123", "sh", "-c", "kill -9 1",
        ])


if __name__ == "__main__":
    unittest.main()
