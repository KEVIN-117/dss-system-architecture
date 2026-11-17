"""Durable state and atomic publication for population prediction batches."""
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
from typing import Any, Mapping, Sequence


class PublicationConflict(ValueError):
    pass


class _ClosingSqliteConnection(sqlite3.Connection):
    def __exit__(self, exc_type, exc, tb):
        try:
            return super().__exit__(exc_type, exc, tb)
        finally:
            self.close()


class PredictionPublicationStore:
    """PostgreSQL is authoritative; SQLite is supported for isolated tests."""

    def __init__(self, dsn: str | None = None):
        self.dsn = str(dsn or os.getenv("PREDICTION_DATABASE_URL", ""))
        self._sqlite = self.dsn.startswith("sqlite:")
        if not self.dsn:
            raise RuntimeError("PREDICTION_DATABASE_URL must be configured.")
        if self._sqlite:
            self.path = self.dsn.removeprefix("sqlite://")
            with self._connect() as c:
                c.executescript("""CREATE TABLE IF NOT EXISTS prediction_batches (
                    batch_id TEXT PRIMARY KEY, idempotency_scope TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL, request_digest TEXT NOT NULL,
                    event_code TEXT NOT NULL, program_ref TEXT NOT NULL, closure_id TEXT NOT NULL,
                    model_id TEXT NOT NULL, model_version TEXT NOT NULL, submitted_by TEXT NOT NULL,
                    authorized_scope TEXT NOT NULL, status TEXT NOT NULL, result_count INTEGER NOT NULL DEFAULT 0,
                    source_execution_ids TEXT NOT NULL DEFAULT '[]', error TEXT, created_at TEXT NOT NULL,
                    started_at TEXT, finished_at TEXT, published_at TEXT, lease_until TEXT,
                    attempt INTEGER NOT NULL DEFAULT 0, UNIQUE(idempotency_scope,idempotency_key));
                    CREATE TABLE IF NOT EXISTS prediction_batch_outbox (
                    batch_id TEXT PRIMARY KEY, published_at TEXT, attempts INTEGER NOT NULL DEFAULT 0,
                    last_error TEXT, next_attempt_at TEXT);
                    CREATE TABLE IF NOT EXISTS prediction_results (
                    batch_id TEXT NOT NULL, subject_ref TEXT NOT NULL, program_ref TEXT NOT NULL,
                    closure_id TEXT NOT NULL, predicted_class TEXT NOT NULL, event_probability REAL,
                    model_id TEXT NOT NULL, model_version TEXT NOT NULL, generated_at TEXT NOT NULL,
                    PRIMARY KEY(batch_id,subject_ref));""")
                # Upgrade SQLite files created before leases/attempt fencing.
                columns = {row["name"] for row in c.execute("PRAGMA table_info(prediction_batches)").fetchall()}
                if "lease_until" not in columns:
                    c.execute("ALTER TABLE prediction_batches ADD COLUMN lease_until TEXT")
                if "attempt" not in columns:
                    c.execute("ALTER TABLE prediction_batches ADD COLUMN attempt INTEGER NOT NULL DEFAULT 0")

    def _connect(self):
        if self._sqlite:
            c = sqlite3.connect(self.path, timeout=20, isolation_level="IMMEDIATE", factory=_ClosingSqliteConnection)
            c.row_factory = sqlite3.Row
            return c
        import psycopg
        from psycopg.rows import dict_row
        return psycopg.connect(self.dsn, connect_timeout=5, autocommit=False, row_factory=dict_row)

    @staticmethod
    def digest(program_ref: str, closure_id: str, model_id: str, model_version: str) -> str:
        body = json.dumps([program_ref, closure_id, model_id, model_version], separators=(",", ":"))
        return hashlib.sha256(body.encode()).hexdigest()

    def create(self, batch: Mapping[str, Any], scope: str) -> dict[str, Any]:
        placeholder = "?" if self._sqlite else "%s"
        table = "prediction_batches" if self._sqlite else "ml_workspace.prediction_batch"
        outbox = "prediction_batch_outbox" if self._sqlite else "ml_workspace.prediction_batch_outbox"
        values = (batch["batch_id"], scope, batch["idempotency_key"], batch["request_digest"],
                  batch["event_code"], batch["program_ref"], batch["closure_id"], batch["model_id"],
                  batch["model_version"], batch["submitted_by"], json.dumps(batch["authorized_scope"]),
                  "QUEUED", 0, "[]", None, batch["created_at"])
        if not self._sqlite:
            from psycopg.types.json import Jsonb
            # source_execution_ids is UUID[] in PostgreSQL: pass a real (empty) array,
            # not the SQLite JSON text "[]", which PostgreSQL rejects.
            values = (*values[:10], Jsonb(batch["authorized_scope"]), *values[11:13], [], *values[14:])
        try:
            with self._connect() as c:
                c.execute(f"""INSERT INTO {table}
                    (batch_id,idempotency_scope,idempotency_key,request_digest,event_code,program_ref,closure_id,
                     model_id,model_version,submitted_by,authorized_scope,status,result_count,source_execution_ids,error,created_at)
                    VALUES ({','.join([placeholder] * len(values))})""", values)
                c.execute(f"INSERT INTO {outbox}(batch_id) VALUES ({placeholder})", (batch["batch_id"],))
            return dict(batch, status="QUEUED", result_count=0)
        except Exception:
            existing = self.find_by_key(batch["idempotency_key"], scope)
            if existing:
                if existing["request_digest"] != batch["request_digest"]:
                    raise PublicationConflict("Idempotency-Key was used for a different publication request.")
                return existing
            raise

    def find_by_key(self, key: str, scope: str) -> dict[str, Any] | None:
        table = "prediction_batches" if self._sqlite else "ml_workspace.prediction_batch"
        with self._connect() as c:
            row = c.execute(f"SELECT * FROM {table} WHERE idempotency_scope=? AND idempotency_key=?" if self._sqlite else
                            f"SELECT * FROM {table} WHERE idempotency_scope=%s AND idempotency_key=%s", (scope, key)).fetchone()
        return self._decode(row) if row else None

    def get(self, batch_id: str, include_results: bool = False, limit: int = 500, offset: int = 0) -> dict[str, Any] | None:
        table = "prediction_batches" if self._sqlite else "ml_workspace.prediction_batch"
        with self._connect() as c:
            row = c.execute(f"SELECT * FROM {table} WHERE batch_id=?" if self._sqlite else
                            f"SELECT * FROM {table} WHERE batch_id=%s", (batch_id,)).fetchone()
            if not row:
                return None
            result = self._decode(row)
            if include_results and result["status"] == "PUBLISHED":
                results = "prediction_results" if self._sqlite else "ml_workspace.v_published_prediction"
                rows = c.execute(f"SELECT * FROM {results} WHERE batch_id=? ORDER BY subject_ref LIMIT ? OFFSET ?" if self._sqlite else
                                 f"SELECT * FROM {results} WHERE batch_id=%s ORDER BY subject_ref LIMIT %s OFFSET %s", (batch_id, limit, offset)).fetchall()
                result["results"] = [self._decode(item) for item in rows]
                result["result_offset"] = offset
                result["result_limit"] = limit
                result["has_more"] = offset + len(rows) < result["result_count"]
            return result

    def current(self, program_ref: str, closure_id: str) -> dict[str, Any] | None:
        table = "prediction_batches" if self._sqlite else "ml_workspace.prediction_batch"
        sql = (f"SELECT * FROM {table} WHERE program_ref=? AND closure_id=? AND status='PUBLISHED' ORDER BY published_at DESC LIMIT 1" if self._sqlite else
               f"SELECT * FROM {table} WHERE program_ref=%s AND closure_id=%s AND status='PUBLISHED' ORDER BY published_at DESC LIMIT 1")
        with self._connect() as c:
            row = c.execute(sql, (program_ref, closure_id)).fetchone()
        return self._decode(row) if row else None

    def pending(self, limit: int = 100) -> list[str]:
        outbox = "prediction_batch_outbox" if self._sqlite else "ml_workspace.prediction_batch_outbox"
        sql = (f"SELECT batch_id FROM {outbox} WHERE published_at IS NULL AND (next_attempt_at IS NULL OR next_attempt_at<=CURRENT_TIMESTAMP) ORDER BY batch_id LIMIT {int(limit)}")
        with self._connect() as c:
            return [str(row["batch_id"]) for row in c.execute(sql).fetchall()]

    def mark_dispatched(self, batch_id: str, error: Exception | None = None) -> None:
        outbox = "prediction_batch_outbox" if self._sqlite else "ml_workspace.prediction_batch_outbox"
        if self._sqlite:
            sql = (f"UPDATE {outbox} SET attempts=attempts+1,last_error=?,next_attempt_at=datetime('now','+' || min(256, (1 << min(attempts,8))) || ' seconds') WHERE batch_id=?"
                   if error else f"UPDATE {outbox} SET published_at=CURRENT_TIMESTAMP,attempts=attempts+1,last_error=NULL,next_attempt_at=NULL WHERE batch_id=?")
            args = (str(error)[:500], batch_id) if error else (batch_id,)
        else:
            sql = (f"UPDATE {outbox} SET attempts=attempts+1,last_error=%s,next_attempt_at=clock_timestamp()+(LEAST(256,(1 << LEAST(attempts,8))) * interval '1 second') WHERE batch_id=%s"
                   if error else f"UPDATE {outbox} SET published_at=clock_timestamp(),attempts=attempts+1,last_error=NULL,next_attempt_at=NULL WHERE batch_id=%s")
            args = (str(error)[:500], batch_id) if error else (batch_id,)
        with self._connect() as c:
            c.execute(sql, args)

    def claim_attempt(self, batch_id: str, lease_seconds: int = 1800, max_attempts: int | None = None) -> int | None:
        """Claim a QUEUED (or lease-expired RUNNING) batch and return its attempt number."""
        table = "prediction_batches" if self._sqlite else "ml_workspace.prediction_batch"
        if self._sqlite:
            sql = (f"UPDATE {table} SET status='RUNNING',attempt=attempt+1,started_at=datetime('now'),finished_at=NULL,error=NULL,"
                   "lease_until=datetime('now',?) WHERE batch_id=? AND (status='QUEUED' OR (status='RUNNING' AND lease_until < datetime('now')))")
            args: list[Any] = [f"+{lease_seconds} seconds", batch_id]
            if max_attempts is not None:
                sql += " AND attempt < ?"
                args.append(max_attempts)
        else:
            sql = (f"UPDATE {table} SET status='RUNNING',attempt=attempt+1,started_at=clock_timestamp(),finished_at=NULL,error=NULL,"
                   "lease_until=clock_timestamp()+(%s * interval '1 second') WHERE batch_id=%s AND (status='QUEUED' OR (status='RUNNING' AND lease_until < clock_timestamp()))")
            args = [lease_seconds, batch_id]
            if max_attempts is not None:
                sql += " AND attempt < %s"
                args.append(max_attempts)
        with self._connect() as c:
            row = c.execute(sql + " RETURNING attempt", args).fetchone()
        return int(row["attempt"]) if row else None

    def claim(self, batch_id: str, lease_seconds: int = 1800, max_attempts: int | None = None) -> bool:
        return self.claim_attempt(batch_id, lease_seconds, max_attempts) is not None

    def fail(self, batch_id: str, error: Mapping[str, Any], attempt: int | None = None) -> bool:
        """Mark FAILED; with ``attempt`` only while that claim still owns the batch."""
        table = "prediction_batches" if self._sqlite else "ml_workspace.prediction_batch"
        p = "?" if self._sqlite else "%s"
        now = "CURRENT_TIMESTAMP" if self._sqlite else "clock_timestamp()"
        sql = f"UPDATE {table} SET status='FAILED',error={p},finished_at={now},lease_until=NULL WHERE batch_id={p}"
        args: list[Any] = [self._json(error), batch_id]
        if attempt is not None:
            sql += f" AND status='RUNNING' AND attempt={p}"
            args.append(attempt)
        with self._connect() as c:
            return c.execute(sql, args).rowcount == 1

    def fail_exhausted(self, batch_id: str, max_attempts: int, error: Mapping[str, Any]) -> bool:
        """Fail a batch whose last allowed attempt died with an expired lease."""
        table = "prediction_batches" if self._sqlite else "ml_workspace.prediction_batch"
        if self._sqlite:
            sql = (f"UPDATE {table} SET status='FAILED',error=?,finished_at=CURRENT_TIMESTAMP,lease_until=NULL "
                   "WHERE batch_id=? AND status='RUNNING' AND attempt >= ? AND lease_until < datetime('now')")
        else:
            sql = (f"UPDATE {table} SET status='FAILED',error=%s,finished_at=clock_timestamp(),lease_until=NULL "
                   "WHERE batch_id=%s AND status='RUNNING' AND attempt >= %s AND lease_until < clock_timestamp()")
        with self._connect() as c:
            return c.execute(sql, (self._json(error), batch_id, max_attempts)).rowcount == 1

    def _json(self, value: Mapping[str, Any]) -> Any:
        if self._sqlite:
            return json.dumps(value)
        from psycopg.types.json import Jsonb
        return Jsonb(dict(value))

    def publish(self, batch_id: str, rows: Sequence[Mapping[str, Any]], source_execution_ids: Sequence[str],
                attempt: int | None = None) -> None:
        """Insert all rows and flip status in one transaction; readers only see PUBLISHED.

        With ``attempt`` the flip is fenced: a worker whose claim was superseded
        rolls back instead of publishing over the newer attempt.
        """
        batches = "prediction_batches" if self._sqlite else "ml_workspace.prediction_batch"
        results = "prediction_results" if self._sqlite else "ml_workspace.prediction_result"
        p = "?" if self._sqlite else "%s"
        now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
        fence = f" AND attempt={p}" if attempt is not None else ""
        fence_args = (attempt,) if attempt is not None else ()
        with self._connect() as c:
            c.execute(f"DELETE FROM {results} WHERE batch_id={p}", (batch_id,))
            for row in rows:
                c.execute(f"""INSERT INTO {results}(batch_id,subject_ref,program_ref,closure_id,predicted_class,event_probability,model_id,model_version,generated_at)
                    VALUES ({','.join([p] * 9)})""", (batch_id, row["subject_ref"], row["program_ref"], row["closure_id"],
                    row["predicted_class"], row.get("event_probability"), row["model_id"], row["model_version"], row["generated_at"]))
            if self._sqlite:
                c.execute(f"UPDATE {batches} SET status='PUBLISHED',result_count={p},source_execution_ids={p},finished_at={p},published_at={p},lease_until=NULL WHERE batch_id={p} AND status='RUNNING'" + fence,
                          (len(rows), json.dumps(list(source_execution_ids)), now, now, batch_id, *fence_args))
            else:
                from uuid import UUID
                c.execute(f"UPDATE {batches} SET status='PUBLISHED',result_count=%s,source_execution_ids=%s,finished_at=clock_timestamp(),published_at=clock_timestamp(),lease_until=NULL WHERE batch_id=%s AND status='RUNNING'" + fence,
                          (len(rows), [UUID(value) for value in source_execution_ids], batch_id, *fence_args))
            if c.execute(f"SELECT status FROM {batches} WHERE batch_id={p}", (batch_id,)).fetchone()["status"] != "PUBLISHED":
                raise RuntimeError("Batch state changed before atomic publication.")

    @staticmethod
    def _decode(row: Any) -> dict[str, Any]:
        result = dict(row)
        if result.get("batch_id") is not None:
            result["batch_id"] = str(result["batch_id"])
        for key in ("authorized_scope", "source_execution_ids", "error"):
            if isinstance(result.get(key), str):
                try:
                    result[key] = json.loads(result[key])
                except json.JSONDecodeError:
                    pass
        for key, value in list(result.items()):
            if hasattr(value, "isoformat"):
                # psycopg returns native timestamps; API JSON must use ISO-8601.
                result[key] = value.isoformat()
            elif isinstance(value, list):
                result[key] = [str(item) for item in value]
        return result
