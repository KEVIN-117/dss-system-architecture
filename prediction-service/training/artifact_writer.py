"""Artifact writer with full CRISP-DM traceability.

Writes serialized models, preprocessing pipelines, metrics, configurations,
and contract-compliant ModelManifest files to disk with SHA-256 integrity digests.
"""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any

import joblib

logger = logging.getLogger(__name__)


def _compute_file_digest(file_path: Path) -> str:
    """Compute lowercase SHA-256 hex digest of a file."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def write_training_artifacts(
    job_id: str,
    artifacts_dir: Path,
    model: Any,
    preprocessing_pipeline: Any,
    manifest: dict[str, Any],
    metrics: dict[str, Any],
    training_config: dict[str, Any],
    balance_report: dict[str, Any],
    feature_names: list[str],
    dependency_lock: dict[str, str],
    dataset_ref: dict[str, Any],
) -> dict[str, Any]:
    """Write all training artifacts to {artifacts_dir}/{job_id}/.

    Generates:
        - model.joblib: serialized fitted model
        - pipeline.joblib: serialized preprocessing pipeline
        - metrics.json: evaluation metrics on test set
        - training_config.json: hyperparameters and training options
        - balance_report.json: SMOTE decision and class distributions
        - feature_names.json: list of feature names used
        - dependency_lock.json: exact versions of runtime dependencies
        - dataset_ref.json: reference to source snapshot
        - manifest.json: ModelManifest compliant with contracts, with artifact_digest

    Returns the updated manifest dictionary with artifact_digest computed.
    """
    job_dir = artifacts_dir / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    # 1. Save serialized model and pipeline
    model_path = job_dir / "model.joblib"
    joblib.dump(model, model_path)

    pipeline_path = job_dir / "pipeline.joblib"
    joblib.dump(preprocessing_pipeline, pipeline_path)

    # 2. Compute digest of the model artifact
    model_digest = _compute_file_digest(model_path)

    # 3. Save JSON metadata files
    (job_dir / "metrics.json").write_text(
        json.dumps(metrics, indent=2, sort_keys=True, ensure_ascii=False),
        encoding="utf-8",
    )
    (job_dir / "training_config.json").write_text(
        json.dumps(training_config, indent=2, sort_keys=True, ensure_ascii=False),
        encoding="utf-8",
    )
    (job_dir / "balance_report.json").write_text(
        json.dumps(balance_report, indent=2, sort_keys=True, ensure_ascii=False),
        encoding="utf-8",
    )
    (job_dir / "feature_names.json").write_text(
        json.dumps(feature_names, indent=2, sort_keys=True, ensure_ascii=False),
        encoding="utf-8",
    )
    (job_dir / "dependency_lock.json").write_text(
        json.dumps(dependency_lock, indent=2, sort_keys=True, ensure_ascii=False),
        encoding="utf-8",
    )
    (job_dir / "dataset_ref.json").write_text(
        json.dumps(dataset_ref, indent=2, sort_keys=True, ensure_ascii=False),
        encoding="utf-8",
    )

    # 4. Finalize ModelManifest with digest and paths
    final_manifest = dict(manifest)
    final_manifest["artifact_digest"] = model_digest
    final_manifest["artifact_uri"] = str(model_path.as_posix())
    final_manifest["preprocessing_ref"] = str(pipeline_path.as_posix())
    final_manifest["dependency_lock_ref"] = str((job_dir / "dependency_lock.json").as_posix())
    final_manifest["training_config_ref"] = str((job_dir / "training_config.json").as_posix())

    (job_dir / "manifest.json").write_text(
        json.dumps(final_manifest, indent=2, sort_keys=True, ensure_ascii=False),
        encoding="utf-8",
    )

    logger.info("Artifacts for job %s successfully written to %s", job_id, job_dir)
    return final_manifest
