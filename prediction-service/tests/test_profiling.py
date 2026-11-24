"""PRED-102: exploratory profile (EDA) of prepared datasets."""
from __future__ import annotations

import json
import unittest
from pathlib import Path

from preparation.profiling import (
    HISTOGRAM_BINS,
    PROFILE_VERSION,
    numeric_summary,
    pearson,
    profile_dataset,
)

FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> tuple[dict, list[dict]]:
    folder = FIXTURES / name
    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    rows = [json.loads(line) for line in (folder / "rows.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
    return manifest, rows


def manifest_for(features: list[str], positive: str = "RISK", negative: str = "NO_RISK") -> dict:
    return {
        "dataset_id": "d-1",
        "content_digest": "x" * 64,
        "target_field": "target_class",
        "feature_fields": features,
        "fields": [{"name": name, "role": "feature", "logical_type": "number", "source_field": f"dw.{name}"}
                   for name in features],
        "target_definition": {"event_code": "PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE",
                              "positive_class": positive, "negative_class": negative},
    }


class NumericHelpersTests(unittest.TestCase):
    def test_numeric_summary_quantiles_and_histogram(self) -> None:
        summary = numeric_summary([float(v) for v in range(1, 11)])
        self.assertEqual((summary["min"], summary["max"], summary["median"]), (1.0, 10.0, 5.5))
        self.assertEqual((summary["p25"], summary["p75"]), (3.25, 7.75))
        self.assertEqual(len(summary["histogram"]), HISTOGRAM_BINS)
        self.assertEqual(sum(bin_["count"] for bin_ in summary["histogram"]), 10)

    def test_constant_and_empty_values(self) -> None:
        self.assertEqual(len(numeric_summary([3.0, 3.0])["histogram"]), 1)
        self.assertEqual(numeric_summary([])["count"], 0)

    def test_pearson(self) -> None:
        self.assertAlmostEqual(pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1.0)
        self.assertAlmostEqual(pearson([1, 2, 3, 4], [8, 6, 4, 2]), -1.0)
        self.assertIsNone(pearson([1, 1, 1], [1, 2, 3]))


class ProfileDatasetTests(unittest.TestCase):
    def test_fixture_profile_covers_target_features_and_coverage(self) -> None:
        manifest, rows = load_fixture("pred003_synthetic")
        profile = profile_dataset(manifest, rows, "classification")
        self.assertEqual(profile["profile_version"], PROFILE_VERSION)
        self.assertEqual(profile["row_count"], len(rows))
        self.assertEqual(profile["feature_count"], len(manifest["feature_fields"]))
        self.assertEqual(sum(item["count"] for item in profile["coverage"]["rows_by_period"]), len(rows))
        self.assertEqual(sum(item["count"] for item in profile["target"]["classes"]), len(rows))
        self.assertEqual({item["name"] for item in profile["features"]}, set(manifest["feature_fields"]))
        # Only aggregates: no student reference leaks into the profile.
        serialized = json.dumps(profile)
        self.assertFalse(any(row["student_ref"] in serialized for row in rows))

    def test_imbalance_recommends_smote(self) -> None:
        rows = [{"x": float(i), "target_class": "RISK" if i < 10 else "NO_RISK", "academic_year": 2020 + i % 3,
                 "academic_period": 1} for i in range(100)]
        profile = profile_dataset(manifest_for(["x"]), rows, "classification")
        self.assertEqual(profile["target"]["imbalance_ratio"], round(10 / 90, 6))
        self.assertTrue(profile["target"]["smote_recommended"])
        self.assertIn("CLASS_IMBALANCE", {w["code"] for w in profile["warnings"]})

    def test_leakage_missing_and_constant_warnings(self) -> None:
        rows = []
        for i in range(300):
            risk = i % 2 == 0
            rows.append({"leak": 1.0 if risk else 0.0, "sparse": None if i % 2 else float(i), "flat": 5,
                         "target_class": "RISK" if risk else "NO_RISK", "cut_id": str(i % 4)})
        profile = profile_dataset(manifest_for(["leak", "sparse", "flat"]), rows, "classification")
        warnings = {(w["code"], w["field"]) for w in profile["warnings"]}
        self.assertIn(("POSSIBLE_LEAKAGE", "leak"), warnings)
        self.assertIn(("HIGH_MISSING", "sparse"), warnings)
        self.assertIn(("CONSTANT_FEATURE", "flat"), warnings)
        self.assertEqual(profile["target_correlations"][0]["field"], "leak")
        self.assertNotIn("FEW_ROWS", {code for code, _ in warnings})
        self.assertFalse(profile["target"]["smote_recommended"])

    def test_small_single_period_dataset_is_flagged(self) -> None:
        rows = [{"x": float(i), "target_class": "RISK" if i % 3 else "NO_RISK", "cut_id": "10"} for i in range(20)]
        codes = {w["code"] for w in profile_dataset(manifest_for(["x"]), rows)["warnings"]}
        self.assertTrue({"FEW_ROWS", "SINGLE_PERIOD"} <= codes)

    def test_regression_target_profile(self) -> None:
        manifest = manifest_for(["x"])
        manifest["target_definition"] = {"event_code": "STUDENT_GPA_NEXT_CUT"}
        rows = [{"x": float(i), "target_class": 50 + i, "cut_id": str(i % 3)} for i in range(30)]
        profile = profile_dataset(manifest, rows, "regression")
        self.assertEqual(profile["target"]["kind"], "regression")
        self.assertEqual(profile["target"]["summary"]["min"], 50.0)
        self.assertAlmostEqual(profile["features"][0]["target_correlation"], 1.0)


if __name__ == "__main__":
    unittest.main()
