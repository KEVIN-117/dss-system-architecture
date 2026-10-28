"""Known-answer checks for evaluation metrics and undefined class cases."""

from __future__ import annotations

import unittest

from evaluation.metrics import classification_metrics


class EvaluationMetricTests(unittest.TestCase):
    def test_known_confusion_matrix_and_positive_class_metrics(self) -> None:
        report = classification_metrics([0, 0, 1, 1], [0, 1, 1, 1], [0.1, 0.7, 0.8, 0.9])
        self.assertEqual(report["confusion_matrix"]["values"], [[1, 1], [0, 2]])
        self.assertEqual(report["confusion_matrix"]["labels"], [0, 1])
        self.assertEqual(report["per_class"]["1"]["support"], 2)
        self.assertAlmostEqual(report["precision"], 2 / 3)
        self.assertEqual(report["recall"], 1.0)
        self.assertAlmostEqual(report["f1_score"], 0.8)

    def test_absent_class_and_no_positive_predictions_are_explicit(self) -> None:
        report = classification_metrics([0, 0], [0, 0], [0.1, 0.2])
        positive = report["per_class"]["1"]
        self.assertIsNone(positive["recall"])
        self.assertIn("recall", positive["undefined_reasons"])
        self.assertIsNone(positive["precision"])
        self.assertIn("precision", positive["undefined_reasons"])
        self.assertIsNone(report["roc_auc"])
        self.assertIn("roc_auc", report["auc_undefined_reasons"])

    def test_zero_f1_is_reported_when_class_exists_but_is_never_predicted(self) -> None:
        report = classification_metrics([0, 1], [0, 0], [0.8, 0.2])
        self.assertIsNone(report["per_class"]["1"]["precision"])
        self.assertEqual(report["per_class"]["1"]["recall"], 0.0)
        self.assertEqual(report["per_class"]["1"]["f1_score"], 0.0)


if __name__ == "__main__":
    unittest.main()
