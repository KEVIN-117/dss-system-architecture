"""Durable job repository. PostgreSQL is authoritative; SQLite supports tests."""
from __future__ import annotations

import enum
import hashlib
import json
import os
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


class JobStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


@dataclass
class TrainingJobRecord:
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
    request_digest: str = ""
    attempt: int = 0


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class IdempotencyConflict(ValueError):
    """An idempotency key was reused with a different request body."""


class _ClosingSqliteConnection(sqlite3.Connection):
    def __exit__(self, exc_type, exc, tb):
        try:
            return super().__exit__(exc_type, exc, tb)
        finally:
            self.close()


class JobStore:
    """PostgreSQL store with transactional outbox; file paths use SQLite for tests."""
    def __init__(self, dsn: str | None = None):
        self.dsn = str(dsn or os.getenv("PREDICTION_DATABASE_URL", ""))
        if self.dsn and not self.dsn.startswith(("sqlite:", "postgresql:", "postgres:")):
            self.dsn = "sqlite://" + self.dsn
        self._sqlite = self.dsn.startswith("sqlite:")
        if self._sqlite:
            self.path = self.dsn.removeprefix("sqlite://")
            with self._connect() as c:
                c.executescript("""CREATE TABLE IF NOT EXISTS jobs (
                  job_id TEXT PRIMARY KEY, idempotency_scope TEXT NOT NULL, idempotency_key TEXT NOT NULL,
                  request_digest TEXT NOT NULL, dataset_ref TEXT NOT NULL, algorithm TEXT NOT NULL,
                  status TEXT NOT NULL, created_at TEXT NOT NULL, started_at TEXT, finished_at TEXT,
                  submitted_by TEXT NOT NULL, model_candidate TEXT, error TEXT, config TEXT NOT NULL,
                  dataset_version TEXT NOT NULL, dependency_versions TEXT NOT NULL, attempt INTEGER NOT NULL DEFAULT 0,
                  lease_until TEXT, UNIQUE(idempotency_scope,idempotency_key));
                  CREATE TABLE IF NOT EXISTS outbox(job_id TEXT PRIMARY KEY, published_at TEXT, attempts INTEGER DEFAULT 0, last_error TEXT, next_attempt_at TEXT);
                """)
        elif not self.dsn:
            raise RuntimeError("PREDICTION_DATABASE_URL must be configured for the API and worker.")

    def _connect(self):
        if self._sqlite:
            c = sqlite3.connect(self.path, timeout=15, isolation_level="IMMEDIATE", factory=_ClosingSqliteConnection)
            c.row_factory = sqlite3.Row
            return c
        import psycopg
        return psycopg.connect(self.dsn, autocommit=False, row_factory=__import__('psycopg.rows', fromlist=['dict_row']).dict_row)

    @staticmethod
    def request_digest(dataset_ref: str, algorithm: str, config: dict[str, Any]) -> str:
        data = json.dumps({"dataset_ref":dataset_ref,"algorithm":algorithm,"config":config}, sort_keys=True, separators=(",",":"))
        return hashlib.sha256(data.encode()).hexdigest()

    def create(self, record: TrainingJobRecord, scope: str = "development") -> TrainingJobRecord:
        record.request_digest = record.request_digest or self.request_digest(record.dataset_ref, record.algorithm, record.config)
        try:
            with self._connect() as c:
                if self._sqlite:
                    c.execute("INSERT INTO jobs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)", self._values(record, scope))
                    c.execute("INSERT INTO outbox(job_id) VALUES (?)", (record.job_id,))
                else:
                    c.execute("""INSERT INTO ml_workspace.training_job
                    (job_id,idempotency_scope,idempotency_key,request_digest,dataset_ref,algorithm,status,created_at,started_at,finished_at,submitted_by,model_candidate,error,config,dataset_version,dependency_versions,attempt)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""", self._values(record, scope))
                    c.execute("INSERT INTO ml_workspace.training_job_outbox(job_id) VALUES (%s)", (record.job_id,))
            return record
        except Exception as exc:
            existing = self.find_by_idempotency_key(record.idempotency_key, scope)
            if existing:
                if existing.request_digest != record.request_digest: raise IdempotencyConflict("Idempotency-Key was already used for a different request") from exc
                return existing
            raise

    def _values(self, r, scope):
        v=(r.job_id,scope,r.idempotency_key,r.request_digest,r.dataset_ref,r.algorithm,r.status.value,r.created_at,r.started_at,r.finished_at,r.submitted_by,r.model_candidate,r.error,r.config,r.dataset_version,r.dependency_versions,r.attempt)
        if self._sqlite: return (*v[:11],json.dumps(v[11]),json.dumps(v[12]),json.dumps(v[13]),v[14],json.dumps(v[15]),v[16])
        from psycopg.types.json import Jsonb
        return (*v[:11], Jsonb(v[11]) if v[11] is not None else None,
                Jsonb(v[12]) if v[12] is not None else None, Jsonb(v[13]),
                v[14], Jsonb(v[15]), v[16])

    def _record(self, row):
        d=dict(row)
        d.pop("idempotency_scope", None)
        d.pop("lease_until", None)
        for k in ("model_candidate","error","config","dependency_versions"):
            if isinstance(d.get(k), str): d[k]=json.loads(d[k]) if d[k] else None
        if not self._sqlite: d["created_at"]=d["created_at"].isoformat(); d["started_at"]=d["started_at"].isoformat() if d["started_at"] else None; d["finished_at"]=d["finished_at"].isoformat() if d["finished_at"] else None
        d["job_id"] = str(d["job_id"])
        d["status"] = JobStatus(d["status"])
        d["request_digest"] = d.get("request_digest", "")
        d["idempotency_key"] = d.get("idempotency_key", "")
        return TrainingJobRecord(**{k:d[k] for k in TrainingJobRecord.__dataclass_fields__ if k in d})

    def get(self, job_id):
        with self._connect() as c:
            row=c.execute("SELECT * FROM "+("jobs" if self._sqlite else "ml_workspace.training_job")+" WHERE job_id="+("?" if self._sqlite else "%s"),(job_id,)).fetchone()
        return self._record(row) if row else None

    def find_by_idempotency_key(self,key,scope="development"):
        with self._connect() as c:
            row=c.execute("SELECT * FROM "+("jobs" if self._sqlite else "ml_workspace.training_job")+" WHERE idempotency_scope="+("?" if self._sqlite else "%s")+" AND idempotency_key="+("?" if self._sqlite else "%s"),(scope,key)).fetchone()
        return self._record(row) if row else None

    def update_status(self, job_id, status, expected_attempt: int | None = None, **kw) -> bool:
        """Update a job; with ``expected_attempt`` the write is fenced.

        A fenced update only applies while the row is still RUNNING under that
        claim, so a worker whose lease expired cannot overwrite a newer attempt.
        Returns whether a row was updated.
        """
        allowed={"started_at","finished_at","model_candidate","error","dependency_versions","attempt","lease_until"}
        vals={k:v for k,v in kw.items() if k in allowed}; vals["status"]=status.value
        if status in {JobStatus.SUCCEEDED, JobStatus.FAILED, JobStatus.CANCELLED}:
            vals.setdefault("lease_until", None)
        table="jobs" if self._sqlite else "ml_workspace.training_job"; ph="?" if self._sqlite else "%s"
        cols=[]; args=[]
        for k,v in vals.items():
            if k in {"model_candidate","error","dependency_versions"}: v=json.dumps(v) if v is not None else None
            cols.append(f"{k}={ph}"); args.append(v)
        where = f"job_id={ph}"
        args.append(job_id)
        if expected_attempt is not None:
            where += f" AND attempt={ph} AND status='RUNNING'"
            args.append(expected_attempt)
        with self._connect() as c:
            return c.execute(f"UPDATE {table} SET {','.join(cols)} WHERE {where}",args).rowcount == 1

    def claim_attempt(self, job_id, lease_seconds=3600, max_attempts: int | None = None) -> int | None:
        """Atomically claim a QUEUED (or expired RUNNING) job; return its attempt number.

        Returns ``None`` when the job is not claimable, including when it has
        already used ``max_attempts`` claims.
        """
        limit = "" if max_attempts is None else (" AND attempt < ?" if self._sqlite else " AND attempt < %s")
        with self._connect() as c:
            if self._sqlite:
                args = [f'+{lease_seconds} seconds', job_id] + ([] if max_attempts is None else [max_attempts])
                row=c.execute("UPDATE jobs SET status='RUNNING',attempt=attempt+1,started_at=datetime('now'),finished_at=NULL,error=NULL,lease_until=datetime('now',?) WHERE job_id=? AND (status='QUEUED' OR (status='RUNNING' AND lease_until < datetime('now')))"+limit+" RETURNING attempt",args).fetchone()
            else:
                args = [lease_seconds, job_id] + ([] if max_attempts is None else [max_attempts])
                row=c.execute("UPDATE ml_workspace.training_job SET status='RUNNING',attempt=attempt+1,started_at=clock_timestamp(),finished_at=NULL,error=NULL,lease_until=clock_timestamp()+(%s * interval '1 second') WHERE job_id=%s AND (status='QUEUED' OR (status='RUNNING' AND lease_until < clock_timestamp()))"+limit+" RETURNING attempt",args).fetchone()
            return int(row["attempt"]) if row else None

    def claim(self,job_id,lease_seconds=3600,max_attempts: int | None = None) -> bool:
        return self.claim_attempt(job_id, lease_seconds, max_attempts) is not None

    def fail_exhausted(self, job_id, max_attempts: int, error: dict[str, Any]) -> bool:
        """Fail a job whose last allowed attempt died without finishing (expired lease)."""
        if self._sqlite:
            sql = "UPDATE jobs SET status='FAILED',finished_at=?,error=?,lease_until=NULL WHERE job_id=? AND status='RUNNING' AND attempt >= ? AND lease_until < datetime('now')"
        else:
            sql = "UPDATE ml_workspace.training_job SET status='FAILED',finished_at=%s,error=%s,lease_until=NULL WHERE job_id=%s AND status='RUNNING' AND attempt >= %s AND lease_until < clock_timestamp()"
        with self._connect() as c:
            return c.execute(sql, (_utc_now(), json.dumps(error), job_id, max_attempts)).rowcount == 1

    def cancel(self, job_id) -> bool:
        """Cancel a job that no worker has claimed yet; running jobs are not interrupted."""
        table = "jobs" if self._sqlite else "ml_workspace.training_job"; ph = "?" if self._sqlite else "%s"
        with self._connect() as c:
            return c.execute(f"UPDATE {table} SET status='CANCELLED',finished_at={ph},lease_until=NULL WHERE job_id={ph} AND status='QUEUED'",
                             (_utc_now(), job_id)).rowcount == 1

    def pending_outbox(self,limit=100):
        with self._connect() as c:
            q="SELECT job_id FROM "+("outbox" if self._sqlite else "ml_workspace.training_job_outbox")+" WHERE published_at IS NULL AND (next_attempt_at IS NULL OR next_attempt_at <= CURRENT_TIMESTAMP) ORDER BY "+("rowid" if self._sqlite else "outbox_id")+" LIMIT "+str(int(limit))
            return [r["job_id"] for r in c.execute(q).fetchall()]

    def mark_published(self,job_id,error=None):
        table="outbox" if self._sqlite else "ml_workspace.training_job_outbox"; p="?" if self._sqlite else "%s"
        with self._connect() as c:
            if error and self._sqlite:
                c.execute(f"UPDATE {table} SET attempts=attempts+1,last_error={p},next_attempt_at=datetime('now','+' || min(256, (1 << min(attempts,8))) || ' seconds') WHERE job_id={p}",(str(error)[:500],job_id))
            elif error:
                c.execute(f"UPDATE {table} SET attempts=attempts+1,last_error={p},next_attempt_at=clock_timestamp()+(LEAST(256, (1 << LEAST(attempts,8))) * interval '1 second') WHERE job_id={p}",(str(error)[:500],job_id))
            else:
                c.execute(f"UPDATE {table} SET published_at=CURRENT_TIMESTAMP,attempts=attempts+1,last_error=NULL,next_attempt_at=NULL WHERE job_id={p}",(job_id,))

    def list_active(self):
        table="jobs" if self._sqlite else "ml_workspace.training_job"
        # A RUNNING row only consumes worker capacity while its lease is valid.
        # Expired leases are reclaimable by `claim()` and must not block new work.
        with self._connect() as c: rows=c.execute(f"SELECT * FROM {table} WHERE status='QUEUED' OR (status='RUNNING' AND lease_until > CURRENT_TIMESTAMP)").fetchall()
        return [self._record(r) for r in rows]
