"""Opt-in, read-only training/serving feature parity check against a real DW.

For each sampled program/cut, rows produced by the training extractor
(``training.dw_extract``) are compared value-by-value with what the serving
adapter returns for the same students. Any difference means a model would be
served with features it was not trained on.

    PREDICTION_DW_DATABASE_URL=<read-only dsn> python tests/integration/feature_parity_check.py

Prints aggregate counts only; never student identifiers.
"""

from __future__ import annotations

import os
import sys
from collections import Counter
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(SERVICE_ROOT))

import psycopg

from feature_contract import (
    PROGRAM_DROPOUT_EVENT,
    PROGRAM_DROPOUT_FEATURES,
    contract_reference,
    field_definitions,
    program_dropout_ineligibility,
    program_dropout_query,
)
from inference import InferenceFailure
from inference_adapters import DwPredictionDataProvider

SAMPLE_CUTS = int(os.getenv("PREDICTION_PARITY_CUTS", "4"))
SAMPLE_STUDENTS = int(os.getenv("PREDICTION_PARITY_STUDENTS", "100"))

_CUTS_SQL = """
SELECT p.id_programa, c.closure_id::text
FROM dw.fact_retencion_desercion f
JOIN dw.dim_programa p ON p.programa_sk=f.programa_sk AND p.member_type='STANDARD' AND p.activo='A'
JOIN etl_control.academic_period_closure c ON c.closure_id=f.closure_id AND c.status='PROCESADO'
  AND c.processed_at IS NOT NULL AND c.effective_at <= clock_timestamp()
GROUP BY 1, 2 ORDER BY count(*) DESC LIMIT %s
"""


def main() -> None:
    dsn = os.getenv("PREDICTION_DW_DATABASE_URL", "").strip()
    if not dsn:
        raise SystemExit("Set PREDICTION_DW_DATABASE_URL to a read-only DW connection.")
    features = list(PROGRAM_DROPOUT_FEATURES)
    sql = program_dropout_query(features)
    provider = DwPredictionDataProvider(dsn)
    outcomes: Counter[str] = Counter()
    mismatches = 0
    with psycopg.connect(dsn, connect_timeout=5, options="-c default_transaction_read_only=on") as connection:
        cuts = connection.execute(_CUTS_SQL, (SAMPLE_CUTS,)).fetchall()
        for program, closure in cuts:
            context = provider.resolve_context(program, closure)
            manifest = {
                "classes": {"event_code": PROGRAM_DROPOUT_EVENT},
                "serving_scope": {"cadence": context.cadence},
                "input_schema": {"feature_names": features, "fields": field_definitions(PROGRAM_DROPOUT_EVENT, features)},
                "feature_contract": contract_reference(PROGRAM_DROPOUT_EVENT, features),
            }
            cursor = connection.execute(sql, {"program": program, "closure": int(closure), "subject": None, "limit": 1_000_000})
            columns = [column.name for column in cursor.description]
            extracted = [dict(zip(columns, values)) for values in cursor.fetchall()]
            for row in extracted[:SAMPLE_STUDENTS]:
                expected = None if program_dropout_ineligibility(row) else {name: row[name] for name in features}
                try:
                    served = dict(provider.load_features(row["subject_ref"], context, manifest))
                except InferenceFailure as exc:
                    served = None
                    outcomes[exc.code] += 1
                else:
                    outcomes["SERVED"] += 1
                if served != expected:
                    mismatches += 1
    print(f"cuts={len(cuts)} outcomes={dict(outcomes)} mismatches={mismatches}")
    if mismatches:
        raise SystemExit("Training extraction and serving features differ.")
    print("FEATURE_PARITY_OK")


if __name__ == "__main__":
    main()
