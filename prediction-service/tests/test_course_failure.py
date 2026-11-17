"""Course-failure contract and extraction: point-in-time features and labels."""

from __future__ import annotations

import re
import unittest
from datetime import datetime, timezone

from feature_contract import (
    COURSE_FAILURE_EVENT,
    COURSE_FAILURE_FEATURES,
    contract_digest,
    contract_reference,
    course_failure_query,
)
from training.course_extract import build_course_failure_snapshot, course_ineligibility, course_result

FEATURES = list(COURSE_FAILURE_FEATURES)
CUTS = [{"closure_id": "201", "effective_at": datetime(2016, 7, 1, tzinfo=timezone.utc)}]


def query_row(subject: int, course: int, *, year: int = 2016, period: int = 1, start_t: int = 4031,
              history_t0: int = 4016, regime: str = "S", aprobado=None, reprobado=None, abandono=None) -> dict:
    row = {name: 1 for name in FEATURES}
    row.update(subject_ref=str(subject), course_ref=str(course), program_ref="SIS", cut_id="201",
               cut_year=year, cut_period=period, start_t=start_t, history_start_t=history_t0,
               program_regime=regime, source_run_id="00000000-0000-0000-0000-000000000001",
               es_aprobado=aprobado, es_reprobado=reprobado, es_abandono=abandono)
    return row


class CourseFailureContractTests(unittest.TestCase):
    def test_features_only_read_history_before_the_cut(self) -> None:
        sql = course_failure_query(FEATURES)
        # History aggregates are restricted to prior cuts.
        self.assertIn("cut.effective_at < c.effective_at AS prior", sql)
        for cte in ("ss", "rate"):
            body = re.search(rf"{cte} AS MATERIALIZED \((.*?)\n\)", sql, re.S).group(1)
            self.assertIn("WHERE prior", body)
        self.assertIn("pcut.effective_at < c.effective_at", sql)
        # The scored course's own result is never a feature column.
        columns = sql.split("SELECT cur.id_alumno::text AS subject_ref", 1)[1].split("FROM cur", 1)[0]
        feature_part = columns.split("c.closure_id::text AS cut_id", 1)[0]
        self.assertNotIn("es_aprobado", feature_part)
        self.assertNotIn("es_reprobado", feature_part)
        self.assertNotIn("es_abandono", feature_part)

    def test_contract_is_digested(self) -> None:
        self.assertEqual(contract_reference(COURSE_FAILURE_EVENT, FEATURES)["digest"], contract_digest(COURSE_FAILURE_EVENT))


class CourseFailureExtractionTests(unittest.TestCase):
    def test_result_mapping(self) -> None:
        self.assertEqual(course_result({"es_aprobado": True}), "APROBADA")
        self.assertEqual(course_result({"es_aprobado": False, "es_reprobado": True}), "REPROBADA")
        self.assertEqual(course_result({"es_abandono": True}), "ABANDONO")
        self.assertIsNone(course_result({}))

    def test_eligibility_window_and_censoring(self) -> None:
        self.assertIsNone(course_ineligibility(query_row(1, 1)))                      # 2016-1, started 2015-2
        self.assertEqual(course_ineligibility(query_row(1, 1, start_t=4016)), "LEFT_CENSORED_START")
        self.assertEqual(course_ineligibility(query_row(1, 1, start_t=4024)), "OUTSIDE_WINDOW")  # 8th cut
        self.assertEqual(course_ineligibility(query_row(1, 1, regime="A")), "OTHER_CADENCE_PROGRAM")

    def test_snapshot_labels_failed_and_abandoned_as_risk(self) -> None:
        rows = [
            query_row(1, 10, aprobado=True),
            query_row(1, 11, aprobado=False, reprobado=True),
            query_row(2, 10, abandono=True),
            query_row(3, 10),                       # no known result
            query_row(4, 10, start_t=4016, aprobado=True),
        ]
        manifest, prepared = build_course_failure_snapshot(rows, programs=["SIS"], feature_names=FEATURES,
                                                           cuts=CUTS, pseudonym_key=b"k" * 32)
        self.assertEqual(sorted((r["course_result"], r["target_class"]) for r in prepared),
                         [("ABANDONO", "RISK"), ("APROBADA", "NO_RISK"), ("REPROBADA", "RISK")])
        self.assertEqual(manifest["exclusions"], {"LEFT_CENSORED_START": 1, "UNKNOWN_RESULT": 1})
        self.assertFalse(manifest["target_approved"])
        self.assertTrue(all(len(r["student_ref"]) == 32 and "subject_ref" not in r for r in prepared))


if __name__ == "__main__":
    unittest.main()
