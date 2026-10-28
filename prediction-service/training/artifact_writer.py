"""Artifact writer with full CRISP-DM traceability.

Writes serialized models, preprocessing pipelines, metrics, configurations,
and contract-compliant ModelManifest files to disk with SHA-256 integrity digests.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import shutil
from uuid import uuid4
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
    """Write artifacts in a staging directory and atomically promote the set.

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
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    if job_dir.exists():
        raise FileExistsError(f"Artifact directory already exists for attempt {job_id}.")
    staging_dir = artifacts_dir / f".{job_id}.tmp-{uuid4().hex}"
    staging_dir.mkdir()

    # 1. Save serialized model and pipeline
    model_path = staging_dir / "model.joblib"
    joblib.dump(model, model_path)

    pipeline_path = staging_dir / "pipeline.joblib"
    joblib.dump(preprocessing_pipeline, pipeline_path)

    # 2. Compute digest of the model artifact
    model_digest = _compute_file_digest(model_path)

    # 3. Save JSON metadata files
    (staging_dir / "metrics.json").write_text(
        json.dumps(metrics, indent=2, sort_keys=True, ensure_ascii=False),
        encoding="utf-8",
    )
    (staging_dir / "training_config.json").write_text(
        json.dumps(training_config, indent=2, sort_keys=True, ensure_ascii=False),
        encoding="utf-8",
    )
    (staging_dir / "balance_report.json").write_text(
        json.dumps(balance_report, indent=2, sort_keys=True, ensure_ascii=False),
        encoding="utf-8",
    )
    (staging_dir / "feature_names.json").write_text(
        json.dumps(feature_names, indent=2, sort_keys=True, ensure_ascii=False),
        encoding="utf-8",
    )
    (staging_dir / "dependency_lock.json").write_text(
        json.dumps(dependency_lock, indent=2, sort_keys=True, ensure_ascii=False),
        encoding="utf-8",
    )
    (staging_dir / "dataset_ref.json").write_text(
        json.dumps(dataset_ref, indent=2, sort_keys=True, ensure_ascii=False),
        encoding="utf-8",
    )

    # 4. Finalize ModelManifest with digest and paths
    final_manifest = dict(manifest)
    final_manifest["artifact_digest"] = model_digest
    final_manifest["artifact_uri"] = str((job_dir / "model.joblib").as_posix())
    final_manifest["preprocessing_ref"] = str((job_dir / "pipeline.joblib").as_posix())
    final_manifest["dependency_lock_ref"] = str((job_dir / "dependency_lock.json").as_posix())
    final_manifest["training_config_ref"] = str((job_dir / "training_config.json").as_posix())

    (staging_dir / "manifest.json").write_text(
        json.dumps(final_manifest, indent=2, sort_keys=True, ensure_ascii=False),
        encoding="utf-8",
    )

    # Promote the complete directory in one same-filesystem rename. No reader
    # can observe a partial candidate as a finished artifact set.
    os.replace(staging_dir, job_dir)
    logger.info("Artifacts for job %s successfully written to %s", job_id, job_dir)
    return final_manifest
