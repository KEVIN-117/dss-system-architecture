"""Resolve immutable training configuration references from an operator catalog."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
from typing import Any


def resolve_training_configuration(job_config: dict[str, Any] | None) -> dict[str, Any]:
    """Load a referenced JSON config from the read-only configured catalog.

    The API persists only an opaque reference. Operators provision the catalog
    outside the API request path; path traversal and symlink escapes are rejected.
    """
    job_config = job_config or {}
    config_ref = job_config.get("configuration_ref")
    if config_ref in (None, ""):
        return {}
    if not isinstance(config_ref, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}", config_ref):
        raise ValueError("configuration_ref must be an opaque identifier using letters, digits, dot, underscore, or hyphen.")
    root_value = os.getenv("PREDICTION_CONFIG_ROOT")
    if not root_value:
        raise RuntimeError("PREDICTION_CONFIG_ROOT is required when configuration_ref is supplied.")
    root = Path(root_value).resolve()
    candidate = (root / f"{config_ref}.json").resolve()
    if root not in candidate.parents:
        raise ValueError("configuration_ref must resolve to a JSON file inside PREDICTION_CONFIG_ROOT.")
    raw = candidate.read_bytes()
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("Referenced training configuration must be a JSON object.")
    value["configuration_ref"] = config_ref
    value["configuration_digest"] = hashlib.sha256(raw).hexdigest()
    return value
