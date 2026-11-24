"""Celery task definitions for isolated model training."""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from celery import Celery
from celery.signals import worker_ready
from kombu import Exchange, Queue

from config import WorkerSettings, custom_dataset_roots, extracted_dataset_root
from training.job_store import JobKind, JobStatus, JobStore

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
    task_routes={
        "prediction.train_model": {"queue": "prediction.train_model"},
        # Extractions share the training worker: both are long, DW/CPU-bound
        # operator jobs bounded by the same admission control.
        "prediction.extract_dataset": {"queue": "prediction.train_model"},
        "prediction.publish_population": {"queue": "prediction.publish_population"},
    },
    task_queues=(
        Queue("prediction.train_model", Exchange("prediction", type="direct", durable=True), routing_key="prediction.train_model", durable=True),
        Queue("prediction.publish_population", Exchange("prediction", type="direct", durable=True), routing_key="prediction.publish_population", durable=True),
    ),
    task_create_missing_queues=False,
    broker_transport_options={"confirm_publish": True},
)


def _exhausted_error(request_id: str, operation: str) -> dict[str, Any]:
    return {
        "type": "about:blank",
        "title": f"{operation} attempts exhausted",
        "status": 500,
        "code": "ATTEMPTS_EXHAUSTED",
        "detail": f"{operation} did not finish within {worker_settings.max_job_attempts} attempts "
                  "(worker lost or time limit exceeded); inspect worker logs.",
        "request_id": request_id,
    }


_CUSTOM_DATASET_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}")


def _resolve_custom_dataset(name: str) -> Path:
    """Find an uploaded/provisioned dataset by opaque name in the trusted roots."""
    if not _CUSTOM_DATASET_NAME.fullmatch(name):
        raise ValueError("Custom dataset references must be opaque identifiers.")
    for root in custom_dataset_roots():
        candidate = (root / name).resolve()
        if root not in candidate.parents:
            raise ValueError("Dataset reference escapes the configured dataset root.")
        if candidate.is_dir():
            return candidate
    raise FileNotFoundError(f"Unknown dataset reference: custom:{name}")


def _resolve_dataset(dataset_ref: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Resolve and load manifest and rows from dataset_ref."""
    dataset_root = os.getenv("PREDICTION_DATASET_ROOT")
    if dataset_ref.startswith("custom:"):
        ref_path = _resolve_custom_dataset(dataset_ref.removeprefix("custom:"))
    elif dataset_root and not dataset_ref.startswith(("synthetic:", "fixture:")):
        root = Path(dataset_root).resolve()
        ref_path = (root / dataset_ref).resolve()
        if root not in ref_path.parents and ref_path != root:
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
    from preparation.pipeline import prepare_for_task
    from training.artifact_writer import write_training_artifacts
    from training.configuration import resolve_training_configuration
    from training.trainer import train_for_partition

    store = JobStore()
    artifacts_path = Path(artifacts_dir)
    config = resolve_training_configuration(config)
    seed = config.get("seed", worker_settings.random_seed)

    # Redeliveries are expected; only a queued job (or one whose lease expired)
    # can be claimed, and never more than WORKER_MAX_JOB_ATTEMPTS times.
    attempt = store.claim_attempt(job_id, worker_settings.job_timeout_seconds + 300, worker_settings.max_job_attempts)
    if attempt is None:
        if store.fail_exhausted(job_id, worker_settings.max_job_attempts, _exhausted_error(job_id, "Training")):
            logger.error("Training job %s FAILED: %s attempts exhausted", job_id, worker_settings.max_job_attempts)
            return {"job_id": job_id, "status": "FAILED"}
        current = store.get(job_id)
        if current and current.status == JobStatus.RUNNING:
            # A late-acked task can be redelivered immediately after worker loss.
            # Keep it alive until the DB lease expires so the next delivery can
            # reclaim the job (or fail it once attempts are exhausted).
            raise self.retry(countdown=60, max_retries=None)
        return {"job_id": job_id, "status": current.status.value if current else "MISSING"}

    logger.info("Starting training job %s attempt=%s algorithm=%s dataset=%s", job_id, attempt, algorithm, dataset_ref)

    try:
        # 2. Resolve dataset
        manifest, rows = _resolve_dataset(dataset_ref)
        from dataset_contract import validate_prepared_dataset
        report = validate_prepared_dataset(manifest, rows)
        if not report.ready_for_preparation:
            raise ValueError(f"Dataset is not READY_FOR_PREPARATION ({report.status}).")

        # 3. Data preparation (imputation, student-grouped temporal split, SMOTE on train)
        partition = prepare_for_task(
            manifest=manifest,
            rows=rows,
            seed=seed,
            apply_balancing=(config or {}).get("apply_balancing", True),
        )

        # 4. Train model
        train_result = train_for_partition(
            partition=partition,
            algorithm=algorithm,
            config=config,
            seed=seed,
            cpu_limit=worker_settings.cpu_limit,
            memory_limit_mb=worker_settings.memory_limit_mb,
        )

        # 5. Persist artifacts under this claim's attempt number. The dataset's
        # feature contract travels into the bundle (and its digest) so serving
        # can prove it computes features exactly as they were trained.
        if manifest.get("feature_contract") is not None:
            train_result.manifest["feature_contract"] = manifest["feature_contract"]
        attempt_artifact_id = f"{job_id}-attempt-{attempt}"
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
            feature_schema=[
                {
                    "name": field["name"],
                    "logical_type": field["logical_type"],
                    "nullable": field.get("nullable", True),
                    "available_at_cut": field.get("available_at_cut"),
                    "source_field": field.get("source_field"),
                }
                for field in manifest.get("fields", [])
                if field.get("role") == "feature"
            ],
        )

        # 6. Update store to SUCCEEDED
        finished_iso = datetime.now(timezone.utc).isoformat()
        model_candidate = {
            "model_id": final_manifest["model_id"],
            "version": final_manifest["version"],
        }
        if not store.update_status(
            job_id,
            JobStatus.SUCCEEDED,
            expected_attempt=attempt,
            finished_at=finished_iso,
            model_candidate=model_candidate,
            dependency_versions=train_result.dependency_lock,
            lease_until=None,
        ):
            if store.is_cancelled(job_id):
                # Cancelled while running: discard the candidate so a
                # cancelled job leaves no model behind.
                import shutil
                shutil.rmtree(artifacts_path / attempt_artifact_id, ignore_errors=True)
                logger.info("Training job %s was cancelled; candidate %s discarded", job_id, attempt_artifact_id)
                return {"job_id": job_id, "status": "CANCELLED", "attempt": attempt}
            # The lease expired and a newer attempt owns the job; its result wins.
            logger.warning("Training job %s attempt %s lost its lease; result left as orphan candidate %s",
                           job_id, attempt, attempt_artifact_id)
            return {"job_id": job_id, "status": "SUPERSEDED", "attempt": attempt}
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
        if not store.update_status(
            job_id,
            JobStatus.FAILED,
            expected_attempt=attempt,
            finished_at=finished_iso,
            error=error_detail,
            lease_until=None,
        ):
            logger.warning("Training job %s attempt %s lost its lease; failure not recorded", job_id, attempt)
            return {"job_id": job_id, "status": "SUPERSEDED", "attempt": attempt}
        return {
            "job_id": job_id,
            "status": "FAILED",
            "error": error_detail,
        }


@celery_app.task(bind=True, name="prediction.publish_population")
def publish_population_task(self: Any, batch_id: str, artifacts_dir: str) -> dict[str, Any]:
    """Score one authorized program/cut and atomically expose the completed batch."""
    from inference import score_bundle
    from ml_tasks import get_task
    from inference_adapters import DwPredictionDataProvider
    from training.model_registry import ModelRegistry
    from training.prediction_publication_store import PredictionPublicationStore

    store = PredictionPublicationStore()
    attempt = store.claim_attempt(batch_id, worker_settings.job_timeout_seconds + 300, worker_settings.max_job_attempts)
    if attempt is None:
        if store.fail_exhausted(batch_id, worker_settings.max_job_attempts, _exhausted_error(batch_id, "Population scoring")):
            logger.error("Prediction batch %s FAILED: %s attempts exhausted", batch_id, worker_settings.max_job_attempts)
            return {"batch_id": batch_id, "status": "FAILED"}
        current = store.get(batch_id)
        if current and current["status"] == "RUNNING":
            raise self.retry(countdown=60, max_retries=None)
        return {"batch_id": batch_id, "status": current["status"] if current else "MISSING"}

    try:
        batch = store.get(batch_id)
        if batch is None:
            raise ValueError("Prediction batch does not exist.")
        context = DwPredictionDataProvider().resolve_context(batch["program_ref"], str(batch["closure_id"]))
        registry = ModelRegistry(Path(artifacts_dir))
        event_code = batch.get("event_code") or "PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE"
        bundle = registry.active(event_code, context.cadence)
        if bundle.model_id != batch["model_id"] or bundle.version != batch["model_version"]:
            raise ValueError("The approved active model changed before scoring; resubmit against the current model.")
        data = DwPredictionDataProvider()
        # One point-in-time query for the whole program/cut, with the exact SQL
        # and eligibility rule used by single-student inference.
        population, ineligible, source_runs = data.load_population_features(
            context, bundle.manifest, event_type=get_task(event_code).serving_event_type)
        if ineligible:
            logger.info("Prediction batch %s excluded ineligible profiles: %s", batch_id, ineligible)
        generated_at = datetime.now(timezone.utc).isoformat()
        results: list[dict[str, Any]] = []
        for subject_ref, features in population.items():
            scored = score_bundle(bundle, features)
            results.append({
                "subject_ref": subject_ref,
                "program_ref": batch["program_ref"],
                "closure_id": str(batch["closure_id"]),
                "predicted_class": scored["predicted_class"],
                "event_probability": scored["event_probability"],
                "predicted_value": scored["predicted_value"],
                "prediction_interval": scored["prediction_interval"],
                "model_id": bundle.model_id,
                "model_version": bundle.version,
                "generated_at": generated_at,
            })
        store.publish(batch_id, results, source_runs, attempt=attempt)
        logger.info("Prediction batch %s published rows=%s model=%s:%s", batch_id, len(results), bundle.model_id, bundle.version)
        return {"batch_id": batch_id, "status": "PUBLISHED", "result_count": len(results)}
    except Exception as exc:
        logger.exception("Prediction batch %s failed", batch_id)
        if not store.fail(batch_id, {
            "code": getattr(exc, "code", "PREDICTION_PUBLICATION_FAILED"),
            "detail": "Population scoring failed; no complete publication is available.",
            "request_id": batch_id,
        }, attempt=attempt):
            logger.warning("Prediction batch %s attempt %s lost its lease; failure not recorded", batch_id, attempt)
            return {"batch_id": batch_id, "status": "SUPERSEDED", "attempt": attempt}
        return {"batch_id": batch_id, "status": "FAILED"}

@celery_app.task(bind=True, name="prediction.extract_dataset")
def extract_dataset_task(self: Any, job_id: str) -> dict[str, Any]:
    """Extract a prepared dataset from the DW for an EXTRACT_DATASET job (PRED-102)."""
    from training.dataset_extraction import ExtractionCancelled, ExtractionError, run_extraction, validate_params

    store = JobStore()
    attempt = store.claim_attempt(job_id, worker_settings.job_timeout_seconds + 300, worker_settings.max_job_attempts)
    if attempt is None:
        if store.fail_exhausted(job_id, worker_settings.max_job_attempts, _exhausted_error(job_id, "Dataset extraction")):
            logger.error("Extraction job %s FAILED: %s attempts exhausted", job_id, worker_settings.max_job_attempts)
            return {"job_id": job_id, "status": "FAILED"}
        current = store.get(job_id)
        if current and current.status == JobStatus.RUNNING:
            raise self.retry(countdown=60, max_retries=None)
        return {"job_id": job_id, "status": current.status.value if current else "MISSING"}

    record = store.get(job_id)
    try:
        if record is None:
            raise ExtractionError("JOB_MISSING", "The extraction job no longer exists.")
        output_root = extracted_dataset_root()
        if output_root is None:
            raise ExtractionError("DATASET_STORAGE_UNAVAILABLE", "PREDICTION_EXTRACTED_DATASET_ROOT is not configured.")
        params = validate_params(record.params)
        dataset_id = record.dataset_ref.removeprefix("custom:")
        logger.info("Starting extraction job %s attempt=%s task=%s cadence=%s", job_id, attempt,
                    params.task_code, params.cadence)
        result = run_extraction(
            params, dsn=os.getenv("PREDICTION_DW_DATABASE_URL", ""), output_root=output_root,
            dataset_id=dataset_id, job_id=job_id, requested_by=record.submitted_by,
            should_cancel=lambda: store.is_cancelled(job_id),
        )
        if not store.update_status(job_id, JobStatus.SUCCEEDED, expected_attempt=attempt,
                                   finished_at=datetime.now(timezone.utc).isoformat(),
                                   result_ref=result.dataset_ref, lease_until=None):
            if store.is_cancelled(job_id):
                import shutil
                shutil.rmtree(output_root / dataset_id, ignore_errors=True)
                logger.info("Extraction job %s was cancelled; dataset %s discarded", job_id, dataset_id)
                return {"job_id": job_id, "status": "CANCELLED"}
            logger.warning("Extraction job %s attempt %s lost its lease", job_id, attempt)
            return {"job_id": job_id, "status": "SUPERSEDED", "attempt": attempt}
        logger.info("Extraction job %s SUCCEEDED rows=%s dataset=%s", job_id, result.row_count, result.dataset_ref)
        return {"job_id": job_id, "status": "SUCCEEDED", "dataset_ref": result.dataset_ref,
                "row_count": result.row_count}
    except ExtractionCancelled:
        logger.info("Extraction job %s cancelled; partial output discarded", job_id)
        return {"job_id": job_id, "status": "CANCELLED"}
    except Exception as exc:
        logger.exception("Extraction job %s FAILED: %s", job_id, exc)
        known = isinstance(exc, ExtractionError)
        error_detail = {
            "type": "about:blank",
            "title": "Dataset extraction failed",
            "status": 422 if known else 500,
            "code": exc.code if known else "JOB_FAILED",
            "detail": str(exc) if known else "Extraction failed; inspect worker logs using the request identifier.",
            "request_id": job_id,
        }
        if not store.update_status(job_id, JobStatus.FAILED, expected_attempt=attempt,
                                   finished_at=datetime.now(timezone.utc).isoformat(),
                                   error=error_detail, lease_until=None):
            return {"job_id": job_id, "status": "SUPERSEDED", "attempt": attempt}
        return {"job_id": job_id, "status": "FAILED", "error": error_detail}


def dispatch_job(record: Any, artifacts_dir: str) -> None:
    """Publish one committed job to the broker, by job kind."""
    if record.job_kind == JobKind.EXTRACT_DATASET.value:
        extract_dataset_task.apply_async(kwargs={"job_id": record.job_id}, task_id=record.job_id,
                                         queue="prediction.train_model")
        return
    train_model_task.apply_async(
        kwargs={"job_id": record.job_id, "dataset_ref": record.dataset_ref,
                "algorithm": record.algorithm, "config": record.config,
                "artifacts_dir": artifacts_dir},
        task_id=record.job_id,
        queue="prediction.train_model",
    )


@worker_ready.connect
def _republish_pending_outbox(sender: Any = None, **kwargs: Any) -> None:
    """Recover committed jobs whose API process died before publishing."""
    store = JobStore()
    for pending_id in store.pending_outbox():
        record = store.get(pending_id)
        if record is None:
            continue
        try:
            dispatch_job(record, worker_settings.artifacts_dir)
            store.mark_published(pending_id)
        except Exception as exc:
            store.mark_published(pending_id, error=exc)
    from training.prediction_publication_store import PredictionPublicationStore
    publication_store = PredictionPublicationStore()
    for batch_id in publication_store.pending():
        batch = publication_store.get(batch_id)
        if batch is None:
            continue
        try:
            publish_population_task.apply_async(
                kwargs={"batch_id": batch_id, "artifacts_dir": worker_settings.artifacts_dir},
                task_id=batch_id,
                queue="prediction.publish_population",
            )
            publication_store.mark_dispatched(batch_id)
        except Exception as exc:
            publication_store.mark_dispatched(batch_id, error=exc)
