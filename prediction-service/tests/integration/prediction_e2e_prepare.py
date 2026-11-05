"""Prepare a test-only cadence-specific bundle from the Faker DW cut."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(SERVICE_ROOT))

from inference import InferenceFailure
from inference_adapters import DwPredictionDataProvider
from training.model_registry import ModelRegistry
from prediction_faker_e2e import _create_test_bundle


def main() -> None:
    program_ref = os.getenv("PREDICTION_E2E_PROGRAM_REF", "").strip()
    cut_id = os.getenv("PREDICTION_E2E_CUT_ID", "").strip()
    subject_ref = os.getenv("PREDICTION_E2E_SUBJECT_REF", "").strip()
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

    # Publication population membership is broader than single-profile
    # inference eligibility. Validate candidates with the exact serving feature
    # adapter, preferring the caller's reference and otherwise selecting the
    # first eligible Faker profile. The chosen reference is emitted only as a
    # machine-readable line for the parent harness, never as normal log output.
    ordered_subjects = ([subject_ref] if subject_ref in subjects else [])
    ordered_subjects.extend(subject for subject in subjects if subject != subject_ref)
    selected_subject = None
    rejection_counts: dict[str, int] = {}
    for candidate in ordered_subjects[:250]:
        try:
            provider.load_features(candidate, context, active.manifest, event_type="program_dropout")
            selected_subject = candidate
            break
        except InferenceFailure as exc:
            if exc.code not in {"INELIGIBLE_PROFILE", "RESOURCE_NOT_FOUND"}:
                raise RuntimeError(f"Faker inference preflight failed ({exc.code}); refusing to start load traffic.") from exc
            rejection_counts[exc.code] = rejection_counts.get(exc.code, 0) + 1
    if selected_subject is None:
        raise SystemExit(
            "No single-profile inference-eligible student was found among the first 250 candidates "
            "for this program/cut; verify the Faker DW's enrollment dates, cadence, and first-three-year coverage."
        )

    # Keep test output aggregate-only; never print student identifiers.
    print(
        "Prepared isolated test bundle: "
        f"program={program_ref} cut={cut_id} cadence={context.cadence} "
        f"eligible_candidates={len(subjects)} inference_rejections={json.dumps(rejection_counts, sort_keys=True)} "
        f"model_version={active.version}"
    )
    print(f"PREDICTION_E2E_SELECTED_SUBJECT_REF={selected_subject}")


if __name__ == "__main__":
    main()
