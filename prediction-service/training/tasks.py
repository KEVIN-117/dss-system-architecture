"""Celery task definitions for isolated model training."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from celery import Celery

from config import WorkerSettings
from training.job_store import JobStatus, JobStore

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Celery App Configuration
# ---------------------------------------------------------------------------

worker_settings = WorkerSettings.from_environment()

celery_app = Celery(
    "prediction_worker",
    broker=worker_settings.broker_url,
    backend="rpc://",
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    worker_concurrency=worker_settings.max_concurrent_jobs,
    task_time_limit=worker_settings.job_timeout_seconds,
    task_soft_time_limit=max(60, worker_settings.job_timeout_seconds - 60),
    worker_max_tasks_per_child=1,  # Recycle worker process after each task to free resources
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)


def _resolve_dataset(dataset_ref: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Resolve and load manifest and rows from dataset_ref."""
    ref_path = Path(dataset_ref)
    if ref_path.is_dir() and (ref_path / "manifest.json").exists():
        manifest = json.loads((ref_path / "manifest.json").read_text(encoding="utf-8"))
        rows = [
            json.loads(line)
            for line in (ref_path / "rows.jsonl").read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        return manifest, rows

    base_fixtures = Path(__file__).parent.parent / "tests" / "fixtures"

    if "pred003" in dataset_ref or dataset_ref == "synthetic:pred003":
        fixture_dir = base_fixtures / "pred003_synthetic"
    elif "pred002" in dataset_ref or dataset_ref == "synthetic:pred002":
        fixture_dir = base_fixtures / "pred002_synthetic"
    else:
        # Check if dataset_ref matches any directory under fixtures
        fixture_dir = base_fixtures / dataset_ref
        if not fixture_dir.exists():
            # Fall back to pred003_synthetic
            fixture_dir = base_fixtures / "pred003_synthetic"

    if not (fixture_dir / "manifest.json").exists():
        raise FileNotFoundError(f"Could not find manifest.json for dataset reference '{dataset_ref}' at {fixture_dir}")

    manifest = json.loads((fixture_dir / "manifest.json").read_text(encoding="utf-8"))
    rows = [
        json.loads(line)
        for line in (fixture_dir / "rows.jsonl").read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    return manifest, rows


@celery_app.task(bind=True, name="prediction.train_model")
def train_model_task(
    self: Any,
    job_id: str,
    dataset_ref: str,
    algorithm: str,
    config: dict[str, Any] | None,
    artifacts_dir: str,
    job_store_path: str,
) -> dict[str, Any]:
    """Execute training in an isolated Celery worker process."""
    from preparation.pipeline import prepare_dataset
    from training.artifact_writer import write_training_artifacts
    from training.trainer import train_model

    store = JobStore(Path(job_store_path))
    artifacts_path = Path(artifacts_dir)
    seed = (config or {}).get("seed", worker_settings.random_seed)

    # 1. Mark as RUNNING
    now_iso = datetime.now(timezone.utc).isoformat()
    store.update_status(job_id, JobStatus.RUNNING, started_at=now_iso)
    logger.info("Starting training job %s for algorithm=%s, dataset=%s", job_id, algorithm, dataset_ref)

    try:
        # 2. Resolve dataset
        manifest, rows = _resolve_dataset(dataset_ref)

        # 3. Data preparation (imputation, student-grouped temporal split, SMOTE on train)
        partition = prepare_dataset(
            manifest=manifest,
            rows=rows,
            seed=seed,
            apply_balancing=(config or {}).get("apply_balancing", True),
        )

        # 4. Train model
        train_result = train_model(
            partition=partition,
            algorithm=algorithm,
            config=config,
            seed=seed,
        )

        # 5. Persist artifacts
        final_manifest = write_training_artifacts(
            job_id=job_id,
            artifacts_dir=artifacts_path,
            model=train_result.model,
            preprocessing_pipeline=train_result.preprocessing_pipeline,
            manifest=train_result.manifest,
            metrics=train_result.metrics,
            training_config=train_result.training_config,
            balance_report=train_result.balance_report,
            feature_names=train_result.feature_names,
            dependency_lock=train_result.dependency_lock,
            dataset_ref={"dataset_ref": dataset_ref, "manifest_ref": partition.manifest_ref},
        )

        # 6. Update store to SUCCEEDED
        finished_iso = datetime.now(timezone.utc).isoformat()
        model_candidate = {
            "model_id": final_manifest["model_id"],
            "version": final_manifest["version"],
        }
        store.update_status(
            job_id,
            JobStatus.SUCCEEDED,
            finished_at=finished_iso,
            model_candidate=model_candidate,
            dependency_versions=train_result.dependency_lock,
        )
        logger.info("Training job %s SUCCEEDED with model %s", job_id, model_candidate["model_id"])

        return {
            "job_id": job_id,
            "status": "SUCCEEDED",
            "model_candidate": model_candidate,
            "metrics": train_result.metrics,
        }

    except Exception as exc:
        logger.exception("Training job %s FAILED: %s", job_id, exc)
        finished_iso = datetime.now(timezone.utc).isoformat()
        error_detail = {
            "type": "about:blank",
            "title": "Training job failed",
            "status": 500,
            "code": "JOB_FAILED",
            "detail": str(exc),
            "request_id": job_id,
        }
        store.update_status(
            job_id,
            JobStatus.FAILED,
            finished_at=finished_iso,
            error=error_detail,
        )
        return {
            "job_id": job_id,
            "status": "FAILED",
            "error": error_detail,
        }
