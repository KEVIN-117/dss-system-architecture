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


settings = Settings.from_environment()
