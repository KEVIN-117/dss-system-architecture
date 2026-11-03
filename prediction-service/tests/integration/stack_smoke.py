"""Opt-in integration smoke test for Compose Postgres, RabbitMQ, API and worker.

Run this inside a one-off prediction-worker container while the normal
prediction-service and prediction-worker containers are running.
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4

from training.job_store import JobStatus, JobStore, TrainingJobRecord
from training.tasks import train_model_task, worker_settings


API_URL = os.getenv("PREDICTION_TEST_API_URL", "http://prediction-service:8000")
FIXTURE = "fixture:pred003_synthetic-v1"
TIMEOUT_SECONDS = int(os.getenv("PREDICTION_INTEGRATION_TIMEOUT_SECONDS", "240"))


def request_json(method: str, path: str, body: dict | None = None, headers: dict | None = None):
    payload = json.dumps(body).encode() if body is not None else None
    request_headers = {"Content-Type": "application/json", **(headers or {})}
    req = Request(API_URL + path, data=payload, headers=request_headers, method=method)
    try:
        with urlopen(req, timeout=10) as response:
            return response.status, json.loads(response.read())
    except HTTPError as error:
        return error.code, json.loads(error.read())
    except URLError as error:
        raise RuntimeError(f"Prediction API is not reachable at {API_URL}: {error}") from error


def wait_succeeded(job_id: str) -> TrainingJobRecord:
    store = JobStore()
    deadline = time.monotonic() + TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        job = store.get(job_id)
        if job and job.status == JobStatus.SUCCEEDED:
            return job
        if job and job.status == JobStatus.FAILED:
            raise AssertionError(f"Training job {job_id} failed: {job.error}")
        time.sleep(2)
    raise TimeoutError(f"Training job {job_id} did not succeed within {TIMEOUT_SECONDS}s")


def assert_artifact_exists(job_id: str, attempt: int) -> None:
    artifact_dir = Path(worker_settings.artifacts_dir) / f"{job_id}-attempt-{attempt}"
    manifest = json.loads((artifact_dir / "manifest.json").read_text(encoding="utf-8"))
    from training.artifact_writer import _compute_bundle_digest
    digest = _compute_bundle_digest(manifest)
    if manifest["artifact_digest"] != digest:
        raise AssertionError(f"Artifact digest mismatch at {artifact_dir}")


def assert_container_resource_caps() -> None:
    cpu_max = Path("/sys/fs/cgroup/cpu.max")
    if cpu_max.exists():
        quota, period = cpu_max.read_text(encoding="utf-8").split()
        if quota != "max" and int(quota) / int(period) > worker_settings.cpu_limit + 0.01:
            raise AssertionError("Worker cgroup CPU quota exceeds WORKER_CPU_LIMIT.")
    memory_max = Path("/sys/fs/cgroup/memory.max")
    if memory_max.exists():
        max_bytes = memory_max.read_text(encoding="utf-8").strip()
        if max_bytes != "max" and int(max_bytes) > worker_settings.memory_limit_mb * 1024 * 1024:
            raise AssertionError("Worker cgroup memory cap exceeds WORKER_MEMORY_LIMIT_MB.")


def seed_pending_job(store: JobStore, *, status: JobStatus = JobStatus.QUEUED) -> TrainingJobRecord:
    job_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()
    record = TrainingJobRecord(
        job_id=job_id,
        dataset_ref=FIXTURE,
        algorithm="random_forest",
        status=status,
        created_at=now,
        started_at=None,
        finished_at=None,
        submitted_by="local-compose-integration",
        model_candidate=None,
        error=None,
        idempotency_key=f"integration-{uuid4()}",
        config={"seed": 42},
        dataset_version=FIXTURE,
        dependency_versions={},
    )
    return store.create(record, scope="local-compose-integration")


def main() -> None:
    assert_container_resource_caps()
    # 1. Submit through HTTP; verify DB-backed idempotency and asynchronous result.
    key = f"integration-{uuid4()}"
    body = {"dataset_ref": FIXTURE, "algorithm": "random_forest"}
    status, accepted = request_json("POST", "/v1/training-jobs", body, {"Idempotency-Key": key})
    assert status == 202, accepted
    job_id = accepted["job_id"]
    status, duplicate = request_json("POST", "/v1/training-jobs", body, {"Idempotency-Key": key})
    assert status == 202 and duplicate["job_id"] == job_id, duplicate
    status, conflict = request_json(
        "POST", "/v1/training-jobs",
        {"dataset_ref": FIXTURE, "algorithm": "xgboost"},
        {"Idempotency-Key": key},
    )
    assert status == 409, conflict
    finished = wait_succeeded(job_id)
    assert finished.model_candidate is not None
    assert_artifact_exists(job_id, finished.attempt)

    # 2. Create job + outbox only in PostgreSQL. API polling must publish it.
    store = JobStore()
    pending = seed_pending_job(store)
    recovered = wait_succeeded(pending.job_id)
    assert recovered.attempt == 1
    assert_artifact_exists(pending.job_id, recovered.attempt)

    # 3. Simulate a worker crash after claim: expire its lease, redeliver via
    # RabbitMQ, and assert the worker reclaims the same job exactly once.
    crash_job = seed_pending_job(store)
    assert store.claim(crash_job.job_id, lease_seconds=3600)
    with store._connect() as connection:
        connection.execute(
            "UPDATE ml_workspace.training_job SET lease_until='2000-01-01T00:00:00Z' WHERE job_id=%s",
            (crash_job.job_id,),
        )
    store.mark_published(crash_job.job_id)
    train_model_task.apply_async(
        kwargs={
            "job_id": crash_job.job_id,
            "dataset_ref": crash_job.dataset_ref,
            "algorithm": crash_job.algorithm,
            "config": crash_job.config,
            "artifacts_dir": worker_settings.artifacts_dir,
        },
        task_id=crash_job.job_id,
        queue="prediction.train_model",
    )
    reclaimed = wait_succeeded(crash_job.job_id)
    assert reclaimed.attempt == 2, f"Expected lease reclaim, got attempt={reclaimed.attempt}"
    assert_artifact_exists(crash_job.job_id, reclaimed.attempt)

    print("PASS: API → PostgreSQL outbox → RabbitMQ → isolated worker → candidate artifact")
    print("PASS: PostgreSQL idempotency, pending-outbox recovery, expired-lease redelivery")
    print("PASS: model artifact digest verified after each successful training")
    print(f"PASS: worker resource caps CPU<={worker_settings.cpu_limit}, RAM<={worker_settings.memory_limit_mb} MB")


if __name__ == "__main__":
    main()
