"""Runtime configuration for prediction-service."""

from __future__ import annotations

import os
from dataclasses import dataclass


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
        )


settings = Settings.from_environment()
