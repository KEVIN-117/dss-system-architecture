"""Thread-safe job state store backed by a JSON file.

Manages lifecycle records for training jobs. Each record tracks status
transitions, artifact references, dependency versions, and error details.
The store uses a threading lock for process-level safety and atomic writes.
"""

from __future__ import annotations

import enum
import json
import logging
import tempfile
import threading
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class JobStatus(str, enum.Enum):
    """Lifecycle states for a training job."""

    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


@dataclass
class TrainingJobRecord:
    """Internal state for a single training job.

    Fields are intentionally plain-typed so that the record round-trips
    through JSON without adapters.  ``model_candidate`` is populated only
    when the job reaches ``SUCCEEDED``; ``error`` follows the RFC 9457
    Problem shape when the job reaches ``FAILED``.
    """

    job_id: str
    dataset_ref: str
    algorithm: str
    status: JobStatus
    created_at: str
    started_at: str | None
    finished_at: str | None
    submitted_by: str
    model_candidate: dict[str, Any] | None
    error: dict[str, Any] | None
    idempotency_key: str
    config: dict[str, Any]
    dataset_version: str
    dependency_versions: dict[str, str]


class JobStore:
    """Thread-safe job store backed by a JSON file.

    Uses a :class:`threading.Lock` for process-level safety and atomic file
    writes (write to a temporary file, then replace).  The store file lives
    at *store_path*.
    """

    def __init__(self, store_path: Path) -> None:
        self._path = store_path
        self._lock = threading.Lock()
        if not self._path.exists():
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._flush({})

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def create(self, record: TrainingJobRecord) -> None:
        """Persist a new job record.

        Raises :class:`ValueError` if a record with the same ``job_id``
        already exists.
        """
        with self._lock:
            store = self._load()
            if record.job_id in store:
                raise ValueError(f"Job {record.job_id} already exists.")
            store[record.job_id] = self._serialise(record)
            self._flush(store)
            logger.info("Job %s created with status %s.", record.job_id, record.status.value)

    def get(self, job_id: str) -> TrainingJobRecord | None:
        """Return the record for *job_id*, or ``None`` if not found."""
        with self._lock:
            store = self._load()
            raw = store.get(job_id)
            if raw is None:
                return None
            return self._deserialise(raw)

    def update_status(self, job_id: str, status: JobStatus, **kwargs: Any) -> None:
        """Transition a job to *status* and merge any extra fields.

        Accepted keyword arguments include ``started_at``, ``finished_at``,
        ``model_candidate``, and ``error``.  Unknown keys are silently
        ignored so callers remain forward-compatible.
        """
        allowed_extras = {
            "started_at", "finished_at", "model_candidate", "error",
            "dependency_versions",
        }
        with self._lock:
            store = self._load()
            raw = store.get(job_id)
            if raw is None:
                raise KeyError(f"Job {job_id} not found.")
            raw["status"] = status.value
            for key, value in kwargs.items():
                if key in allowed_extras:
                    raw[key] = value
            store[job_id] = raw
            self._flush(store)
            logger.info("Job %s transitioned to %s.", job_id, status.value)

    def find_by_idempotency_key(self, key: str) -> TrainingJobRecord | None:
        """Return the first record matching *key*, or ``None``."""
        with self._lock:
            store = self._load()
            for raw in store.values():
                if raw.get("idempotency_key") == key:
                    return self._deserialise(raw)
            return None

    def list_active(self) -> list[TrainingJobRecord]:
        """Return all records with status ``QUEUED`` or ``RUNNING``."""
        active_statuses = {JobStatus.QUEUED.value, JobStatus.RUNNING.value}
        with self._lock:
            store = self._load()
            return [
                self._deserialise(raw)
                for raw in store.values()
                if raw.get("status") in active_statuses
            ]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _load(self) -> dict[str, Any]:
        """Read the store file.  Caller must hold ``_lock``."""
        try:
            text = self._path.read_text(encoding="utf-8")
            data = json.loads(text)
            if not isinstance(data, dict):
                logger.warning("Store file corrupted; resetting.")
                return {}
            return data
        except (json.JSONDecodeError, OSError):
            logger.warning("Could not read store at %s; starting fresh.", self._path)
            return {}

    def _flush(self, store: dict[str, Any]) -> None:
        """Atomically write *store* to disk.  Caller must hold ``_lock``."""
        self._path.parent.mkdir(parents=True, exist_ok=True)
        fd = tempfile.NamedTemporaryFile(
            mode="w",
            dir=self._path.parent,
            suffix=".tmp",
            delete=False,
            encoding="utf-8",
        )
        try:
            json.dump(store, fd, indent=2, ensure_ascii=False)
            fd.flush()
            fd.close()
            Path(fd.name).replace(self._path)
        except BaseException:
            fd.close()
            Path(fd.name).unlink(missing_ok=True)
            raise

    @staticmethod
    def _serialise(record: TrainingJobRecord) -> dict[str, Any]:
        """Convert a record to a JSON-friendly dict."""
        data = asdict(record)
        data["status"] = record.status.value
        return data

    @staticmethod
    def _deserialise(raw: dict[str, Any]) -> TrainingJobRecord:
        """Reconstruct a record from a stored dict."""
        raw_copy = dict(raw)
        raw_copy["status"] = JobStatus(raw_copy["status"])
        return TrainingJobRecord(**raw_copy)
