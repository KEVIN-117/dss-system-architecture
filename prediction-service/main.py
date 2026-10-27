"""Prediction Service API — FastAPI application."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Prediction Service API",
    description="API para servicios de predicción y análisis prescriptivo",
    version="1.0.0",
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
    from training.job_store import JobStore, JobStatus, TrainingJobRecord

    request_id = x_request_id or str(uuid4())
    artifacts_dir = os.getenv("WORKER_ARTIFACTS_DIR", "/app/artifacts")
    store_path = os.getenv("WORKER_JOB_STORE_PATH", os.path.join(artifacts_dir, "job_store.json"))

    store = JobStore(Path(store_path))

    # Idempotency check
    existing = store.find_by_idempotency_key(idempotency_key)
    if existing is not None:
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
    if len(active_jobs) >= max_concurrent:
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
        submitted_by="anonymous",  # TODO: extract from JWT when auth is implemented
        model_candidate=None,
        error=None,
        idempotency_key=idempotency_key,
        config={"configuration_ref": body.configuration_ref},
        dataset_version=body.dataset_ref,
        dependency_versions={},
    )
    store.create(record)

    # Dispatch to Celery worker
    try:
        from training.tasks import train_model_task

        train_model_task.delay(
            job_id=job_id,
            dataset_ref=body.dataset_ref,
            algorithm=body.algorithm,
            config={"configuration_ref": body.configuration_ref},
            artifacts_dir=artifacts_dir,
            job_store_path=store_path,
        )
        logger.info("Training job %s dispatched for algorithm=%s", job_id, body.algorithm)
    except Exception:
        logger.exception("Failed to dispatch training job %s to Celery", job_id)
        store.update_status(
            job_id,
            JobStatus.FAILED,
            error={
                "type": "about:blank",
                "title": "Worker dispatch failed",
                "status": 503,
                "code": "INTERNAL_ERROR",
                "request_id": request_id,
            },
        )
        return _make_problem(
            503, "Worker unavailable", "INTERNAL_ERROR", request_id,
            detail="Could not dispatch training job to worker.",
        )

    return TrainingJobResponse(
        job_id=job_id,
        dataset_ref=body.dataset_ref,
        algorithm=body.algorithm,
        status=JobStatus.QUEUED.value,
        created_at=now,
        submitted_by="anonymous",
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
    from training.job_store import JobStore

    request_id = x_request_id or str(uuid4())
    artifacts_dir = os.getenv("WORKER_ARTIFACTS_DIR", "/app/artifacts")
    store_path = os.getenv("WORKER_JOB_STORE_PATH", os.path.join(artifacts_dir, "job_store.json"))

    store = JobStore(Path(store_path))
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
