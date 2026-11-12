"""Training/serving feature parity through the shared point-in-time contract."""

from __future__ import annotations

import json
import os
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from dataset_contract import validate_prepared_dataset
from feature_contract import (
    COURSE_ABANDONMENT_EVENT,
    PROGRAM_DROPOUT_EVENT,
    FeatureContractError,
    contract_digest,
    contract_reference,
    program_dropout_ineligibility,
    program_dropout_query,
    verify_reference,
)
from inference import ProgramContext
from inference_adapters import DwPredictionDataProvider
from training.dw_extract import build_program_dropout_snapshot, write_snapshot
from training.job_store import JobStatus, JobStore, TrainingJobRecord

FEATURES = ["materias_cursadas", "materias_reprobadas", "ppa_acumulado"]
RUN_ID = "8ef1a80e-a16a-4e89-88e2-45d2d5fab02a"
CUTS = [
    {"closure_id": "101", "effective_at": datetime(2025, 7, 1, tzinfo=timezone.utc), "year": 2025, "period": 1},
    {"closure_id": "102", "effective_at": datetime(2025, 12, 1, tzinfo=timezone.utc), "year": 2025, "period": 2},
    {"closure_id": "103", "effective_at": datetime(2026, 7, 1, tzinfo=timezone.utc), "year": 2026, "period": 1},
    {"closure_id": "104", "effective_at": datetime(2026, 12, 1, tzinfo=timezone.utc), "year": 2026, "period": 2},
]


def contract_row(subject: int, cut: dict, *, start: tuple[int, int], outcome: str, reprobadas: int,
                 cadence_count: int = 1) -> dict:
    """A row shaped exactly like program_dropout_query output (plus program_ref)."""
    return {
        "subject_ref": str(subject), "program_ref": "P01",
        "materias_cursadas": 6, "materias_reprobadas": reprobadas, "ppa_acumulado": 70.0 - 5 * reprobadas,
        "cut_id": cut["closure_id"], "cut_year": cut["year"], "cut_period": cut["period"],
        "start_year": start[0], "start_period": start[1], "enrollment_date": "2025-02-01",
        "cadence_count": cadence_count, "source_run_id": RUN_ID, "resultado_retencion": outcome,
        "es_desercion": outcome == "DESERTOR" if outcome != "NO_EVALUABLE" else None,
        "conteo_snapshot": 1, "conteo_evaluable": 0 if outcome == "NO_EVALUABLE" else 1,
        "conteo_desercion": 1 if outcome == "DESERTOR" else 0,
    }


def synthetic_contract_rows() -> list[dict]:
    rows = []
    # Earlier cohort (train side): two cuts each, risk driven by failed courses.
    for subject in range(1, 41):
        reprobadas = subject % 5
        for cut in CUTS[:2]:
            outcome = "DESERTOR" if reprobadas >= 3 else "RETENIDO"
            rows.append(contract_row(subject, cut, start=(2025, 1), outcome=outcome, reprobadas=reprobadas))
    # Later cohort observed in the final cuts (holdout side).
    for subject in range(41, 71):
        reprobadas = subject % 5
        for cut in CUTS[2:]:
            outcome = "DESERTOR" if reprobadas >= 3 else "RETENIDO"
            rows.append(contract_row(subject, cut, start=(2026, 1), outcome=outcome, reprobadas=reprobadas))
    # Rows the shared eligibility rule must exclude.
    rows.append(contract_row(900, CUTS[3], start=(2020, 1), outcome="RETENIDO", reprobadas=0))
    rows.append(contract_row(901, CUTS[3], start=(2026, 1), outcome="RETENIDO", reprobadas=0, cadence_count=2))
    rows.append(contract_row(902, CUTS[3], start=(2026, 1), outcome="NO_EVALUABLE", reprobadas=0))
    return rows


class FeatureContractTests(unittest.TestCase):
    def test_digest_changes_when_any_definition_changes(self) -> None:
        digest = contract_digest(PROGRAM_DROPOUT_EVENT)
        self.assertNotEqual(digest, contract_digest(COURSE_ABANDONMENT_EVENT))
        with patch("feature_contract.ELIGIBILITY_RULE_VERSION", "changed"):
            self.assertNotEqual(digest, contract_digest(PROGRAM_DROPOUT_EVENT))
        with patch.dict("feature_contract.QUERIES_BY_EVENT", {PROGRAM_DROPOUT_EVENT: "SELECT 1"}):
            self.assertNotEqual(digest, contract_digest(PROGRAM_DROPOUT_EVENT))

    def test_query_rejects_features_outside_the_contract(self) -> None:
        with self.assertRaises(FeatureContractError):
            program_dropout_query(["materias_cursadas", "edad"])
        with self.assertRaises(FeatureContractError):
            verify_reference(contract_reference(PROGRAM_DROPOUT_EVENT, FEATURES), PROGRAM_DROPOUT_EVENT, ["materias_cursadas"])

    def test_query_is_bounded_by_the_cut(self) -> None:
        sql = program_dropout_query(FEATURES)
        # Every historical input is filtered by the requested cut's effective_at.
        self.assertIn("first_cut.effective_at <= c.effective_at", sql)
        self.assertIn("hcut.effective_at <= c.effective_at", sql)
        self.assertIn("e.valid_from <= c.effective_at", sql)
        self.assertNotIn("resultado_retencion AS", sql)


class ExtractionParityTests(unittest.TestCase):
    def test_snapshot_uses_shared_rule_and_is_ready_only_with_dsa_approval(self) -> None:
        rows = synthetic_contract_rows()
        manifest, prepared = build_program_dropout_snapshot(
            rows, program_ref="P01", cadence="SEMESTRAL", feature_names=FEATURES, cuts=CUTS,
            pseudonym_key=b"k" * 32,
        )
        self.assertEqual(manifest["exclusions"], {"MIXED_CADENCE": 1, "NO_EVALUABLE_OUTCOME": 1, "OUTSIDE_WINDOW": 1})
        self.assertEqual(manifest["feature_contract"], contract_reference(PROGRAM_DROPOUT_EVENT, FEATURES))
        self.assertEqual(validate_prepared_dataset(manifest, prepared).status, "BLOCKED")
        # Every kept row is one the serving rule would also score.
        kept = {(row["subject_ref"], row["cut_id"]) for row in rows if program_dropout_ineligibility(row) is None
                and row["resultado_retencion"] != "NO_EVALUABLE"}
        self.assertEqual(len(prepared), len(kept))
        # Pseudonymous refs only: no DW student id leaks into the snapshot.
        raw_ids = {row["subject_ref"] for row in rows}
        self.assertTrue(all(len(row["student_ref"]) == 32 and row["student_ref"] not in raw_ids for row in prepared))
        self.assertNotIn("subject_ref", prepared[0])

        approved, approved_rows = build_program_dropout_snapshot(
            rows, program_ref="P01", cadence="SEMESTRAL", feature_names=FEATURES, cuts=CUTS,
            target_definition_ref="dsa:target-v1", population_definition_ref="dsa:population-v1",
            dsa_approved=True, pseudonym_key=b"k" * 32,
        )
        report = validate_prepared_dataset(approved, approved_rows)
        self.assertEqual(report.status, "READY_FOR_PREPARATION", [i.code for i in report.issues])

    def test_extracted_dataset_trains_a_bundle_the_service_accepts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            manifest, prepared = build_program_dropout_snapshot(
                synthetic_contract_rows(), program_ref="P01", cadence="SEMESTRAL", feature_names=FEATURES,
                cuts=CUTS, target_definition_ref="dsa:target-v1", population_definition_ref="dsa:population-v1",
                dsa_approved=True, pseudonym_key=b"k" * 32,
            )
            dataset_dir = root / "custom" / manifest["dataset_id"]
            write_snapshot(dataset_dir, manifest, prepared)
            configs = root / "configs"
            configs.mkdir()
            (configs / "policy-test.json").write_text(json.dumps({"decision_policy": {
                "approved": True, "policy_ref": "dsa:cost-test", "false_negative_cost": 3, "false_positive_cost": 1,
            }}), encoding="utf-8")
            job_id = "5d0b1c9a-1e2f-4a3b-8c4d-5e6f7a8b9c0d"
            env = {
                "PREDICTION_DATABASE_URL": f"sqlite://{root / 'jobs.sqlite'}",
                "PREDICTION_CUSTOM_DATASET_ROOT": str(root / "custom"),
                "PREDICTION_CONFIG_ROOT": str(configs),
            }
            with patch.dict(os.environ, env):
                store = JobStore()
                store.create(TrainingJobRecord(
                    job_id, f"custom:{manifest['dataset_id']}", "random_forest", JobStatus.QUEUED,
                    "2026-11-12T10:00:00+00:00", None, None, "operator-1", None, None, "parity-key-000001",
                    {"configuration_ref": "policy-test"}, "v1", {},
                ))
                from training.tasks import train_model_task
                result = train_model_task.run(job_id=job_id, dataset_ref=f"custom:{manifest['dataset_id']}",
                                              algorithm="random_forest", config={"configuration_ref": "policy-test"},
                                              artifacts_dir=str(root / "artifacts"))
            self.assertEqual(result["status"], "SUCCEEDED", store.get(job_id).error)
            bundle = json.loads((root / "artifacts" / f"{job_id}-attempt-1" / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(bundle["feature_contract"], manifest["feature_contract"])
            # The serving adapter accepts the trained bundle without touching the DW.
            bundle["serving_scope"] = {"event_type": "program_dropout", "cadence": "SEMESTRAL",
                                       "evaluation_unit": "student_program_academic_cut"}
            context = ProgramContext("P01", "P01", 1, "104", 2026, 2, "2026-12-01T00:00:00+00:00", "SEMESTRAL")
            self.assertEqual(DwPredictionDataProvider("postgresql://unused")._serving_schema(bundle, "program_dropout", context),
                             FEATURES)


if __name__ == "__main__":
    unittest.main()
