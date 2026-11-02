"""Artifact writer with full CRISP-DM traceability.

Writes serialized models, preprocessing pipelines, metrics, configurations,
and contract-compliant ModelManifest files to disk with SHA-256 integrity digests.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
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


def _compute_bundle_digest(manifest: dict[str, Any]) -> str:
    """Hash payloads and immutable model metadata, excluding approval state."""
    identity_keys = (
        "contract_version", "model_id", "version", "algorithm", "dataset_id",
        "input_schema_version", "classes", "created_at", "evaluation_ref",
        "artifact_uri", "preprocessing_ref", "dependency_lock_ref", "training_config_ref",
        "input_schema", "probability_definition",
    )
    bundle = {
        "artifact_files": manifest["artifact_files"],
        "identity": {key: manifest.get(key) for key in identity_keys},
    }
    canonical = json.dumps(bundle, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


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
    feature_schema: list[dict[str, Any]] | None = None,
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

    # Include the actual evaluation evidence, not just a dangling reference.
    evaluation_report = {
        "evaluation_ref": manifest.get("evaluation_ref"),
        "metrics": metrics,
        "protocol": training_config.get("evaluation_protocol", {}),
    }
    (staging_dir / "evaluation_report.json").write_text(
        json.dumps(evaluation_report, indent=2, sort_keys=True, ensure_ascii=False),
        encoding="utf-8",
    )

    # Hash every serving and provenance payload. The manifest is excluded to
    # avoid a circular digest; its canonical content is covered by bundle_digest.
    payload_names = [
        "model.joblib", "pipeline.joblib", "metrics.json", "evaluation_report.json",
        "training_config.json", "balance_report.json", "feature_names.json",
        "dependency_lock.json", "dataset_ref.json",
    ]
    files = {name: _compute_file_digest(staging_dir / name) for name in payload_names}
    # 4. Finalize ModelManifest with bundle integrity and serving schema.
    final_manifest = dict(manifest)
    final_manifest["artifact_files"] = files
    final_manifest["artifact_uri"] = str((job_dir / "model.joblib").as_posix())
    final_manifest["preprocessing_ref"] = str((job_dir / "pipeline.joblib").as_posix())
    final_manifest["dependency_lock_ref"] = str((job_dir / "dependency_lock.json").as_posix())
    final_manifest["training_config_ref"] = str((job_dir / "training_config.json").as_posix())
    final_manifest["input_schema"] = {
        "version": final_manifest.get("input_schema_version", "prepared-dataset-v1"),
        "feature_names": feature_names,
        "fields": feature_schema or [
            {"name": name, "logical_type": "number", "nullable": True}
            for name in feature_names
        ],
        "required": feature_names,
        "additional_properties": False,
    }
    final_manifest["probability_definition"] = {
        "positive_class": final_manifest.get("classes", {}).get("positive_class"),
        "class_order": [final_manifest.get("classes", {}).get("negative_class"),
                        final_manifest.get("classes", {}).get("positive_class")],
        "meaning": "probability of the positive/event class",
    }
    final_manifest["artifact_digest"] = _compute_bundle_digest(final_manifest)

    (staging_dir / "manifest.json").write_text(
        json.dumps(final_manifest, indent=2, sort_keys=True, ensure_ascii=False),
        encoding="utf-8",
    )

    # Promote the complete directory in one same-filesystem rename. No reader
    # can observe a partial candidate as a finished artifact set.
    os.replace(staging_dir, job_dir)
    logger.info("Artifacts for job %s successfully written to %s", job_id, job_dir)
    return final_manifest
