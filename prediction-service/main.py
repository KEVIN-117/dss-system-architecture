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

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator

from config import settings
from training.job_store import IdempotencyConflict, JobStore
from training.model_registry import InvalidModelArtifact, ModelRegistry, NoActiveModel
from inference import InferenceFailure, PredictionService
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
    algorithm: str = Field(pattern=r"^(random_forest|xgboost)$")
    configuration_ref: str | None = Field(default=None, max_length=128)


class AcademicCutRef(BaseModel):
    cut_id: str = Field(min_length=1, max_length=128)


class ModelReference(BaseModel):
    model_id: str = Field(min_length=1, max_length=128)
    version: str = Field(min_length=1, max_length=128)


class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    contract_version: str = Field(pattern=r"^1\.0$")
    event_type: str = Field(default="program_dropout", pattern=r"^(course_abandonment|program_dropout)$")
    subject_ref: str = Field(min_length=1, max_length=128)
    program_ref: str = Field(min_length=1, max_length=64)
    course_ref: str | None = Field(default=None, min_length=1, max_length=128)
    academic_cut: AcademicCutRef

    @model_validator(mode="after")
    def validate_event_scope(self):
        if self.event_type == "course_abandonment" and not self.course_ref:
            raise ValueError("course_ref is required for course_abandonment")
        if self.event_type == "program_dropout" and self.course_ref is not None:
            raise ValueError("course_ref is only valid for course_abandonment")
        return self


class PredictionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    contract_version: str = "1.0"
    prediction_id: UUID
    subject_ref: str
    program_ref: str
    event_type: str = Field(default="program_dropout", pattern=r"^(course_abandonment|program_dropout)$")
    course_ref: str | None = None
    event_code: str
    predicted_class: str = Field(pattern=r"^(POSITIVE_EVENT|NEGATIVE_EVENT)$")
    event_probability: float | None = Field(default=None, ge=0, le=1)
    model: ModelReference
    academic_cut: AcademicCutRef
    generated_at: datetime


class PredictionBatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contract_version: str = Field(default="1.0", pattern=r"^1\.0$")
    event_type: str = Field(default="program_dropout", pattern=r"^program_dropout$")
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
                               body.academic_cut.cut_id, idempotency_key)
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
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_request_id: str | None = Header(default=None, alias="X-Request-ID"),
) -> Any:
    """Return only the latest complete batch after server-side academic authorization."""
    request_id = x_request_id or str(uuid4())
    if not authorization or not authorization.startswith("Bearer "):
        return _make_problem(401, "Unauthorized", "INVALID_TOKEN", request_id)
    try:
        result = _publication_service().current(authorization[7:].strip(), program_ref, cut_id, limit, offset)
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


@app.post(
    "/v1/training-jobs",
    status_code=202,
    response_model=TrainingJobResponse,
    summary="Solicitar entrenamiento asíncrono",
    description="Requiere permiso de operador ML. Encola el trabajo y nunca entrena dentro de la petición.",
    responses={
        400: COMMON_ERROR_RESPONSES[400],
        409: COMMON_ERROR_RESPONSES[409],
        429: {"model": ProblemResponse, "description": "Capacidad de workers agotada"},
        500: COMMON_ERROR_RESPONSES[500],
    },
)
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

@app.get(
    "/v1/training-jobs/{job_id}",
    response_model=TrainingJobResponse,
    summary="Consultar estado de trabajo de entrenamiento",
    description="Consulta el estado, métricas y candidato del modelo si el trabajo finalizó con éxito.",
    responses={
        404: COMMON_ERROR_RESPONSES[404],
        500: COMMON_ERROR_RESPONSES[500],
    },
)
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
