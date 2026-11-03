"""Prepare a test-only cadence-specific bundle from the Faker DW cut."""

from __future__ import annotations

import os
import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(SERVICE_ROOT))

from inference_adapters import DwPredictionDataProvider
from training.model_registry import ModelRegistry
from prediction_faker_e2e import _create_test_bundle


def main() -> None:
    program_ref = os.getenv("PREDICTION_E2E_PROGRAM_REF", "").strip()
    cut_id = os.getenv("PREDICTION_E2E_CUT_ID", "").strip()
    artifacts = Path(os.getenv("WORKER_ARTIFACTS_DIR", "/artifacts"))
    if not program_ref or not cut_id:
        raise SystemExit("Set PREDICTION_E2E_PROGRAM_REF and PREDICTION_E2E_CUT_ID.")

    provider = DwPredictionDataProvider()
    context = provider.resolve_context(program_ref, cut_id)
    subjects, _ = provider.list_program_population(context)
    if not subjects:
        raise SystemExit("The selected Faker DW program/cut has no eligible population for publication.")

    model_id = _create_test_bundle(
        artifacts,
        "program_dropout",
        context.cadence,
        version="pred007-e2e-v1",
    )
    active = ModelRegistry(artifacts).active(
        "PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE", context.cadence
    )
    if active.model_id != model_id or active.version != "pred007-e2e-v1":
        raise RuntimeError("The isolated Faker bundle was not activated for the selected cadence.")
    # Keep test output aggregate-only; never print student identifiers.
    print(
        "Prepared isolated test bundle: "
        f"program={program_ref} cut={cut_id} cadence={context.cadence} "
        f"eligible_candidates={len(subjects)} model_version={active.version}"
    )


if __name__ == "__main__":
    main()
