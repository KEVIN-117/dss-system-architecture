"""Runtime configuration for prediction-service."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)


_ALLOWED_ENVIRONMENTS = {"development", "test", "production"}
_ALLOWED_LOG_LEVELS = {"critical", "error", "warning", "info", "debug", "trace"}


def _read_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default

    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} must be a boolean (true/false).")


def _read_int(name: str, default: int, minimum: int = 1) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        parsed = int(value.strip())
    except ValueError as error:
        raise ValueError(f"{name} must be an integer >= {minimum}.") from error
    if parsed < minimum:
        raise ValueError(f"{name} must be an integer >= {minimum}.")
    return parsed


@dataclass(frozen=True)
class Settings:
    environment: str
    host: str
    port: int
    log_level: str
    reload: bool

    @classmethod
    def from_environment(cls) -> "Settings":
        environment = os.getenv("PREDICTION_ENV", "development").strip().lower()
        host = os.getenv("PREDICTION_HOST", "0.0.0.0").strip()
        port_value = os.getenv("PREDICTION_PORT", "8000").strip()
        log_level = os.getenv("PREDICTION_LOG_LEVEL", "info").strip().lower()
        reload = _read_bool("PREDICTION_RELOAD", False)

        if environment not in _ALLOWED_ENVIRONMENTS:
            allowed = ", ".join(sorted(_ALLOWED_ENVIRONMENTS))
            raise ValueError(f"PREDICTION_ENV must be one of: {allowed}.")
        if not host:
            raise ValueError("PREDICTION_HOST cannot be empty.")
        try:
            port = int(port_value)
        except ValueError as error:
            raise ValueError("PREDICTION_PORT must be an integer from 1 to 65535.") from error
        if not 1 <= port <= 65535:
            raise ValueError("PREDICTION_PORT must be an integer from 1 to 65535.")
        if log_level not in _ALLOWED_LOG_LEVELS:
            allowed = ", ".join(sorted(_ALLOWED_LOG_LEVELS))
            raise ValueError(f"PREDICTION_LOG_LEVEL must be one of: {allowed}.")
        if environment == "production" and reload:
            raise ValueError("PREDICTION_RELOAD must be false in production.")

        return cls(environment, host, port, log_level, reload)

    def validate_runtime(self) -> list[str]:
        """Validate critical runtime environment variables.

        In production, raises RuntimeError if required settings are missing.
        In development/test, logs warnings and returns missing variable names.
        """
        missing: list[str] = []

        # Database URL
        db_url = os.getenv("PREDICTION_DATABASE_URL", "").strip()
        if not db_url:
            missing.append("PREDICTION_DATABASE_URL")

        # DW Database URL
        dw_url = os.getenv("PREDICTION_DW_DATABASE_URL", "").strip()
        if not dw_url:
            missing.append("PREDICTION_DW_DATABASE_URL")

        # Keycloak settings
        for key in ("KEYCLOAK_URL", "KEYCLOAK_REALM", "KEYCLOAK_AUDIENCE"):
            if not os.getenv(key, "").strip():
                missing.append(key)

        # Auth service URL
        auth_url = os.getenv("AUTH_SERVICE_URL", "").strip()
        if not auth_url:
            missing.append("AUTH_SERVICE_URL")

        if missing:
            msg = f"Runtime configuration missing or invalid: {', '.join(missing)}"
            if self.environment == "production":
                raise RuntimeError(msg)
            logger.warning("Development/Test non-blocking configuration notice: %s", msg)

        return missing


@dataclass(frozen=True)
class WorkerSettings:
    """Configuration for the Celery training worker."""

    broker_url: str
    max_concurrent_jobs: int
    job_timeout_seconds: int
    cpu_limit: int
    memory_limit_mb: int
    artifacts_dir: str
    random_seed: int
    max_job_attempts: int

    @classmethod
    def from_environment(cls) -> "WorkerSettings":
        rabbit_host = os.getenv("RABBITMQ_HOST", "rabbitmq")
        rabbit_port = os.getenv("RABBITMQ_PORT", "5672")
        rabbit_user = os.getenv("RABBITMQ_USERNAME", "guest")
        rabbit_pass = os.getenv("RABBITMQ_PASSWORD", "guest")
        rabbit_vhost = os.getenv("RABBITMQ_VHOST", "/")

        vhost = rabbit_vhost if rabbit_vhost == "/" else f"/{rabbit_vhost}"
        broker_url = os.getenv(
            "CELERY_BROKER_URL",
            f"amqp://{rabbit_user}:{rabbit_pass}@{rabbit_host}:{rabbit_port}{vhost}",
        )

        return cls(
            broker_url=broker_url,
            max_concurrent_jobs=_read_int("WORKER_MAX_CONCURRENT_JOBS", 1),
            job_timeout_seconds=_read_int("WORKER_JOB_TIMEOUT_SECONDS", 1800),
            cpu_limit=_read_int("WORKER_CPU_LIMIT", 2),
            memory_limit_mb=_read_int("WORKER_MEMORY_LIMIT_MB", 2048),
            artifacts_dir=os.getenv("WORKER_ARTIFACTS_DIR", "/app/artifacts"),
            random_seed=_read_int("WORKER_RANDOM_SEED", 42, minimum=0),
            max_job_attempts=_read_int("WORKER_MAX_JOB_ATTEMPTS", 3),
        )


def custom_dataset_roots() -> list[Path]:
    """Directories holding uploaded datasets, in resolution order.

    ``PREDICTION_CUSTOM_DATASET_ROOT`` is the writable store shared by the API
    (read-write) and the worker (read-only). ``PREDICTION_DATASET_ROOT/custom``
    remains a read-only fallback for snapshots provisioned by operators.
    """
    roots: list[Path] = []
    explicit = os.getenv("PREDICTION_CUSTOM_DATASET_ROOT", "").strip()
    if explicit:
        roots.append(Path(explicit).resolve())
    extracted = extracted_dataset_root()
    if extracted is not None and extracted not in roots:
        roots.append(extracted)
    snapshots = os.getenv("PREDICTION_DATASET_ROOT", "").strip()
    if snapshots:
        legacy = (Path(snapshots) / "custom").resolve()
        if legacy not in roots:
            roots.append(legacy)
    return roots


def extracted_dataset_root() -> Path | None:
    """Datasets extracted from the DW by the worker (PRED-102).

    ``PREDICTION_EXTRACTED_DATASET_ROOT`` is written only by the worker and
    mounted read-only in the API, so uploads and extractions never share a
    writable store.
    """
    value = os.getenv("PREDICTION_EXTRACTED_DATASET_ROOT", "").strip()
    return Path(value).resolve() if value else None


def dataset_upload_max_bytes() -> int:
    return _read_int("PREDICTION_DATASET_UPLOAD_MAX_BYTES", 50 * 1024 * 1024)


def dataset_max_uncompressed_bytes() -> int:
    return _read_int("PREDICTION_DATASET_MAX_UNCOMPRESSED_BYTES", 200 * 1024 * 1024)


settings = Settings.from_environment()
