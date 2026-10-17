"""Synthetic contract tests; they contain no institutional student data."""

import unittest
from copy import deepcopy
import json
from pathlib import Path

from dataset_contract import (
    adapt_dw_retention_row,
    compute_snapshot_digest,
    validate_prepared_dataset,
)


RUN_ID = "8ef1a80e-a16a-4e89-88e2-45d2d5fab02a"


def valid_manifest(row_count: int = 2) -> dict:
    return {
        "contract_version": "1.0",
        "dataset_id": "17e99b3d-e57f-4dbb-a4e0-5544d0b3fd51",
        "snapshot_ref": "snapshot:synthetic-001",
        "source": {"system": "dw", "contract_ref": "dw-retention-v1", "run_id": RUN_ID},
        "grain": "student_program_academic_cut",
        "academic_cut": {
            "closure_id": 41,
            "status": "PROCESADO",
            "effective_at": "2025-07-15T23:59:59Z",
        },
        "schema_version": "prepared-dataset-v1",
        "created_at": "2026-10-16T12:00:00Z",
        "row_count": row_count,
        "exclusions": {},
        "content_digest": "a" * 64,
        "population_definition_ref": "decision:population-v1",
        "target_definition_ref": "decision:target-v1",
        "eligibility_approved": True,
        "target_approved": True,
        "target_definition": {
            "positive_class": "RISK",
            "negative_class": "NO_RISK",
            "event_code": "NEXT_CLOSURE_DROPOUT",
            "horizon_ref": "next-processed-closure",
            "label_source": "dw.fact_retencion_desercion",
        },
        "target_field": "target_class",
        "feature_fields": ["materias_cursadas"],
        "fields": [
            {"name": "student_ref", "logical_type": "string", "role": "identifier", "nullable": False},
            {"name": "program_ref", "logical_type": "string", "role": "identifier", "nullable": False},
            {"name": "cut_id", "logical_type": "string", "role": "identifier", "nullable": False},
            {"name": "academic_year", "logical_type": "integer", "role": "audit", "nullable": False},
            {"name": "academic_period", "logical_type": "integer", "role": "audit", "nullable": False},
            {"name": "source_run_id", "logical_type": "uuid", "role": "audit", "nullable": False},
            {"name": "population_status", "logical_type": "category", "role": "audit", "nullable": False},
            {"name": "resultado_retencion", "logical_type": "category", "role": "audit", "nullable": False},
            {"name": "es_desercion", "logical_type": "boolean", "role": "audit", "nullable": True},
            {"name": "conteo_snapshot", "logical_type": "integer", "role": "audit", "nullable": False},
            {"name": "conteo_evaluable", "logical_type": "integer", "role": "audit", "nullable": False},
            {"name": "conteo_desercion", "logical_type": "integer", "role": "audit", "nullable": False},
            {"name": "materias_cursadas", "logical_type": "integer", "role": "feature", "nullable": True, "available_at_cut": True},
            {"name": "target_class", "logical_type": "category", "role": "target", "nullable": False, "available_at_cut": False},
        ],
    }


def row(student_ref: str, outcome: str, population: str = "ELIGIBLE") -> dict:
    return {
        "student_ref": student_ref,
        "program_ref": "program-ref-01",
        "cut_id": "closure-41",
        "academic_year": 2025,
        "academic_period": 1,
        "source_run_id": RUN_ID,
        "population_status": population,
        "resultado_retencion": outcome,
        "es_desercion": {"NO_EVALUABLE": None, "RETENIDO": False, "DESERTOR": True}[outcome],
        "conteo_snapshot": 1,
        "conteo_evaluable": {"NO_EVALUABLE": 0, "RETENIDO": 1, "DESERTOR": 1}[outcome],
        "conteo_desercion": {"NO_EVALUABLE": 0, "RETENIDO": 0, "DESERTOR": 1}[outcome],
        "materias_cursadas": 4,
        "target_class": "RISK" if outcome == "DESERTOR" else "NO_RISK",
    }


def validate(manifest: dict, rows: list[dict]):
    prepared_manifest = deepcopy(manifest)
    prepared_manifest["content_digest"] = compute_snapshot_digest(rows)
    return validate_prepared_dataset(prepared_manifest, rows)


class PreparedDatasetContractTests(unittest.TestCase):
    def test_dw_shaped_fixture_is_structural_but_blocked_without_dsa_approval(self) -> None:
        fixture_dir = Path(__file__).parent / "fixtures" / "pred002_synthetic"
        manifest = json.loads((fixture_dir / "manifest.json").read_text(encoding="utf-8"))
        records = [
            json.loads(line)
            for line in (fixture_dir / "rows.jsonl").read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]

        report = validate_prepared_dataset(manifest, records)

        self.assertEqual(report.status, "BLOCKED")
        self.assertTrue(report.structurally_valid)
        self.assertEqual(report.row_count, 8)
        self.assertEqual(report.population_counts, {"UNRESOLVED": 8})
        self.assertEqual(report.outcome_counts, {"DESERTOR": 4, "RETENIDO": 3, "NO_EVALUABLE": 1})
        self.assertEqual(report.missing_counts["materias_arrastradas"], 8)

    def test_valid_synthetic_dataset_passes_preparation_gate(self) -> None:
        report = validate(
            valid_manifest(),
            [row("pseudonym-a", "DESERTOR"), row("pseudonym-b", "RETENIDO")],
        )

        self.assertEqual(report.status, "READY_FOR_PREPARATION")
        self.assertTrue(report.structurally_valid)
        self.assertEqual(report.population_counts, {"ELIGIBLE": 2})

    def test_unapproved_target_and_population_block_preparation(self) -> None:
        manifest = valid_manifest()
        manifest["target_approved"] = False
        manifest["target_definition_ref"] = None
        manifest["eligibility_approved"] = False
        manifest["population_definition_ref"] = None

        report = validate(
            manifest,
            [row("pseudonym-a", "DESERTOR"), row("pseudonym-b", "RETENIDO")],
        )

        self.assertEqual(report.status, "BLOCKED")
        self.assertFalse(report.ready_for_preparation)

    def test_out_of_scope_and_ambiguous_rows_are_counted_and_blocked(self) -> None:
        report = validate(
            valid_manifest(4),
            [
                row("pseudonym-a", "DESERTOR"),
                row("pseudonym-b", "RETENIDO"),
                row("pseudonym-c", "RETENIDO", "OUT_OF_SCOPE"),
                row("pseudonym-d", "DESERTOR", "AMBIGUOUS"),
            ],
        )

        self.assertEqual(report.status, "BLOCKED")
        self.assertEqual(report.population_counts["OUT_OF_SCOPE"], 1)
        self.assertEqual(report.population_counts["AMBIGUOUS"], 1)

    def test_unproven_feature_availability_blocks_preparation(self) -> None:
        manifest = valid_manifest()
        feature = next(field for field in manifest["fields"] if field["name"] == "materias_cursadas")
        feature["available_at_cut"] = None

        report = validate(
            manifest,
            [row("pseudonym-a", "DESERTOR"), row("pseudonym-b", "RETENIDO")],
        )

        self.assertEqual(report.status, "BLOCKED")
        self.assertIn("TEMPORAL_AVAILABILITY_UNPROVEN", {issue.code for issue in report.issues})

    def test_null_feature_values_are_reported(self) -> None:
        first = row("pseudonym-a", "DESERTOR")
        first["materias_cursadas"] = None

        report = validate(
            valid_manifest(),
            [first, row("pseudonym-b", "RETENIDO")],
        )

        self.assertEqual(report.missing_counts["materias_cursadas"], 1)

    def test_target_cannot_be_declared_as_feature(self) -> None:
        manifest = valid_manifest()
        manifest["feature_fields"].append("target_class")

        report = validate(
            manifest,
            [row("pseudonym-a", "DESERTOR"), row("pseudonym-b", "RETENIDO")],
        )

        self.assertEqual(report.status, "INVALID")
        self.assertIn("TARGET_LEAKAGE", {issue.code for issue in report.issues})

    def test_duplicate_grain_key_is_invalid(self) -> None:
        duplicate = row("pseudonym-a", "DESERTOR")
        report = validate(
            valid_manifest(), [duplicate, deepcopy(duplicate)]
        )

        self.assertEqual(report.status, "INVALID")
        self.assertIn("DUPLICATE_GRAIN_KEY", {issue.code for issue in report.issues})

    def test_dw_outcome_consistency_is_enforced(self) -> None:
        invalid = row("pseudonym-a", "NO_EVALUABLE")
        invalid["es_desercion"] = False
        report = validate(
            valid_manifest(), [invalid, row("pseudonym-b", "RETENIDO")]
        )

        self.assertEqual(report.status, "INVALID")
        self.assertIn("OUTCOME_INCONSISTENCY", {issue.code for issue in report.issues})

    def test_snapshot_fact_count_must_be_one(self) -> None:
        invalid = row("pseudonym-a", "DESERTOR")
        invalid["conteo_snapshot"] = 2

        report = validate(
            valid_manifest(), [invalid, row("pseudonym-b", "RETENIDO")]
        )

        self.assertEqual(report.status, "INVALID")
        self.assertIn("INVALID_SNAPSHOT_COUNT", {issue.code for issue in report.issues})

    def test_un_evaluable_outcome_cannot_receive_target_class(self) -> None:
        report = validate(
            valid_manifest(),
            [row("pseudonym-a", "NO_EVALUABLE"), row("pseudonym-b", "RETENIDO")],
        )

        self.assertEqual(report.status, "INVALID")
        self.assertIn("UNEVALUABLE_TARGET_ASSIGNED", {issue.code for issue in report.issues})

    def test_snapshot_digest_must_match_records(self) -> None:
        records = [row("pseudonym-a", "DESERTOR"), row("pseudonym-b", "RETENIDO")]
        manifest = valid_manifest()

        report = validate_prepared_dataset(manifest, records)

        self.assertEqual(report.status, "INVALID")
        self.assertIn("CONTENT_DIGEST_MISMATCH", {issue.code for issue in report.issues})

    def test_row_count_must_match_manifest(self) -> None:
        report = validate(
            valid_manifest(3),
            [row("pseudonym-a", "DESERTOR"), row("pseudonym-b", "RETENIDO")],
        )

        self.assertEqual(report.status, "INVALID")
        self.assertIn("ROW_COUNT_MISMATCH", {issue.code for issue in report.issues})

    def test_dw_adapter_requires_pseudonymous_reference(self) -> None:
        adapted = adapt_dw_retention_row(
            {
                "student_ref": "pseudonym-a",
                "programa_sk": 7,
                "closure_id": 41,
                "gestion": 2025,
                "periodo": 1,
                "run_id": RUN_ID,
                "population_status": "UNRESOLVED",
                "resultado_retencion": "NO_EVALUABLE",
                "es_desercion": None,
                "conteo_snapshot": 1,
                "conteo_evaluable": 0,
                "conteo_desercion": 0,
                "materias_cursadas": 4,
            }
        )

        self.assertEqual(adapted["student_ref"], "pseudonym-a")
        self.assertNotIn("identity_key", adapted)
        self.assertNotIn("id_ra", adapted)


if __name__ == "__main__":
    unittest.main()
<<<<<<< HEAD
=======

>>>>>>> fa8a720 (feat(prediction): add PRED-002 dataset validation)
