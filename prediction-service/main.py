"""Prediction Service API — FastAPI application."""

from __future__ import annotations

import logging
import os
import asyncio
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from config import settings
from training.job_store import IdempotencyConflict, JobStore

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

async def _outbox_recovery_loop() -> None:
    """Periodically republish committed jobs left pending by broker outages."""
    while True:
        await asyncio.sleep(float(os.getenv("PREDICTION_OUTBOX_POLL_SECONDS", "5")))
        try:
            await asyncio.to_thread(_dispatch_pending, JobStore())
        except Exception:
            logger.exception("Outbox recovery cycle failed; it will retry")


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(_outbox_recovery_loop())
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title="Prediction Service API",
    description="API para servicios de predicción y análisis prescriptivo",
    version="1.0.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Pydantic schemas — Training Jobs contract
# ---------------------------------------------------------------------------

class TrainingJobRequest(BaseModel):
    """Body for POST /v1/training-jobs."""

    dataset_ref: str = Field(min_length=1, max_length=256)
    algorithm: str = Field(pattern=r"^(random_forest|xgboost)$")
    configuration_ref: str | None = Field(default=None, max_length=128)


class AcademicCutRef(BaseModel):
    cut_id: str = Field(min_length=1, max_length=128)


class ModelReference(BaseModel):
    model_id: str = Field(min_length=1, max_length=128)
    version: str = Field(min_length=1, max_length=128)


class TrainingJobResponse(BaseModel):
    """Response for training job endpoints."""

    job_id: str
    contract_version: str = "1.0"
    dataset_ref: str
    algorithm: str
    status: str
    progress: int | None = None
    created_at: str
    started_at: str | None = None
    finished_at: str | None = None
    submitted_by: str
    model_candidate: ModelReference | None = None
    error: dict[str, Any] | None = None


class ProblemResponse(BaseModel):
    """RFC 7807 Problem Details."""

    type: str = "about:blank"
    title: str
    status: int
    detail: str | None = None
    code: str
    request_id: str


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/")
def read_root() -> dict[str, str]:
    """Endpoint de prueba para verificar que el servicio esté funcionando."""
    return {"message": "Prediction Service is running", "service": "prediction-service"}


# ---------------------------------------------------------------------------
# Legacy simulated prediction (kept for backward compatibility)
# ---------------------------------------------------------------------------

@app.post("/predict")
def predict(data: dict) -> dict:
    """Endpoint para realizar predicciones.
    Recibe datos en formato JSON y devuelve una predicción simulada.
    """
    # Aquí iría la lógica de machine learning real. Esta respuesta es temporal.

    # Simular una predicción
    result = {
        "input_data": data,
        "prediction": "95% probabilidad de éxito",
        "confidence": 0.95,
        "model_used": "modelo_prescriptivo_v2",
    }

    return result


# ---------------------------------------------------------------------------
# Training Jobs — POST /v1/training-jobs
# ---------------------------------------------------------------------------

def _make_problem(
    status: int, title: str, code: str, request_id: str, detail: str | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={
            "type": "about:blank",
            "title": title,
            "status": status,
            "detail": detail,
            "code": code,
            "request_id": request_id,
        },
    )


@app.post("/v1/training-jobs", status_code=202, response_model=TrainingJobResponse)
def submit_training_job(
    body: TrainingJobRequest,
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=16, max_length=128),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    """Solicita un entrenamiento asíncrono.

    Requiere permiso de operador ML. Nunca entrena dentro de la petición.
    El Idempotency-Key evita jobs duplicados al reintentar.
    """
    from training.job_store import JobStatus, TrainingJobRecord

    request_id = x_request_id or str(uuid4())
    store = JobStore()

    # Idempotency check
    scope = os.getenv("PREDICTION_IDEMPOTENCY_SCOPE", "development")
    existing = store.find_by_idempotency_key(idempotency_key, scope)
    if existing is not None:
        digest = store.request_digest(body.dataset_ref, body.algorithm, {"configuration_ref": body.configuration_ref})
        if existing.request_digest != digest:
            return _make_problem(409, "Idempotency conflict", "CONFLICT", request_id,
                                 detail="Idempotency-Key was already used for a different request.")
        _dispatch_pending(store)
        return TrainingJobResponse(
            job_id=existing.job_id,
            dataset_ref=existing.dataset_ref,
            algorithm=existing.algorithm,
            status=existing.status.value,
            created_at=existing.created_at,
            started_at=existing.started_at,
            finished_at=existing.finished_at,
            submitted_by=existing.submitted_by,
        )

    # Check capacity
    active_jobs = store.list_active()
    max_concurrent = int(os.getenv("WORKER_MAX_CONCURRENT_JOBS", "1"))
    if len([j for j in active_jobs if j.status == JobStatus.RUNNING]) >= max_concurrent:
        return _make_problem(
            429, "Job capacity exhausted", "JOB_CAPACITY", request_id,
            detail=f"Maximum {max_concurrent} concurrent jobs allowed.",
        )

    # Create the job record
    job_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()
    record = TrainingJobRecord(
        job_id=job_id,
        dataset_ref=body.dataset_ref,
        algorithm=body.algorithm,
        status=JobStatus.QUEUED,
        created_at=now,
        started_at=None,
        finished_at=None,
        submitted_by=os.getenv("PREDICTION_DEV_SUBJECT", "development-operator"),
        model_candidate=None,
        error=None,
        idempotency_key=idempotency_key,
        config={"configuration_ref": body.configuration_ref},
        dataset_version=body.dataset_ref,
        dependency_versions={},
    )
    record.request_digest = store.request_digest(body.dataset_ref, body.algorithm, record.config)
    try:
        record = store.create(record, scope)
    except IdempotencyConflict:
        return _make_problem(409, "Idempotency conflict", "CONFLICT", request_id,
                             detail="Idempotency-Key was already used for a different request.")
    _dispatch_pending(store)

    return TrainingJobResponse(
        job_id=record.job_id,
        dataset_ref=body.dataset_ref,
        algorithm=body.algorithm,
        status=record.status.value,
        created_at=record.created_at,
        submitted_by=record.submitted_by,
    )


# ---------------------------------------------------------------------------
# Training Jobs — GET /v1/training-jobs/{jobId}
# ---------------------------------------------------------------------------

@app.get("/v1/training-jobs/{job_id}", response_model=TrainingJobResponse)
def get_training_job(
    job_id: str,
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    """Consulta el estado de un trabajo dentro del ámbito autorizado."""
    request_id = x_request_id or str(uuid4())
    try:
        UUID(job_id)
    except ValueError:
        raise HTTPException(
            status_code=404,
            detail={
                "type": "about:blank",
                "title": "Training job not found",
                "status": 404,
                "code": "RESOURCE_NOT_FOUND",
                "request_id": request_id,
            },
        ) from None
    store = JobStore()
    record = store.get(job_id)

    if record is None:
        raise HTTPException(
            status_code=404,
            detail={
                "type": "about:blank",
                "title": "Training job not found",
                "status": 404,
                "code": "RESOURCE_NOT_FOUND",
                "request_id": request_id,
            },
        )

    model_candidate = None
    if record.model_candidate:
        model_candidate = ModelReference(
            model_id=record.model_candidate.get("model_id", ""),
            version=record.model_candidate.get("version", ""),
        )

    return TrainingJobResponse(
        job_id=record.job_id,
        dataset_ref=record.dataset_ref,
        algorithm=record.algorithm,
        status=record.status.value,
        created_at=record.created_at,
        started_at=record.started_at,
        finished_at=record.finished_at,
        submitted_by=record.submitted_by,
        model_candidate=model_candidate,
        error=record.error,
    )


def _dispatch_pending(store: JobStore) -> None:
    """Publish committed outbox entries; failed publishes remain retryable."""
    from training.tasks import train_model_task
    for job_id in store.pending_outbox():
        job = store.get(job_id)
        if job is None:
            continue
        try:
            train_model_task.apply_async(
                kwargs={"job_id": job.job_id, "dataset_ref": job.dataset_ref,
                        "algorithm": job.algorithm, "config": job.config,
                        "artifacts_dir": os.getenv("WORKER_ARTIFACTS_DIR", "/app/artifacts")},
                task_id=job.job_id,
                queue="prediction.train_model",
            )
            store.mark_published(job_id)
        except Exception as exc:
            logger.warning("Outbox dispatch pending for job %s: %s", job_id, exc)
            store.mark_published(job_id, error=exc)


# ---------------------------------------------------------------------------
# Run with uvicorn
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app" if settings.reload else app,
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level,
        reload=settings.reload,
    )
