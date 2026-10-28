"""Celery task definitions for isolated model training."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from celery import Celery
from celery.signals import worker_ready
from kombu import Exchange, Queue

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
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    task_ignore_result=True,  # PostgreSQL is the sole queryable job state/result store
    timezone="UTC",
    enable_utc=True,
    worker_concurrency=worker_settings.max_concurrent_jobs,
    task_time_limit=worker_settings.job_timeout_seconds,
    task_soft_time_limit=max(60, worker_settings.job_timeout_seconds - 60),
    worker_max_tasks_per_child=1,  # Recycle worker process after each task to free resources
    worker_enable_remote_control=False,  # Avoid transient pidbox queues; control is through PostgreSQL/API
    worker_enable_mingle=False,
    worker_cancel_long_running_tasks_on_connection_loss=True,
    task_acks_late=True,
    # Let RabbitMQ redeliver a late-acked message after worker loss. The DB lease
    # below allows the redelivery to reclaim only an expired RUNNING job.
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_default_queue="prediction.train_model",
    task_routes={"prediction.train_model": {"queue": "prediction.train_model"}},
    task_queues=(Queue("prediction.train_model", Exchange("prediction", type="direct", durable=True), routing_key="prediction.train_model", durable=True),),
    task_create_missing_queues=False,
    broker_transport_options={"confirm_publish": True},
)


def _resolve_dataset(dataset_ref: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Resolve and load manifest and rows from dataset_ref."""
    dataset_root = os.getenv("PREDICTION_DATASET_ROOT")
    if dataset_root and not dataset_ref.startswith(("synthetic:", "fixture:")):
        root = Path(dataset_root).resolve()
        ref_path = (root / dataset_ref).resolve()
        if root not in ref_path.parents:
            raise ValueError("Dataset reference escapes the configured snapshot root.")
    else:
        ref_path = Path(dataset_ref) if dataset_ref.startswith("synthetic:") else Path("__no_external_dataset__")
    if ref_path.is_dir() and (ref_path / "manifest.json").exists():
        manifest = json.loads((ref_path / "manifest.json").read_text(encoding="utf-8"))
        rows = [
            json.loads(line)
            for line in (ref_path / "rows.jsonl").read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        return manifest, rows

    base_fixtures = Path(__file__).parent.parent / "tests" / "fixtures"

    if dataset_ref in {"synthetic:pred003", "fixture:pred003_synthetic-v1"}:
        fixture_dir = base_fixtures / "pred003_synthetic"
    elif dataset_ref in {"synthetic:pred002", "fixture:pred002_synthetic-v1"}:
        fixture_dir = base_fixtures / "pred002_synthetic"
    elif dataset_ref.startswith("synthetic:"):
        raise FileNotFoundError(f"Unsupported synthetic dataset reference: {dataset_ref}")
    else:
        raise FileNotFoundError(f"Unknown dataset reference: {dataset_ref}")

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
) -> dict[str, Any]:
    """Execute training in an isolated Celery worker process."""
    from preparation.pipeline import prepare_dataset
    from training.artifact_writer import write_training_artifacts
    from training.configuration import resolve_training_configuration
    from training.trainer import train_model

    store = JobStore()
    artifacts_path = Path(artifacts_dir)
    config = resolve_training_configuration(config)
    seed = config.get("seed", worker_settings.random_seed)

    # Redeliveries are expected; only a queued job can be claimed.
    if not store.claim(job_id, worker_settings.job_timeout_seconds + 300):
        current = store.get(job_id)
        if current and current.status == JobStatus.RUNNING:
            # A late-acked task can be redelivered immediately after worker loss.
            # Keep it alive until the DB lease expires so the next delivery can
            # reclaim the job instead of acknowledging it and stranding RUNNING.
            raise self.retry(countdown=60, max_retries=None)
        return {"job_id": job_id, "status": current.status.value if current else "MISSING"}

    # 1. Mark as RUNNING
    now_iso = datetime.now(timezone.utc).isoformat()
    store.update_status(job_id, JobStatus.RUNNING, started_at=now_iso)
    logger.info("Starting training job %s for algorithm=%s, dataset=%s", job_id, algorithm, dataset_ref)

    try:
        # 2. Resolve dataset
        manifest, rows = _resolve_dataset(dataset_ref)
        from dataset_contract import validate_prepared_dataset
        report = validate_prepared_dataset(manifest, rows)
        if not report.ready_for_preparation:
            raise ValueError(f"Dataset is not READY_FOR_PREPARATION ({report.status}).")

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
            cpu_limit=worker_settings.cpu_limit,
            memory_limit_mb=worker_settings.memory_limit_mb,
        )

        # 5. Persist artifacts
        current_job = store.get(job_id)
        attempt_artifact_id = f"{job_id}-attempt-{current_job.attempt if current_job else 1}"
        final_manifest = write_training_artifacts(
            job_id=attempt_artifact_id,
            artifacts_dir=artifacts_path,
            model=train_result.model,
            preprocessing_pipeline=train_result.preprocessing_pipeline,
            manifest=train_result.manifest,
            metrics=train_result.metrics,
            training_config=train_result.training_config,
            balance_report=train_result.balance_report,
            feature_names=train_result.feature_names,
            dependency_lock=train_result.dependency_lock,
            dataset_ref={
                "dataset_ref": dataset_ref,
                "manifest_ref": partition.manifest_ref,
                "dataset_id": manifest.get("dataset_id"),
                "dataset_digest": manifest.get("content_digest"),
                "snapshot_ref": manifest.get("snapshot_ref"),
                "target_definition_ref": manifest.get("target_definition_ref"),
                "population_definition_ref": manifest.get("population_definition_ref"),
                "fixture_only": manifest.get("fixture_only") is True,
                "source": manifest.get("source"),
                "academic_cut": manifest.get("academic_cut"),
                "partition_id": partition.partition_metadata.get("partition_id"),
                "split_method": partition.partition_metadata.get("split_method"),
                "target_definition": manifest.get("target_definition"),
            },
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
            lease_until=None,
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
            "detail": "Training failed; inspect worker logs using the request identifier.",
            "request_id": job_id,
        }
        store.update_status(
            job_id,
            JobStatus.FAILED,
            finished_at=finished_iso,
            error=error_detail,
            lease_until=None,
        )
        return {
            "job_id": job_id,
            "status": "FAILED",
            "error": error_detail,
        }


@worker_ready.connect
def _republish_pending_outbox(sender: Any = None, **kwargs: Any) -> None:
    """Recover committed jobs whose API process died before publishing."""
    store = JobStore()
    for pending_id in store.pending_outbox():
        record = store.get(pending_id)
        if record is None:
            continue
        try:
            train_model_task.apply_async(
                kwargs={"job_id": record.job_id, "dataset_ref": record.dataset_ref,
                        "algorithm": record.algorithm, "config": record.config,
                        "artifacts_dir": worker_settings.artifacts_dir},
                task_id=record.job_id,
                queue="prediction.train_model",
            )
            store.mark_published(pending_id)
        except Exception as exc:
            store.mark_published(pending_id, error=exc)
