"""Prediction Service API — FastAPI application."""

from __future__ import annotations

import logging
import os
import asyncio
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from io import BytesIO
import hashlib
import json
import re
import shutil
import zipfile
from fastapi import FastAPI, File, Header, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator

from config import (
    custom_dataset_roots,
    dataset_max_uncompressed_bytes,
    dataset_upload_max_bytes,
    extracted_dataset_root,
    settings,
)
from dataset_contract import DatasetValidationReport, validate_prepared_dataset
from ml_tasks import get_task, list_tasks, task_for_event_type
from ml_tasks.catalog import event_code_pattern, event_type_pattern
from training.job_store import IdempotencyConflict, JobStore
from training.model_registry import InvalidModelArtifact, ModelRegistry, NoActiveModel
import access_policy
from inference import InferenceFailure, PredictionService, Principal
from inference_adapters import ConfiguredAcademicPolicy, DwPredictionDataProvider, KeycloakIdentityProvider

logger = logging.getLogger(__name__)


@lru_cache(maxsize=8)
def _model_registry(artifacts_dir: str) -> ModelRegistry:
    return ModelRegistry(Path(artifacts_dir))

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
    # Validar configuración de entorno de forma Fail-Fast en startup
    settings.validate_runtime()
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
    # ridge only applies to regression tasks; the API checks it against the task.
    algorithm: str = Field(pattern=r"^(random_forest|xgboost|ridge)$")
    configuration_ref: str | None = Field(default=None, max_length=128)
    # PRED-103: inline hyperparameter grid, validated per algorithm.
    search_space: dict[str, list[Any]] | None = None


class TrainingStudyRequest(BaseModel):
    """Body for POST /v1/training-studies: one job per algorithm on one dataset."""
    model_config = ConfigDict(extra="forbid")
    dataset_ref: str = Field(min_length=1, max_length=256)
    algorithms: list[str] = Field(min_length=1, max_length=3)
    configuration_ref: str | None = Field(default=None, max_length=128)
    search_spaces: dict[str, dict[str, list[Any]]] | None = None


class TrainingStudyResponse(BaseModel):
    study_id: str
    dataset_ref: str
    task_code: str | None = None
    jobs: list["TrainingJobResponse"]


# Inline search spaces: allowed parameters and value checks per algorithm.
def _int_range(low: int, high: int, allow_none: bool = False):
    return lambda v: (v is None and allow_none) or (isinstance(v, int) and not isinstance(v, bool) and low <= v <= high)


def _float_range(low: float, high: float, low_inclusive: bool = False):
    def check(v: Any) -> bool:
        return (isinstance(v, (int, float)) and not isinstance(v, bool)
                and (v >= low if low_inclusive else v > low) and v <= high)
    return check


_SEARCH_SPACE_RULES: dict[str, dict[str, Any]] = {
    "ridge": {"alpha": _float_range(0.0, 1e6)},
    "random_forest": {
        "n_estimators": _int_range(10, 1000),
        "max_depth": _int_range(1, 64, allow_none=True),
        "min_samples_split": _int_range(2, 100),
        "min_samples_leaf": _int_range(1, 100),
        "max_features": lambda v: v in (None, "sqrt", "log2") or _float_range(0.0, 1.0)(v),
    },
    "xgboost": {
        "n_estimators": _int_range(10, 1000),
        "max_depth": _int_range(1, 16),
        "learning_rate": _float_range(0.0, 1.0),
        "subsample": _float_range(0.0, 1.0),
        "colsample_bytree": _float_range(0.0, 1.0),
        "min_child_weight": _float_range(0.0, 100.0, low_inclusive=True),
    },
}
_MAX_VALUES_PER_PARAMETER = 10
_MAX_GRID_CANDIDATES = 64


class AcademicCutRef(BaseModel):
    cut_id: str = Field(min_length=1, max_length=128)


class ModelReference(BaseModel):
    model_id: str = Field(min_length=1, max_length=128)
    version: str = Field(min_length=1, max_length=128)


class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    contract_version: str = Field(pattern=r"^1\.0$")
    event_type: str = Field(default="program_dropout", pattern=event_type_pattern())
    subject_ref: str = Field(min_length=1, max_length=128)
    program_ref: str = Field(min_length=1, max_length=64)
    course_ref: str | None = Field(default=None, min_length=1, max_length=128)
    academic_cut: AcademicCutRef

    @model_validator(mode="after")
    def validate_event_scope(self):
        task = task_for_event_type(self.event_type)
        if task.requires_course_ref and not self.course_ref:
            raise ValueError(f"course_ref is required for {self.event_type}")
        if not task.requires_course_ref and self.course_ref is not None:
            raise ValueError("course_ref is only valid for course-level events")
        return self


class PredictionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    contract_version: str = "1.0"
    prediction_id: UUID
    subject_ref: str
    program_ref: str
    event_type: str = Field(default="program_dropout", pattern=event_type_pattern())
    course_ref: str | None = None
    event_code: str
    task_kind: str = "classification"
    predicted_class: str | None = Field(default=None, pattern=r"^(POSITIVE_EVENT|NEGATIVE_EVENT)$")
    event_probability: float | None = Field(default=None, ge=0, le=1)
    # Regression tasks (PRED-103): value and residual intervals by level.
    predicted_value: float | None = None
    prediction_interval: dict[str, dict[str, float]] | None = None
    unit: str | None = None
    model: ModelReference
    academic_cut: AcademicCutRef
    generated_at: datetime


class PredictionBatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contract_version: str = Field(default="1.0", pattern=r"^1\.0$")
    # Student-level tasks (PRED-103); course-level tasks are scored on demand only.
    event_type: str = Field(default="program_dropout", pattern=r"^(program_dropout|student_backlog|student_gpa)$")
    program_ref: str = Field(min_length=1, max_length=64)
    academic_cut: AcademicCutRef


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
    job_kind: str = "TRAIN"
    params: dict[str, Any] | None = None
    result_ref: str | None = None
    study_id: str | None = None


class ProblemResponse(BaseModel):
    """RFC 7807 Problem Details."""

    type: str = "about:blank"
    title: str
    status: int
    detail: str | None = None
    code: str
    request_id: str


COMMON_ERROR_RESPONSES = {
    400: {"model": ProblemResponse, "description": "Solicitud inválida (RFC 7807)"},
    401: {"model": ProblemResponse, "description": "No autorizado / Token inválido"},
    403: {"model": ProblemResponse, "description": "Ámbito o permisos insuficientes"},
    404: {"model": ProblemResponse, "description": "Recurso no encontrado"},
    409: {"model": ProblemResponse, "description": "Conflicto de idempotencia"},
    422: {"model": ProblemResponse, "description": "Perfil no elegible o parámetros no procesables"},
    500: {"model": ProblemResponse, "description": "Error interno del servidor"},
    503: {"model": ProblemResponse, "description": "Servicio o modelo no disponible"},
}


class DetailedHealthResponse(BaseModel):
    """Diagnóstico operativo y métricas de salud del servicio."""

    status: str
    service: str = "prediction-service"
    environment: str
    active_model: dict[str, Any] | None = None
    database: dict[str, Any]
    outbox: dict[str, Any]
    timestamp: str


class DatasetSummary(BaseModel):
    """Resumen de metadatos de un dataset de entrenamiento disponible."""

    dataset_ref: str
    dataset_id: str
    label: str
    description: str | None = None
    is_custom: bool = False
    row_count: int
    target_field: str | None = None
    event_code: str | None = None
    created_at: str | None = None
    content_digest: str | None = None


class DatasetUploadResponse(BaseModel):
    """Respuesta tras subir y validar exitosamente un dataset."""

    message: str
    dataset_ref: str
    dataset_id: str
    row_count: int
    content_digest: str
    target_field: str
    event_code: str | None = None


# ---------------------------------------------------------------------------
# Health check & Operability diagnostics
# ---------------------------------------------------------------------------

@app.get("/")
def read_root() -> dict[str, str]:
    """Endpoint de prueba para verificar que el servicio esté funcionando."""
    return {"message": "Prediction Service is running", "service": "prediction-service"}


@app.get(
    "/v1/health/ready",
    response_model=DetailedHealthResponse,
    summary="Readiness probe y diagnóstico de componentes",
    description="Verifica conectividad básica al JobStore/PostgreSQL, estado de outbox y disponibilidad de modelo activo.",
    responses={503: {"model": ProblemResponse, "description": "Servicio degradado o no disponible"}},
)
def readiness_check() -> Any:
    now_iso = datetime.now(timezone.utc).isoformat()
    db_status = {"connected": False, "error": None}
    outbox_status = {"pending_count": 0, "error": None}
    active_model_info = None

    # Verificar conectividad a store
    try:
        store = JobStore()
        active_jobs = store.list_active()
        pending = store.pending_outbox(limit=10)
        db_status["connected"] = True
        db_status["active_jobs_count"] = len(active_jobs)
        outbox_status["pending_count"] = len(pending)
    except Exception as exc:
        db_status["error"] = str(exc)
        outbox_status["error"] = str(exc)

    # Verificar modelo activo
    try:
        registry = _model_registry(os.getenv("WORKER_ARTIFACTS_DIR", "/app/artifacts"))
        bundle = registry.active()
        active_model_info = {
            "model_id": bundle.model_id,
            "version": bundle.version,
            "algorithm": bundle.manifest.get("algorithm"),
            "event_code": bundle.manifest.get("classes", {}).get("event_code"),
        }
    except Exception as exc:
        active_model_info = {"status": "NO_ACTIVE_MODEL", "detail": str(exc)}

    is_healthy = db_status["connected"]
    status_str = "READY" if is_healthy else "DEGRADED"

    response_payload = {
        "status": status_str,
        "service": "prediction-service",
        "environment": settings.environment,
        "active_model": active_model_info,
        "database": db_status,
        "outbox": outbox_status,
        "timestamp": now_iso,
    }

    if not is_healthy:
        return JSONResponse(status_code=503, content=response_payload)
    return response_payload


@app.get(
    "/metrics",
    summary="Métricas operativas en formato texto Prometheus",
    description="Expone métricas del estado del servicio, jobs activos y outbox para observabilidad.",
)
def get_metrics() -> Any:
    from fastapi.responses import PlainTextResponse

    lines = [
        "# HELP prediction_service_up Indicates whether the service is operational (1) or degraded (0)",
        "# TYPE prediction_service_up gauge",
    ]
    try:
        store = JobStore()
        active_jobs = store.list_active()
        pending = store.pending_outbox(limit=500)
        lines.append("prediction_service_up 1")
        lines.append("# HELP prediction_active_jobs_count Number of currently active training jobs")
        lines.append("# TYPE prediction_active_jobs_count gauge")
        lines.append(f"prediction_active_jobs_count {len(active_jobs)}")
        lines.append("# HELP prediction_pending_outbox_count Number of pending outbox events awaiting dispatch")
        lines.append("# TYPE prediction_pending_outbox_count gauge")
        lines.append(f"prediction_pending_outbox_count {len(pending)}")
    except Exception:
        lines.append("prediction_service_up 0")

    # Modelo activo
    lines.append("# HELP prediction_active_model_available Indicates if an active approved model is loaded")
    lines.append("# TYPE prediction_active_model_available gauge")
    try:
        registry = _model_registry(os.getenv("WORKER_ARTIFACTS_DIR", "/app/artifacts"))
        registry.active()
        lines.append("prediction_active_model_available 1")
    except Exception:
        lines.append("prediction_active_model_available 0")

    return PlainTextResponse("\n".join(lines) + "\n", media_type="text/plain; version=0.0.4; charset=utf-8")


# ---------------------------------------------------------------------------
# Prediction from one explicitly activated, integrity-checked bundle
# ---------------------------------------------------------------------------

@app.post(
    "/predict",
    deprecated=True,
    summary="Legacy prediction endpoint (DEPRECATED)",
    description="Endpoint deprecado sin verificación de contexto DW seguro. Use POST /v1/predictions en su lugar.",
    responses={503: {"model": ProblemResponse, "description": "Servicio no disponible o sin modelo activo"}},
)
def predict_legacy(data: dict) -> dict:
    """Legacy route: refuse fake inference until a trusted DW adapter exists."""
    registry = _model_registry(os.getenv("WORKER_ARTIFACTS_DIR", "/app/artifacts"))
    try:
        bundle = registry.active()
    except NoActiveModel as exc:
        raise HTTPException(status_code=503, detail={"code": "NO_ACTIVE_MODEL", "detail": str(exc)}) from exc
    except InvalidModelArtifact as exc:
        logger.exception("Active model failed integrity/compatibility validation")
        raise HTTPException(status_code=503, detail={"code": "ACTIVE_MODEL_UNAVAILABLE", "detail": str(exc)}) from exc

    # PRED-001 requires server-side resolution of an authorized subject/program
    # and cut. This legacy route accepts only client JSON, so it must not score
    # those values as if they were trusted DW features.
    raise HTTPException(status_code=503, detail={
        "code": "TRUSTED_FEATURE_SOURCE_UNAVAILABLE",
        "model_id": bundle.model_id,
        "model_version": bundle.version,
        "detail": "The approved bundle is loaded as one pinned version, but no trusted DW feature adapter is configured.",
    })


@app.post(
    "/v1/predictions",
    response_model=PredictionResponse,
    summary="Inferencia puntual de riesgo académico",
    description="Calcula la predicción para un estudiante usando features auditables de punto en tiempo del DW.",
    responses={
        400: COMMON_ERROR_RESPONSES[400],
        401: COMMON_ERROR_RESPONSES[401],
        403: COMMON_ERROR_RESPONSES[403],
        404: COMMON_ERROR_RESPONSES[404],
        422: COMMON_ERROR_RESPONSES[422],
        500: COMMON_ERROR_RESPONSES[500],
        503: COMMON_ERROR_RESPONSES[503],
    },
)
def predict_v1(
    body: PredictionRequest,
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    """Score one eligible student using trusted DW features and one approved bundle."""
    request_id = x_request_id or str(uuid4())
    if not authorization or not authorization.startswith("Bearer ") or not authorization[7:].strip():
        return JSONResponse(
            status_code=401,
            media_type="application/problem+json",
            content={"type": "about:blank", "title": "Unauthorized", "status": 401,
                     "code": "INVALID_TOKEN", "request_id": request_id},
        )
    try:
        service = getattr(app.state, "prediction_service", None)
        if service is None:
            registry = _model_registry(os.getenv("WORKER_ARTIFACTS_DIR", "/app/artifacts"))
            service = PredictionService(
                registry,
                KeycloakIdentityProvider(),
                DwPredictionDataProvider(),
                ConfiguredAcademicPolicy(),
            )
        return service.predict(
            authorization[7:].strip(), body.subject_ref, body.program_ref, body.academic_cut.cut_id,
            body.event_type, body.course_ref,
        )
    except InferenceFailure as exc:
        return JSONResponse(
            status_code=exc.status_code,
            media_type="application/problem+json",
            content={"type": "about:blank", "title": "Prediction request failed", "status": exc.status_code,
                     "detail": exc.detail, "code": exc.code, "request_id": request_id},
        )
    except Exception:
        logger.exception("Prediction inference failed request_id=%s", request_id)
        return JSONResponse(
            status_code=500,
            media_type="application/problem+json",
            content={"type": "about:blank", "title": "Prediction failed", "status": 500,
                     "detail": "The prediction could not be completed.", "code": "INTERNAL_ERROR",
                     "request_id": request_id},
        )


def _publication_service():
    service = getattr(app.state, "publication_service", None)
    if service is None:
        from training.population_publication import PopulationPublicationService
        service = PopulationPublicationService()
    return service


def _publication_error(exc: InferenceFailure, request_id: str) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        media_type="application/problem+json",
        content={"type": "about:blank", "title": "Prediction publication request failed",
                 "status": exc.status_code, "detail": exc.detail, "code": exc.code,
                 "request_id": request_id},
    )


@app.get(
    "/v1/academic-options",
    summary="Listar opciones académicas autorizadas",
    description="Devuelve programas y cortes procesados visibles según los roles y facultades del token.",
    responses={
        401: COMMON_ERROR_RESPONSES[401],
        403: COMMON_ERROR_RESPONSES[403],
        503: COMMON_ERROR_RESPONSES[503],
    },
)
def get_prediction_academic_options(
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    """List processed programs and cuts filtered by the caller's academic role scope."""
    request_id = x_request_id or str(uuid4())
    if not authorization or not authorization.startswith("Bearer "):
        return _make_problem(401, "Unauthorized", "INVALID_TOKEN", request_id)
    try:
        options = _publication_service().academic_options(authorization[7:].strip())
        return JSONResponse(content=options, headers={"Cache-Control": "no-store"})
    except InferenceFailure as exc:
        return _publication_error(exc, request_id)
    except Exception:
        logger.exception("Prediction academic options query failed request_id=%s", request_id)
        return _make_problem(503, "Academic options unavailable", "PREDICTION_OPTIONS_UNAVAILABLE", request_id)


@app.post(
    "/v1/prediction-batches",
    status_code=202,
    summary="Encolar scoring poblacional",
    description="Autoriza un programa/corte y envía la tarea de puntuación por lotes de forma asíncrona.",
    responses={
        400: COMMON_ERROR_RESPONSES[400],
        401: COMMON_ERROR_RESPONSES[401],
        403: COMMON_ERROR_RESPONSES[403],
        409: COMMON_ERROR_RESPONSES[409],
        503: COMMON_ERROR_RESPONSES[503],
    },
)
def submit_prediction_batch(
    body: PredictionBatchRequest,
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=16, max_length=128),
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    """Authorize one program/cut, pin its active model, then enqueue population scoring."""
    request_id = x_request_id or str(uuid4())
    if not authorization or not authorization.startswith("Bearer "):
        return _make_problem(401, "Unauthorized", "INVALID_TOKEN", request_id)
    try:
        service = _publication_service()
        batch = service.submit(authorization[7:].strip(), body.program_ref,
                               body.academic_cut.cut_id, idempotency_key, body.event_type)
        _dispatch_pending_prediction_batches(service.store)
        return JSONResponse(status_code=202, content=batch, headers={"Cache-Control": "no-store"})
    except InferenceFailure as exc:
        return _publication_error(exc, request_id)
    except Exception:
        logger.exception("Prediction batch submission failed request_id=%s", request_id)
        return _make_problem(503, "Publication unavailable", "PREDICTION_PUBLICATION_UNAVAILABLE", request_id)


@app.get(
    "/v1/prediction-publications",
    summary="Consultar publicación poblacional vigente",
    description="Devuelve únicamente el último lote completado y publicado tras autorización académica del servidor.",
    responses={
        400: COMMON_ERROR_RESPONSES[400],
        401: COMMON_ERROR_RESPONSES[401],
        403: COMMON_ERROR_RESPONSES[403],
        503: COMMON_ERROR_RESPONSES[503],
    },
)
def get_current_prediction_publication(
    program_ref: str = Query(min_length=1, max_length=64),
    cut_id: str = Query(min_length=1, max_length=128),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0, le=25000),
    event_type: str = Query(default="program_dropout", pattern=r"^(program_dropout|student_backlog|student_gpa)$"),
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    """Return only the latest complete batch after server-side academic authorization."""
    request_id = x_request_id or str(uuid4())
    if not authorization or not authorization.startswith("Bearer "):
        return _make_problem(401, "Unauthorized", "INVALID_TOKEN", request_id)
    try:
        result = _publication_service().current(authorization[7:].strip(), program_ref, cut_id, limit, offset, event_type)
        return JSONResponse(content=result, headers={"Cache-Control": "no-store"})
    except InferenceFailure as exc:
        return _publication_error(exc, request_id)
    except Exception:
        logger.exception("Prediction publication query failed request_id=%s", request_id)
        return _make_problem(503, "Publication unavailable", "PREDICTION_PUBLICATION_UNAVAILABLE", request_id)


@app.get(
    "/v1/prediction-batches/{batch_id}",
    summary="Consultar estado de un lote de predicción",
    description="Devuelve el estado y los resultados (si está publicado) de un lote específico.",
    responses={
        401: COMMON_ERROR_RESPONSES[401],
        403: COMMON_ERROR_RESPONSES[403],
        404: COMMON_ERROR_RESPONSES[404],
        503: COMMON_ERROR_RESPONSES[503],
    },
)
def get_prediction_batch(
    batch_id: str,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0, le=25000),
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    request_id = x_request_id or str(uuid4())
    if not authorization or not authorization.startswith("Bearer "):
        return _make_problem(401, "Unauthorized", "INVALID_TOKEN", request_id)
    try:
        UUID(batch_id)
        result = _publication_service().get_batch(authorization[7:].strip(), batch_id, limit, offset)
        return JSONResponse(content=result, headers={"Cache-Control": "no-store"})
    except ValueError:
        return _make_problem(404, "Prediction batch not found", "RESOURCE_NOT_FOUND", request_id)
    except InferenceFailure as exc:
        return _publication_error(exc, request_id)
    except Exception:
        logger.exception("Prediction batch query failed request_id=%s", request_id)
        return _make_problem(503, "Publication unavailable", "PREDICTION_PUBLICATION_UNAVAILABLE", request_id)
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


def _failure_response(exc: InferenceFailure, request_id: str, title: str) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        media_type="application/problem+json",
        content={"type": "about:blank", "title": title, "status": exc.status_code,
                 "detail": exc.detail, "code": exc.code, "request_id": request_id},
    )




def _positive_int_env(name: str, default: int, minimum: int = 1) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        value = int(raw.strip())
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer >= {minimum}.") from exc
    if value < minimum:
        raise ValueError(f"{name} must be an integer >= {minimum}.")
    return value


def _training_job_response(record: Any) -> TrainingJobResponse:
    model_candidate = None
    if record.model_candidate:
        model_candidate = ModelReference(
            model_id=record.model_candidate.get("model_id", ""),
            version=record.model_candidate.get("version", ""),
        )
    return TrainingJobResponse(
        job_id=record.job_id, dataset_ref=record.dataset_ref, algorithm=record.algorithm,
        status=record.status.value, created_at=record.created_at, started_at=record.started_at,
        finished_at=record.finished_at, submitted_by=record.submitted_by,
        model_candidate=model_candidate, error=record.error,
        job_kind=getattr(record, "job_kind", "TRAIN"), params=getattr(record, "params", None) or None,
        result_ref=getattr(record, "result_ref", None),
        study_id=(record.config or {}).get("study_id") if isinstance(record.config, dict) else None,
    )


def _authenticate_ml_operator(authorization: str | None) -> Principal:
    """Verify the bearer JWT in this service; the BFF check is not the only gate."""
    if not authorization or not authorization.startswith("Bearer ") or not authorization[7:].strip():
        raise InferenceFailure("INVALID_TOKEN", 401, "A bearer access token is required.")
    # prediction:train from dss-permissions (IAM-013).
    identity = getattr(app.state, "identity_provider", None) or KeycloakIdentityProvider()
    principal = identity.authenticate(authorization[7:].strip())
    if not access_policy.has_permission(principal, access_policy.PREDICTION_TRAIN):
        raise InferenceFailure("INSUFFICIENT_SCOPE", 403, "The account cannot operate model training or datasets.")
    return principal


class MlTaskSummary(BaseModel):
    """Prediction task (target) from the catalog, for admin portal forms."""
    code: str
    kind: str
    subject: str
    grain: str
    title: str
    description: str
    target_field: str
    target_label: str
    population_label: str
    algorithms: list[str]
    primary_metric: str
    cadences: list[str]
    positive_class: str | None = None
    negative_class: str | None = None
    serving_event_type: str | None = None
    servable: bool
    requires_course_ref: bool
    extractable: bool
    definition_version: str
    target_definition_ref: str
    population_definition_ref: str
    sources: list[str]
    target_unit: str | None = None
    required_features: list[str] = []


@app.get(
    "/v1/ml-tasks",
    response_model=list[MlTaskSummary],
    summary="Listar el catálogo de tareas de predicción",
    description="Requiere el permiso prediction:train. Objetivos que se pueden extraer, entrenar y servir.",
    responses={
        401: COMMON_ERROR_RESPONSES[401],
        403: COMMON_ERROR_RESPONSES[403],
        503: COMMON_ERROR_RESPONSES[503],
    },
)
def list_ml_tasks(
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    request_id = x_request_id or str(uuid4())
    try:
        _authenticate_ml_operator(authorization)
    except InferenceFailure as exc:
        return _failure_response(exc, request_id, "ML task catalog request rejected")
    return [task.to_public() for task in list_tasks()]


def _training_task_for(dataset_ref: str) -> Any | None:
    """Catalog task of a known dataset, or None when the API cannot read it."""
    folder = _dataset_dir(dataset_ref)
    if folder is None:
        return None
    try:
        manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
        return get_task(str((manifest.get("target_definition") or {}).get("event_code")))
    except (OSError, ValueError, KeyError):
        return None


def _validate_training_request(dataset_ref: str, algorithm: str, search_space: dict[str, list[Any]] | None) -> str | None:
    """Return an error message when the algorithm or the grid do not fit the dataset's task."""
    task = _training_task_for(dataset_ref)
    if task is not None and algorithm not in task.algorithms:
        return f"Algorithm {algorithm} is not available for {task.code}; use one of {list(task.algorithms)}."
    if task is None and algorithm == "ridge":
        return "ridge is only available for regression tasks of a known dataset."
    if not search_space:
        return None
    rules = _SEARCH_SPACE_RULES[algorithm]
    combinations = 1
    for name, values in search_space.items():
        if name not in rules:
            return f"Unknown hyperparameter '{name}' for {algorithm}; allowed: {sorted(rules)}."
        if not values or len(values) > _MAX_VALUES_PER_PARAMETER:
            return f"Hyperparameter '{name}' needs 1 to {_MAX_VALUES_PER_PARAMETER} candidate values."
        if not all(rules[name](value) for value in values):
            return f"Hyperparameter '{name}' has a value outside its allowed range."
        combinations *= len(values)
    if combinations > _MAX_GRID_CANDIDATES:
        return f"The search space has {combinations} candidates; at most {_MAX_GRID_CANDIDATES} are allowed."
    return None


def _training_job_config(configuration_ref: str | None, search_space: dict[str, list[Any]] | None,
                         study_id: str | None = None) -> dict[str, Any]:
    # Without the new options the config (and its idempotency digest) keeps the
    # pre-PRED-103 shape.
    config: dict[str, Any] = {"configuration_ref": configuration_ref}
    if search_space:
        config["search_space"] = search_space
    if study_id:
        config["study_id"] = study_id
    return config


@app.post(
    "/v1/training-jobs",
    status_code=202,
    response_model=TrainingJobResponse,
    summary="Solicitar entrenamiento asíncrono",
    description="Requiere permiso de operador ML. Encola el trabajo y nunca entrena dentro de la petición.",
    responses={
        400: COMMON_ERROR_RESPONSES[400],
        401: COMMON_ERROR_RESPONSES[401],
        403: COMMON_ERROR_RESPONSES[403],
        409: COMMON_ERROR_RESPONSES[409],
        429: {"model": ProblemResponse, "description": "Capacidad de workers agotada"},
        500: COMMON_ERROR_RESPONSES[500],
        503: COMMON_ERROR_RESPONSES[503],
    },
)
def submit_training_job(
    body: TrainingJobRequest,
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=16, max_length=128),
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    """Solicita un entrenamiento asíncrono.

    Requiere permiso de operador ML. Nunca entrena dentro de la petición.
    El Idempotency-Key evita jobs duplicados al reintentar.
    """
    from training.job_store import JobStatus, TrainingJobRecord

    request_id = x_request_id or str(uuid4())
    try:
        principal = _authenticate_ml_operator(authorization)
    except InferenceFailure as exc:
        return _failure_response(exc, request_id, "Training job request rejected")
    if (problem := _validate_training_request(body.dataset_ref, body.algorithm, body.search_space)) is not None:
        return _make_problem(422, "Invalid training request", "INVALID_TRAINING_REQUEST", request_id, detail=problem)
    store = JobStore()
    job_config = _training_job_config(body.configuration_ref, body.search_space)

    # Idempotency keys are scoped per authenticated operator so one caller
    # cannot replay or observe another operator's submission.
    scope = f"{os.getenv('PREDICTION_IDEMPOTENCY_SCOPE', 'development')}:{principal.subject}"
    existing = store.find_by_idempotency_key(idempotency_key, scope)
    if existing is not None:
        digest = store.request_digest(body.dataset_ref, body.algorithm, job_config)
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

    # Backpressure: bound running + queued work so a stalled worker cannot
    # accumulate an unbounded backlog of jobs.
    if (problem := _capacity_problem(store, request_id)) is not None:
        return problem

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
        submitted_by=principal.subject,
        model_candidate=None,
        error=None,
        idempotency_key=idempotency_key,
        config=job_config,
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


@app.post(
    "/v1/training-studies",
    status_code=202,
    response_model=TrainingStudyResponse,
    summary="Entrenar varios algoritmos sobre un mismo dataset",
    description=(
        "Requiere el permiso prediction:train. Crea un job TRAIN por algoritmo, agrupados por study_id, para comparar "
        "candidatos entrenados sobre la misma partición. La Idempotency-Key cubre el estudio completo."
    ),
    responses={
        401: COMMON_ERROR_RESPONSES[401],
        403: COMMON_ERROR_RESPONSES[403],
        409: COMMON_ERROR_RESPONSES[409],
        422: COMMON_ERROR_RESPONSES[422],
        429: {"model": ProblemResponse, "description": "Capacidad de workers agotada"},
    },
)
def submit_training_study(
    body: TrainingStudyRequest,
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=16, max_length=96),
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    from training.job_store import JobStatus, TrainingJobRecord

    request_id = x_request_id or str(uuid4())
    try:
        principal = _authenticate_ml_operator(authorization)
    except InferenceFailure as exc:
        return _failure_response(exc, request_id, "Training study request rejected")
    algorithms = list(dict.fromkeys(body.algorithms))
    if len(algorithms) != len(body.algorithms) or any(a not in _SEARCH_SPACE_RULES for a in algorithms):
        return _make_problem(422, "Invalid training request", "INVALID_TRAINING_REQUEST", request_id,
                             detail="algorithms must be distinct values among ridge, random_forest and xgboost.")
    spaces = body.search_spaces or {}
    if set(spaces) - set(algorithms):
        return _make_problem(422, "Invalid training request", "INVALID_TRAINING_REQUEST", request_id,
                             detail="search_spaces may only reference requested algorithms.")
    for algorithm in algorithms:
        if (problem := _validate_training_request(body.dataset_ref, algorithm, spaces.get(algorithm))) is not None:
            return _make_problem(422, "Invalid training request", "INVALID_TRAINING_REQUEST", request_id, detail=problem)

    store = JobStore()
    scope = f"{os.getenv('PREDICTION_IDEMPOTENCY_SCOPE', 'development')}:{principal.subject}"
    # The study id is derived from the key, so a retried request maps to the same jobs.
    study_id = hashlib.sha256(f"{scope}|{idempotency_key}".encode()).hexdigest()[:32]
    existing = [store.find_by_idempotency_key(f"{idempotency_key}:{algorithm}", scope) for algorithm in algorithms]
    if any(existing):
        if not all(existing) or any(
            record.request_digest != store.request_digest(
                body.dataset_ref, algorithm, _training_job_config(body.configuration_ref, spaces.get(algorithm), study_id))
            for record, algorithm in zip(existing, algorithms)
        ):
            return _make_problem(409, "Idempotency conflict", "CONFLICT", request_id,
                                 detail="Idempotency-Key was already used for a different training study.")
        _dispatch_pending(store)
        task = _training_task_for(body.dataset_ref)
        return TrainingStudyResponse(study_id=study_id, dataset_ref=body.dataset_ref,
                                     task_code=task.code if task else None,
                                     jobs=[_training_job_response(record) for record in existing])
    try:
        max_concurrent = _positive_int_env("WORKER_MAX_CONCURRENT_JOBS", 1)
        max_queued = _positive_int_env("PREDICTION_MAX_QUEUED_JOBS", 4, minimum=0)
    except ValueError as exc:
        return _make_problem(503, "Job capacity misconfigured", "CONFIGURATION_ERROR", request_id, detail=str(exc))
    if len(store.list_active()) + len(algorithms) > max_concurrent + max_queued:
        return _make_problem(429, "Job capacity exhausted", "JOB_CAPACITY", request_id,
                             detail=f"The study needs {len(algorithms)} job slots; at most {max_concurrent} running and "
                                    f"{max_queued} queued jobs are allowed.")
    records = []
    for algorithm in algorithms:
        config = _training_job_config(body.configuration_ref, spaces.get(algorithm), study_id)
        record = TrainingJobRecord(
            job_id=str(uuid4()), dataset_ref=body.dataset_ref, algorithm=algorithm, status=JobStatus.QUEUED,
            created_at=datetime.now(timezone.utc).isoformat(), started_at=None, finished_at=None,
            submitted_by=principal.subject, model_candidate=None, error=None,
            idempotency_key=f"{idempotency_key}:{algorithm}", config=config, dataset_version=body.dataset_ref,
            dependency_versions={},
        )
        record.request_digest = store.request_digest(body.dataset_ref, algorithm, config)
        try:
            records.append(store.create(record, scope))
        except IdempotencyConflict:
            return _make_problem(409, "Idempotency conflict", "CONFLICT", request_id,
                                 detail="Idempotency-Key was already used for a different training study.")
    logger.info("Training study %s queued %s jobs request_id=%s", study_id, len(records), request_id)
    _dispatch_pending(store)
    task = _training_task_for(body.dataset_ref)
    return TrainingStudyResponse(study_id=study_id, dataset_ref=body.dataset_ref,
                                 task_code=task.code if task else None,
                                 jobs=[_training_job_response(record) for record in records])


# ---------------------------------------------------------------------------
# Training Jobs — GET /v1/training-jobs/{jobId}
# ---------------------------------------------------------------------------

@app.get(
    "/v1/training-jobs/{job_id}",
    response_model=TrainingJobResponse,
    summary="Consultar estado de trabajo de entrenamiento",
    description="Consulta el estado, métricas y candidato del modelo si el trabajo finalizó con éxito.",
    responses={
        401: COMMON_ERROR_RESPONSES[401],
        403: COMMON_ERROR_RESPONSES[403],
        404: COMMON_ERROR_RESPONSES[404],
        500: COMMON_ERROR_RESPONSES[500],
        503: COMMON_ERROR_RESPONSES[503],
    },
)
def get_training_job(
    job_id: str,
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    """Consulta el estado de un trabajo dentro del ámbito autorizado."""
    request_id = x_request_id or str(uuid4())
    try:
        _authenticate_ml_operator(authorization)
    except InferenceFailure as exc:
        return _failure_response(exc, request_id, "Training job request rejected")
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

    return _training_job_response(record)


@app.post(
    "/v1/training-jobs/{job_id}/cancel",
    response_model=TrainingJobResponse,
    summary="Cancelar un trabajo de entrenamiento en cola",
    description=(
        "Requiere rol de operador ML. Solo cancela trabajos QUEUED; un trabajo en ejecución "
        "no se interrumpe y responde 409."
    ),
    responses={
        401: COMMON_ERROR_RESPONSES[401],
        403: COMMON_ERROR_RESPONSES[403],
        404: COMMON_ERROR_RESPONSES[404],
        409: {"model": ProblemResponse, "description": "El trabajo ya no está en cola"},
        503: COMMON_ERROR_RESPONSES[503],
    },
)
def cancel_training_job(
    job_id: str,
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    request_id = x_request_id or str(uuid4())
    try:
        _authenticate_ml_operator(authorization)
    except InferenceFailure as exc:
        return _failure_response(exc, request_id, "Training job request rejected")
    try:
        UUID(job_id)
    except ValueError:
        return _make_problem(404, "Training job not found", "RESOURCE_NOT_FOUND", request_id)
    store = JobStore()
    if store.cancel(job_id):
        logger.info("Training job %s cancelled request_id=%s", job_id, request_id)
        return _training_job_response(store.get(job_id))
    record = store.get(job_id)
    if record is None:
        return _make_problem(404, "Training job not found", "RESOURCE_NOT_FOUND", request_id)
    return _make_problem(409, "Training job cannot be cancelled", "JOB_NOT_CANCELLABLE", request_id,
                         detail=f"Only QUEUED jobs can be cancelled; current status is {record.status.value}.")


# ---------------------------------------------------------------------------
# PRED-102 — Dataset extraction jobs, job list and dataset exploration (EDA)
# ---------------------------------------------------------------------------

class DatasetExtractionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    task_code: str = Field(min_length=1, max_length=64)
    cadence: str = Field(pattern=r"^(ANUAL|SEMESTRAL)$")
    programs: list[str] = Field(default_factory=list, max_length=200)
    horizon_years: int | None = Field(default=None, ge=1, le=10)
    features: list[str] = Field(default_factory=list, max_length=64)


_JOB_KINDS = ("TRAIN", "EXTRACT_DATASET", "FORECAST")
_JOB_STATUSES = ("QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED")


def _capacity_problem(store: JobStore, request_id: str) -> JSONResponse | None:
    """Shared admission control for every operator job kind."""
    try:
        max_concurrent = _positive_int_env("WORKER_MAX_CONCURRENT_JOBS", 1)
        max_queued = _positive_int_env("PREDICTION_MAX_QUEUED_JOBS", 4, minimum=0)
    except ValueError as exc:
        return _make_problem(503, "Job capacity misconfigured", "CONFIGURATION_ERROR", request_id, detail=str(exc))
    if len(store.list_active()) >= max_concurrent + max_queued:
        return _make_problem(
            429, "Job capacity exhausted", "JOB_CAPACITY", request_id,
            detail=f"At most {max_concurrent} running and {max_queued} queued jobs are allowed.",
        )
    return None


@app.post(
    "/v1/dataset-extractions",
    status_code=202,
    response_model=TrainingJobResponse,
    summary="Extraer un dataset de entrenamiento desde el DW",
    description=(
        "Requiere el permiso prediction:train. Encola un job EXTRACT_DATASET que ejecuta en el worker la consulta "
        "point-in-time de la tarea, valida el contrato, calcula el perfil exploratorio y publica el dataset como "
        "custom:<dataset_id> (el result_ref del job)."
    ),
    responses={
        400: COMMON_ERROR_RESPONSES[400],
        401: COMMON_ERROR_RESPONSES[401],
        403: COMMON_ERROR_RESPONSES[403],
        409: COMMON_ERROR_RESPONSES[409],
        422: COMMON_ERROR_RESPONSES[422],
        429: {"model": ProblemResponse, "description": "Capacidad de workers agotada"},
        503: COMMON_ERROR_RESPONSES[503],
    },
)
def submit_dataset_extraction(
    body: DatasetExtractionRequest,
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=16, max_length=128),
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    from training.dataset_extraction import ExtractionError, validate_params
    from training.job_store import JobKind, JobStatus, TrainingJobRecord

    request_id = x_request_id or str(uuid4())
    try:
        principal = _authenticate_ml_operator(authorization)
    except InferenceFailure as exc:
        return _failure_response(exc, request_id, "Dataset extraction request rejected")
    try:
        params = validate_params(body.model_dump()).to_json()
    except ExtractionError as exc:
        return _make_problem(422, "Invalid extraction request", exc.code, request_id, detail=str(exc))
    if extracted_dataset_root() is None:
        return _make_problem(503, "Extraction storage not configured", "DATASET_STORAGE_UNAVAILABLE", request_id,
                             detail="PREDICTION_EXTRACTED_DATASET_ROOT is not configured.")

    store = JobStore()
    scope = f"{os.getenv('PREDICTION_IDEMPOTENCY_SCOPE', 'development')}:{principal.subject}"
    kind = JobKind.EXTRACT_DATASET.value
    existing = store.find_by_idempotency_key(idempotency_key, scope)
    if existing is not None:
        digest = store.request_digest("extraction", "", {}, kind, params)
        if existing.request_digest != digest:
            return _make_problem(409, "Idempotency conflict", "CONFLICT", request_id,
                                 detail="Idempotency-Key was already used for a different request.")
        _dispatch_pending(store)
        return _training_job_response(existing)
    if (problem := _capacity_problem(store, request_id)) is not None:
        return problem

    dataset_id = str(uuid4())
    record = TrainingJobRecord(
        job_id=str(uuid4()),
        dataset_ref=f"custom:{dataset_id}",
        algorithm="",
        status=JobStatus.QUEUED,
        created_at=datetime.now(timezone.utc).isoformat(),
        started_at=None,
        finished_at=None,
        submitted_by=principal.subject,
        model_candidate=None,
        error=None,
        idempotency_key=idempotency_key,
        config={},
        dataset_version=f"custom:{dataset_id}",
        dependency_versions={},
        job_kind=kind,
        params=params,
    )
    # The digest ignores the reserved dataset id so a retried request matches.
    record.request_digest = store.request_digest("extraction", "", {}, kind, params)
    try:
        record = store.create(record, scope)
    except IdempotencyConflict:
        return _make_problem(409, "Idempotency conflict", "CONFLICT", request_id,
                             detail="Idempotency-Key was already used for a different request.")
    logger.info("Dataset extraction job %s queued task=%s request_id=%s", record.job_id, params["task_code"], request_id)
    _dispatch_pending(store)
    return _training_job_response(record)


@app.get(
    "/v1/jobs",
    response_model=list[TrainingJobResponse],
    summary="Listar los jobs de ML (entrenamiento, extracción y pronóstico)",
    description="Requiere el permiso prediction:train. Jobs de todos los operadores, del más reciente al más antiguo.",
    responses={401: COMMON_ERROR_RESPONSES[401], 403: COMMON_ERROR_RESPONSES[403], 503: COMMON_ERROR_RESPONSES[503]},
)
def list_jobs(
    kind: str | None = Query(default=None, pattern=r"^(TRAIN|EXTRACT_DATASET|FORECAST)$"),
    status: str | None = Query(default=None, pattern=r"^(QUEUED|RUNNING|SUCCEEDED|FAILED|CANCELLED)$"),
    study_id: str | None = Query(default=None, pattern=r"^[0-9a-f]{32}$"),
    limit: int = Query(default=50, ge=1, le=200),
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    request_id = x_request_id or str(uuid4())
    try:
        _authenticate_ml_operator(authorization)
    except InferenceFailure as exc:
        return _failure_response(exc, request_id, "Job list request rejected")
    records = JobStore().list_recent(kind, status, 200 if study_id else limit)
    if study_id:
        records = [r for r in records if isinstance(r.config, dict) and r.config.get("study_id") == study_id][:limit]
    return [_training_job_response(record) for record in records]


@app.get(
    "/v1/jobs/{job_id}",
    response_model=TrainingJobResponse,
    summary="Consultar un job de ML de cualquier tipo",
    responses={401: COMMON_ERROR_RESPONSES[401], 403: COMMON_ERROR_RESPONSES[403], 404: COMMON_ERROR_RESPONSES[404]},
)
def get_job(
    job_id: str,
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    request_id = x_request_id or str(uuid4())
    try:
        _authenticate_ml_operator(authorization)
    except InferenceFailure as exc:
        return _failure_response(exc, request_id, "Job request rejected")
    try:
        UUID(job_id)
    except ValueError:
        return _make_problem(404, "Job not found", "RESOURCE_NOT_FOUND", request_id)
    record = JobStore().get(job_id)
    if record is None:
        return _make_problem(404, "Job not found", "RESOURCE_NOT_FOUND", request_id)
    return _training_job_response(record)


@app.post(
    "/v1/jobs/{job_id}/cancel",
    response_model=TrainingJobResponse,
    summary="Cancelar un job de ML en cola o en ejecución",
    description=(
        "Requiere el permiso prediction:train. Un job QUEUED no llega a ejecutarse. Un job RUNNING se cancela de forma "
        "cooperativa: queda CANCELLED de inmediato y el worker descarta su resultado parcial (dataset o candidato)."
    ),
    responses={
        401: COMMON_ERROR_RESPONSES[401],
        403: COMMON_ERROR_RESPONSES[403],
        404: COMMON_ERROR_RESPONSES[404],
        409: {"model": ProblemResponse, "description": "El job ya terminó"},
    },
)
def cancel_job(
    job_id: str,
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    request_id = x_request_id or str(uuid4())
    try:
        principal = _authenticate_ml_operator(authorization)
    except InferenceFailure as exc:
        return _failure_response(exc, request_id, "Job request rejected")
    try:
        UUID(job_id)
    except ValueError:
        return _make_problem(404, "Job not found", "RESOURCE_NOT_FOUND", request_id)
    store = JobStore()
    if store.cancel(job_id, include_running=True):
        logger.info("Job %s cancelled by %s request_id=%s", job_id, principal.subject, request_id)
        return _training_job_response(store.get(job_id))
    record = store.get(job_id)
    if record is None:
        return _make_problem(404, "Job not found", "RESOURCE_NOT_FOUND", request_id)
    return _make_problem(409, "Job cannot be cancelled", "JOB_NOT_CANCELLABLE", request_id,
                         detail=f"The job already finished with status {record.status.value}.")


_DATASET_NAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
_BUILTIN_FIXTURES = {
    "fixture:pred003_synthetic-v1": "pred003_synthetic",
    "fixture:pred002_synthetic-v1": "pred002_synthetic",
}


def _dataset_dir(dataset_ref: str) -> Path | None:
    """Trusted directory of a dataset reference (custom:<id>, <id> or built-in fixture)."""
    if dataset_ref in _BUILTIN_FIXTURES:
        folder = Path(__file__).parent / "tests" / "fixtures" / _BUILTIN_FIXTURES[dataset_ref]
        return folder if (folder / "manifest.json").exists() else None
    name = dataset_ref.removeprefix("custom:")
    if not _DATASET_NAME_PATTERN.fullmatch(name):
        return None
    for root in custom_dataset_roots():
        candidate = (root / name).resolve()
        if root in candidate.parents and (candidate / "manifest.json").is_file() and (candidate / "rows.jsonl").is_file():
            return candidate
    return None


def _read_dataset_files(folder: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    rows = [json.loads(line) for line in (folder / "rows.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
    return manifest, rows


def _dataset_profile(manifest: dict[str, Any], rows: list[dict[str, Any]]) -> dict[str, Any]:
    from preparation.profiling import profile_dataset
    try:
        kind = get_task(str((manifest.get("target_definition") or {}).get("event_code"))).kind
    except KeyError:
        kind = None
    return profile_dataset(manifest, rows, kind)


@app.get(
    "/v1/datasets/{dataset_ref}/profile",
    summary="Perfil exploratorio (EDA) de un dataset",
    description=(
        "Requiere el permiso prediction:train. Cobertura por periodo y programa, distribución del objetivo, faltantes, "
        "estadísticas e histogramas por variable, correlación con el objetivo y avisos (fuga, desbalance/SMOTE). "
        "Solo agregados: no incluye filas."
    ),
    responses={401: COMMON_ERROR_RESPONSES[401], 403: COMMON_ERROR_RESPONSES[403], 404: COMMON_ERROR_RESPONSES[404]},
)
def get_dataset_profile(
    dataset_ref: str,
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    request_id = x_request_id or str(uuid4())
    try:
        _authenticate_ml_operator(authorization)
    except InferenceFailure as exc:
        return _failure_response(exc, request_id, "Dataset request rejected")
    folder = _dataset_dir(dataset_ref)
    if folder is None:
        return _make_problem(404, "Dataset not found", "RESOURCE_NOT_FOUND", request_id)
    stored = folder / "profile.json"
    if stored.is_file():
        return JSONResponse(json.loads(stored.read_text(encoding="utf-8")), headers={"Cache-Control": "no-store"})
    # Datasets published before PRED-102 have no stored profile; compute it on
    # read (the dataset store may be read-only for the API).
    manifest, rows = _read_dataset_files(folder)
    return JSONResponse(_dataset_profile(manifest, rows), headers={"Cache-Control": "no-store"})


@app.get(
    "/v1/datasets/{dataset_ref}/sample",
    summary="Muestra de filas seudonimizadas de un dataset",
    description=(
        "Requiere el permiso prediction:train. Devuelve las primeras filas con solo los campos declarados en el "
        "manifest; los estudiantes aparecen con su pseudónimo, nunca con identificadores del DW."
    ),
    responses={401: COMMON_ERROR_RESPONSES[401], 403: COMMON_ERROR_RESPONSES[403], 404: COMMON_ERROR_RESPONSES[404]},
)
def get_dataset_sample(
    dataset_ref: str,
    limit: int = Query(default=50, ge=1, le=200),
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    request_id = x_request_id or str(uuid4())
    try:
        _authenticate_ml_operator(authorization)
    except InferenceFailure as exc:
        return _failure_response(exc, request_id, "Dataset request rejected")
    folder = _dataset_dir(dataset_ref)
    if folder is None:
        return _make_problem(404, "Dataset not found", "RESOURCE_NOT_FOUND", request_id)
    manifest, rows = _read_dataset_files(folder)
    declared = [field.get("name") for field in manifest.get("fields", []) if isinstance(field, dict) and field.get("name")]
    columns = [name for name in declared if name not in {"subject_ref"}]
    sample = [{name: row.get(name) for name in columns} for row in rows[:limit]]
    return JSONResponse(
        {"dataset_id": manifest.get("dataset_id"), "row_count": len(rows), "columns": columns, "rows": sample},
        headers={"Cache-Control": "no-store"},
    )


# ---------------------------------------------------------------------------
# Datasets Management — Upload & List
# ---------------------------------------------------------------------------

@app.get(
    "/v1/datasets",
    response_model=list[DatasetSummary],
    summary="Listar datasets de entrenamiento disponibles",
    description="Requiere rol de operador ML. Devuelve los fixtures del sistema y los datasets subidos y validados.",
    responses={
        401: COMMON_ERROR_RESPONSES[401],
        403: COMMON_ERROR_RESPONSES[403],
        503: COMMON_ERROR_RESPONSES[503],
    },
)
def list_training_datasets(
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    request_id = x_request_id or str(uuid4())
    try:
        _authenticate_ml_operator(authorization)
    except InferenceFailure as exc:
        return _failure_response(exc, request_id, "Dataset request rejected")

    results: list[DatasetSummary] = []

    # 1. Fixture incorporado PRED-003
    base_fixtures = Path(__file__).parent / "tests" / "fixtures"
    pred003_manifest = base_fixtures / "pred003_synthetic" / "manifest.json"
    if pred003_manifest.exists():
        try:
            m = json.loads(pred003_manifest.read_text(encoding="utf-8"))
            results.append(
                DatasetSummary(
                    dataset_ref="fixture:pred003_synthetic-v1",
                    dataset_id=str(m.get("dataset_id", "pred003-synthetic")),
                    label="Fixture sintético PRED-003 (retención)",
                    description="Dataset sintético de prueba incorporado en el servicio.",
                    is_custom=False,
                    row_count=int(m.get("row_count", 0)),
                    target_field=m.get("target_field"),
                    event_code=(m.get("target_definition") or {}).get("event_code"),
                    created_at=m.get("created_at"),
                    content_digest=m.get("content_digest"),
                )
            )
        except Exception as exc:
            logger.warning("No se pudo leer el manifest de pred003_synthetic: %s", exc)

    # 2. Datasets personalizados (almacén compartido y snapshots de operador).
    seen: set[str] = set()
    for custom_root in custom_dataset_roots():
        if not custom_root.is_dir():
            continue
        for item in sorted(custom_root.iterdir()):
            manifest_path = item / "manifest.json"
            if item.name in seen or item.name.startswith(".") or not item.is_dir() or not manifest_path.exists():
                continue
            try:
                m = json.loads(manifest_path.read_text(encoding="utf-8"))
                results.append(
                    DatasetSummary(
                        dataset_ref=f"custom:{item.name}",
                        dataset_id=str(m.get("dataset_id", item.name)),
                        label=f"Dataset personalizado: {item.name}",
                        description=m.get("warning") or "Dataset preparado externamente y validado.",
                        is_custom=True,
                        row_count=int(m.get("row_count", 0)),
                        target_field=m.get("target_field"),
                        event_code=(m.get("target_definition") or {}).get("event_code"),
                        created_at=m.get("created_at"),
                        content_digest=m.get("content_digest"),
                    )
                )
                seen.add(item.name)
            except Exception as exc:
                logger.warning("No se pudo leer manifest en %s: %s", item, exc)

    return results


class _UploadRejected(Exception):
    def __init__(self, status: int, title: str, code: str, detail: str | None = None):
        super().__init__(detail or title)
        self.status = status
        self.title = title
        self.code = code
        self.detail = detail


async def _read_upload_bounded(file: UploadFile, limit: int) -> bytes:
    """Read at most ``limit`` bytes; never buffer an oversized request body."""
    buffer = bytearray()
    while chunk := await file.read(1024 * 1024):
        buffer.extend(chunk)
        if len(buffer) > limit:
            raise _UploadRejected(413, "Archivo demasiado grande", "PAYLOAD_TOO_LARGE",
                                  f"El archivo supera el límite de {limit} bytes.")
    return bytes(buffer)


def _read_dataset_archive(content: bytes, max_uncompressed: int) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Extract exactly one manifest.json and one rows.jsonl with bounded decompression."""
    try:
        archive = zipfile.ZipFile(BytesIO(content))
    except zipfile.BadZipFile as exc:
        raise _UploadRejected(400, "Archivo zip corrupto", "BAD_ZIP_FILE") from exc
    with archive:
        entries = [info for info in archive.infolist() if not info.is_dir()]
        if len(entries) > 16:
            raise _UploadRejected(400, "Archivo zip inválido", "INVALID_ZIP_ARCHIVE",
                                  "El zip contiene demasiados archivos.")
        manifests = [info for info in entries if Path(info.filename).name == "manifest.json"]
        rows = [info for info in entries if Path(info.filename).name == "rows.jsonl"]
        if not manifests or not rows:
            raise _UploadRejected(400, "Estructura de dataset incompleta", "MISSING_DATASET_FILES",
                                  "El zip debe incluir 'manifest.json' y 'rows.jsonl'.")
        if len(manifests) > 1 or len(rows) > 1:
            raise _UploadRejected(400, "Estructura de dataset ambigua", "AMBIGUOUS_DATASET_FILES",
                                  "El zip debe incluir un único 'manifest.json' y un único 'rows.jsonl'.")
        if manifests[0].file_size + rows[0].file_size > max_uncompressed:
            raise _UploadRejected(413, "Dataset demasiado grande", "PAYLOAD_TOO_LARGE",
                                  f"El contenido descomprimido supera {max_uncompressed} bytes.")
        try:
            # Headers can lie about sizes: cap the actual decompressed read too.
            with archive.open(manifests[0]) as stream:
                manifest_bytes = stream.read(max_uncompressed + 1)
            rows_bytes = b""
            if len(manifest_bytes) <= max_uncompressed:
                with archive.open(rows[0]) as stream:
                    rows_bytes = stream.read(max_uncompressed - len(manifest_bytes) + 1)
            if len(manifest_bytes) + len(rows_bytes) > max_uncompressed:
                raise _UploadRejected(413, "Dataset demasiado grande", "PAYLOAD_TOO_LARGE",
                                      f"El contenido descomprimido supera {max_uncompressed} bytes.")
            manifest = json.loads(manifest_bytes.decode("utf-8"))
            parsed_rows = [json.loads(line) for line in rows_bytes.decode("utf-8").splitlines() if line.strip()]
        except _UploadRejected:
            raise
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise _UploadRejected(400, "Contenido de dataset inválido", "INVALID_DATASET_ENCODING",
                                  "manifest.json y rows.jsonl deben ser JSON válido en UTF-8.") from exc
        except (zipfile.BadZipFile, RuntimeError, NotImplementedError, OSError) as exc:
            raise _UploadRejected(400, "Error al descomprimir dataset", "ZIP_PROCESSING_ERROR") from exc
    if not isinstance(manifest, dict) or not parsed_rows:
        raise _UploadRejected(400, "Dataset vacío", "EMPTY_DATASET")
    return manifest, parsed_rows


def _store_dataset(root: Path, dataset_id: str, manifest: dict[str, Any], rows: list[dict[str, Any]],
                   provenance: dict[str, Any]) -> None:
    """Write into a staging directory and publish it once; never overwrite a dataset."""
    root.mkdir(parents=True, exist_ok=True)
    target = root / dataset_id
    if target.exists():
        raise _UploadRejected(409, "Dataset ya registrado", "DATASET_ALREADY_EXISTS",
                              "Los datasets son inmutables; publique la nueva versión con otro dataset_id.")
    staging = root / f".{dataset_id}.tmp-{uuid4().hex}"
    staging.mkdir()
    try:
        (staging / "manifest.json").write_text(
            json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False), encoding="utf-8")
        with (staging / "rows.jsonl").open("w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row, separators=(",", ":"), ensure_ascii=False) + "\n")
        (staging / "upload.json").write_text(json.dumps(provenance, indent=2, sort_keys=True), encoding="utf-8")
        (staging / "profile.json").write_text(
            json.dumps(_dataset_profile(manifest, rows), indent=2, ensure_ascii=False), encoding="utf-8")
        try:
            # rename (not replace) fails if a concurrent upload published first.
            os.rename(staging, target)
        except OSError as exc:
            if target.exists():
                raise _UploadRejected(409, "Dataset ya registrado", "DATASET_ALREADY_EXISTS",
                                      "Los datasets son inmutables; publique la nueva versión con otro dataset_id.") from exc
            raise
    finally:
        if staging.exists():
            shutil.rmtree(staging, ignore_errors=True)


@app.post(
    "/v1/datasets/upload",
    status_code=201,
    response_model=DatasetUploadResponse,
    summary="Subir y validar un dataset preparado",
    description=(
        "Requiere rol de operador ML. Recibe un .zip con un único manifest.json y rows.jsonl, "
        "lo valida contra el contrato de datos y lo registra de forma inmutable."
    ),
    responses={
        400: COMMON_ERROR_RESPONSES[400],
        401: COMMON_ERROR_RESPONSES[401],
        403: COMMON_ERROR_RESPONSES[403],
        409: {"model": ProblemResponse, "description": "El dataset_id ya está registrado"},
        413: {"model": ProblemResponse, "description": "Archivo o contenido descomprimido demasiado grande"},
        422: COMMON_ERROR_RESPONSES[422],
        503: COMMON_ERROR_RESPONSES[503],
    },
)
async def upload_training_dataset(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    request_id = x_request_id or str(uuid4())
    try:
        # Token verification makes blocking HTTP calls; keep it off the event loop.
        principal = await asyncio.to_thread(_authenticate_ml_operator, authorization)
    except InferenceFailure as exc:
        return _failure_response(exc, request_id, "Dataset request rejected")

    try:
        if not (file.filename or "").lower().endswith(".zip"):
            raise _UploadRejected(
                400, "Formato de archivo inválido", "INVALID_FILE_TYPE",
                "Debe proporcionar un archivo .zip que contenga 'manifest.json' y 'rows.jsonl'.",
            )
        roots = custom_dataset_roots()
        if not roots:
            raise _UploadRejected(503, "Almacén de datasets no configurado", "DATASET_STORAGE_UNAVAILABLE")

        content = await _read_upload_bounded(file, dataset_upload_max_bytes())
        manifest_data, rows_data = _read_dataset_archive(content, dataset_max_uncompressed_bytes())

        report: DatasetValidationReport = validate_prepared_dataset(manifest_data, rows_data)
        if not report.ready_for_preparation:
            issues_summary = [f"[{i.code}] {i.path}: {i.message}" for i in report.issues]
            raise _UploadRejected(
                422, "Dataset no cumple contrato de datos", "DATASET_CONTRACT_VIOLATION",
                f"Estado del reporte: {report.status}. Errores: {'; '.join(issues_summary[:5])}",
            )
        # The contract requires a UUID; normalizing it also rules out path segments.
        dataset_id = str(UUID(str(manifest_data["dataset_id"])))
        if any((root / dataset_id).exists() for root in roots):
            raise _UploadRejected(409, "Dataset ya registrado", "DATASET_ALREADY_EXISTS",
                                  "Los datasets son inmutables; publique la nueva versión con otro dataset_id.")
        provenance = {
            "uploaded_by": principal.subject,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "upload_sha256": hashlib.sha256(content).hexdigest(),
            "request_id": request_id,
        }
        try:
            await asyncio.to_thread(_store_dataset, roots[0], dataset_id, manifest_data, rows_data, provenance)
        except OSError as exc:
            logger.exception("Dataset storage failed request_id=%s", request_id)
            raise _UploadRejected(503, "Almacén de datasets no disponible", "DATASET_STORAGE_UNAVAILABLE") from exc
    except _UploadRejected as rejected:
        return _make_problem(rejected.status, rejected.title, rejected.code, request_id, detail=rejected.detail)

    return DatasetUploadResponse(
        message="Dataset preparado subido y validado exitosamente",
        dataset_ref=f"custom:{dataset_id}",
        dataset_id=dataset_id,
        row_count=len(rows_data),
        content_digest=str(manifest_data.get("content_digest", "")),
        target_field=str(manifest_data.get("target_field", "")),
        event_code=(manifest_data.get("target_definition") or {}).get("event_code"),
    )


def _dispatch_pending(store: JobStore) -> None:
    """Publish committed outbox entries; failed publishes remain retryable."""
    from training.tasks import dispatch_job
    for job_id in store.pending_outbox():
        job = store.get(job_id)
        if job is None:
            continue
        try:
            dispatch_job(job, os.getenv("WORKER_ARTIFACTS_DIR", "/app/artifacts"))
            store.mark_published(job_id)
        except Exception as exc:
            logger.warning("Outbox dispatch pending for job %s: %s", job_id, exc)
            store.mark_published(job_id, error=exc)
    _dispatch_pending_prediction_batches()


def _dispatch_pending_prediction_batches(store: Any | None = None) -> None:
    """Dispatch committed population batches; failed sends remain retryable."""
    from training.prediction_publication_store import PredictionPublicationStore
    from training.tasks import publish_population_task

    store = store or PredictionPublicationStore()
    for batch_id in store.pending():
        batch = store.get(batch_id)
        if batch is None:
            continue
        try:
            publish_population_task.apply_async(
                kwargs={"batch_id": batch_id, "artifacts_dir": os.getenv("WORKER_ARTIFACTS_DIR", "/app/artifacts")},
                task_id=batch_id,
                queue="prediction.publish_population",
            )
            store.mark_dispatched(batch_id)
        except Exception as exc:
            logger.warning("Outbox dispatch pending for prediction batch %s: %s", batch_id, exc)
            store.mark_dispatched(batch_id, error=exc)


# ---------------------------------------------------------------------------
# Model registry for the admin portal — validation, activation, deactivation
# ---------------------------------------------------------------------------

_MODEL_ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$"


class ModelActivationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    model_id: str = Field(pattern=_MODEL_ID_PATTERN)
    version: str = Field(pattern=_MODEL_ID_PATTERN)
    reason: str = Field(min_length=3, max_length=500)


class ModelDeactivationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event_code: str = Field(pattern=event_code_pattern())
    cadence: str = Field(pattern=r"^(ANUAL|SEMESTRAL)$")
    reason: str = Field(min_length=3, max_length=500)


def _admin_registry() -> ModelRegistry:
    return _model_registry(os.getenv("WORKER_ARTIFACTS_DIR", "/app/artifacts"))


@app.get(
    "/v1/models",
    summary="Listar modelos candidatos con sus métricas",
    description="Requiere rol de operador ML. Devuelve cada candidato con métricas de prueba y validación, "
                "matriz de confusión, datos de entrenamiento y si puede activarse.",
    responses={401: COMMON_ERROR_RESPONSES[401], 403: COMMON_ERROR_RESPONSES[403], 503: COMMON_ERROR_RESPONSES[503]},
)
def list_models(
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    request_id = x_request_id or str(uuid4())
    try:
        _authenticate_ml_operator(authorization)
    except InferenceFailure as exc:
        return _failure_response(exc, request_id, "Model request rejected")
    try:
        registry = _admin_registry()
        return JSONResponse({"models": registry.list_models(), **registry.registry_state()},
                            headers={"Cache-Control": "no-store"})
    except (InvalidModelArtifact, OSError, json.JSONDecodeError):
        logger.exception("Model registry listing failed request_id=%s", request_id)
        return _make_problem(503, "Registro de modelos no disponible", "MODEL_REGISTRY_UNAVAILABLE", request_id)


@app.post(
    "/v1/models/activate",
    summary="Activar un modelo candidato",
    description="Requiere rol de operador ML. Activa el candidato para su tipo de evento y cadencia. "
                "Solo se aceptan candidatos entrenados con datos aprobados; queda auditado con el operador y el motivo.",
    responses={400: COMMON_ERROR_RESPONSES[400], 401: COMMON_ERROR_RESPONSES[401], 403: COMMON_ERROR_RESPONSES[403],
               409: COMMON_ERROR_RESPONSES[409], 503: COMMON_ERROR_RESPONSES[503]},
)
def activate_model(
    body: ModelActivationRequest,
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    request_id = x_request_id or str(uuid4())
    try:
        principal = _authenticate_ml_operator(authorization)
    except InferenceFailure as exc:
        return _failure_response(exc, request_id, "Model activation rejected")
    try:
        pointer = _admin_registry().activate(body.model_id, body.version, principal.subject, body.reason)
    except InvalidModelArtifact as exc:
        return _make_problem(409, "El modelo no se puede activar", "MODEL_NOT_ACTIVATABLE", request_id, detail=str(exc))
    except ValueError as exc:
        return _make_problem(400, "Solicitud inválida", "INVALID_REQUEST", request_id, detail=str(exc))
    except OSError:
        logger.exception("Model activation failed request_id=%s", request_id)
        return _make_problem(503, "Registro de modelos no disponible", "MODEL_REGISTRY_UNAVAILABLE", request_id)
    logger.info("Model %s/%s activated by %s request_id=%s", body.model_id, body.version, principal.subject, request_id)
    return JSONResponse({"active": pointer}, headers={"Cache-Control": "no-store"})


@app.post(
    "/v1/models/deactivate",
    summary="Desactivar el modelo activo de un tipo de evento y cadencia",
    description="Requiere rol de operador ML. Deja el alcance sin modelo activo; las predicciones de ese alcance "
                "responden que no hay modelo disponible. Queda auditado con el operador y el motivo.",
    responses={401: COMMON_ERROR_RESPONSES[401], 403: COMMON_ERROR_RESPONSES[403], 409: COMMON_ERROR_RESPONSES[409],
               503: COMMON_ERROR_RESPONSES[503]},
)
def deactivate_model(
    body: ModelDeactivationRequest,
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    request_id = x_request_id or str(uuid4())
    try:
        principal = _authenticate_ml_operator(authorization)
    except InferenceFailure as exc:
        return _failure_response(exc, request_id, "Model deactivation rejected")
    try:
        event = _admin_registry().deactivate(body.event_code, body.cadence, principal.subject, body.reason)
    except NoActiveModel as exc:
        return _make_problem(409, "No hay modelo activo", "NO_ACTIVE_MODEL", request_id, detail=str(exc))
    except (InvalidModelArtifact, OSError, json.JSONDecodeError):
        logger.exception("Model deactivation failed request_id=%s", request_id)
        return _make_problem(503, "Registro de modelos no disponible", "MODEL_REGISTRY_UNAVAILABLE", request_id)
    logger.info("Scope %s|%s deactivated by %s request_id=%s", body.event_code, body.cadence, principal.subject, request_id)
    return JSONResponse({"event": event}, headers={"Cache-Control": "no-store"})


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
