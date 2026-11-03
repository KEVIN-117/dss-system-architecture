"""Create an isolated, explicitly test-only active bundle for Compose smoke.

This writes only to the smoke Compose project's named volume. It uses no
institutional dataset and is not an approval or model promotion procedure.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from sklearn.dummy import DummyClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from training.artifact_writer import write_training_artifacts
from training.model_registry import ModelRegistry


def main() -> None:
    artifacts_dir = Path(os.environ["WORKER_ARTIFACTS_DIR"])
    model_id = "compose-smoke-model"
    version = "smoke-v1"
    name = "compose-smoke-candidate"
    values = [[1.0], [2.0], [3.0], [4.0]]
    labels = [0, 0, 1, 1]
    model = DummyClassifier(strategy="prior").fit(values, labels)
    pipeline = Pipeline([("scale", StandardScaler())]).fit(values)
    manifest = {
        "contract_version": "1.0",
        "model_id": model_id,
        "version": version,
        "algorithm": "random_forest",
        "dataset_id": "compose-smoke-only",
        "input_schema_version": "compose-smoke-v1",
        "classes": {
            "negative_class": "NO_RISK",
            "positive_class": "RISK",
            "event_code": "PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE",
        },
        "serving_scope": {
            "event_type": "program_dropout",
            "cadence": "ANUAL",
            "evaluation_unit": "student_program_academic_cut",
        },
        "created_at": "2026-11-02T00:00:00Z",
        "evaluation_ref": "compose-smoke-only",
        "lifecycle_state": "CANDIDATE",
    }
    result = write_training_artifacts(
        job_id=name,
        artifacts_dir=artifacts_dir,
        model=model,
        preprocessing_pipeline=pipeline,
        manifest=manifest,
        metrics={"accuracy": 1.0},
        training_config={"evaluation_protocol": {"purpose": "compose-smoke-only"}},
        balance_report={"technique": None},
        feature_names=["smoke_feature"],
        dependency_lock={
            "python": __import__("platform").python_version(),
            "scikit_learn": __import__("sklearn").__version__,
            "xgboost": __import__("xgboost").__version__,
            "joblib": __import__("joblib").__version__,
        },
        dataset_ref={
            "dataset_ref": "compose-smoke-only",
            "dataset_digest": "compose-smoke-only",
            "fixture_only": False,
        },
    )
    report = {
        "decision_status": "APTO",
        "crisp_dm_next_step": {"deployment_allowed": True},
        "evidence_kind": "integration_test",
        "dataset": {"fixture_only": False, "dataset_digest": "compose-smoke-only"},
        "evaluation_identity": {"classes": manifest["classes"]},
        "candidate_selection_status": "SELECTED_BY_VALIDATION",
        "selected_candidate_by_validation": model_id,
        "models": [{
            "model_id": model_id,
            "version": version,
            "artifact_digest": result["artifact_digest"],
        }],
    }
    report_path = artifacts_dir / "compose-smoke-approval.json"
    report_path.write_text(json.dumps(report), encoding="utf-8")
    pointer = ModelRegistry(artifacts_dir).promote(
        model_id, version, "compose-smoke-test-only", report_path
    )
    print(json.dumps({
        "model_id": pointer["model_id"],
        "version": pointer["version"],
        "artifact_digest": pointer["artifact_digest"],
    }))


if __name__ == "__main__":
    main()
