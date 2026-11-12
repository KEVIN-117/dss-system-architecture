"""Characterize API/BFF availability while the isolated ML worker is training.

This development-only driver uses the PRED-003 synthetic dataset for training
and caller-supplied Faker DW references for read-only inference/publication
queries. It does not write prediction outcomes to observed DW facts. No SLA is
assumed: without explicit threshold arguments the report is characterization
evidence, not a pass/fail capacity claim.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import math
import os
import statistics
import subprocess
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import uuid4


API_URL = os.getenv("PREDICTION_LOAD_API_URL", "http://localhost:8000").rstrip("/")
DASHBOARD_URL = os.getenv("PREDICTION_LOAD_DASHBOARD_URL", "").rstrip("/")
BFF_URL = os.getenv("PREDICTION_LOAD_BFF_URL", "").rstrip("/")
TOKEN = os.getenv("PREDICTION_LOAD_ACCESS_TOKEN", "")
SESSION_COOKIE = os.getenv("PREDICTION_LOAD_SESSION_COOKIE", "")
TRAINING_SESSION_COOKIE = os.getenv("PREDICTION_LOAD_TRAINING_SESSION_COOKIE", SESSION_COOKIE)
# Direct API training calls need an ML-operator token (SUPERADMIN by default).
TRAINING_ACCESS_TOKEN = os.getenv("PREDICTION_LOAD_TRAINING_ACCESS_TOKEN", TOKEN)
PROGRAM_REF = os.getenv("PREDICTION_LOAD_PROGRAM_REF", "")
CUT_ID = os.getenv("PREDICTION_LOAD_CUT_ID", "")
SUBJECT_REF = os.getenv("PREDICTION_LOAD_SUBJECT_REF", "")
DW_DSN = os.getenv("PREDICTION_LOAD_DW_DATABASE_URL", "")
DATASET_REF = "fixture:pred003_synthetic-v1"
USE_BFF_SESSION = not TOKEN and bool(BFF_URL and SESSION_COOKIE)
COMPOSE_FILE = os.getenv("PREDICTION_LOAD_COMPOSE_FILE", "")
COMPOSE_PROJECT = os.getenv("PREDICTION_LOAD_COMPOSE_PROJECT", "")
COMPOSE_API_SERVICE = os.getenv("PREDICTION_LOAD_COMPOSE_API_SERVICE", "prediction-service")
COMPOSE_WORKER_SERVICE = os.getenv("PREDICTION_LOAD_COMPOSE_WORKER_SERVICE", "prediction-worker")


def compose_command(*arguments: str, project: str | None = None, compose_file: str | None = None) -> list[str]:
    """Build a Docker Compose command scoped to the measured stack."""
    command = ["docker", "compose"]
    selected_project = COMPOSE_PROJECT if project is None else project
    selected_file = COMPOSE_FILE if compose_file is None else compose_file
    if selected_project:
        command.extend(("-p", selected_project))
    if selected_file:
        command.extend(("-f", selected_file))
    command.extend(arguments)
    return command


def build_inference_payload(subject_ref: str, program_ref: str, cut_id: str) -> dict[str, Any]:
    """Return the request shape accepted by the shared BFF/API contract."""
    return {
        "contract_version": "1.0",
        "subject_ref": subject_ref,
        "program_ref": program_ref,
        "academic_cut": {"cut_id": cut_id},
    }


@dataclass(frozen=True)
class Limits:
    duration_seconds: int
    clients: int
    request_interval_seconds: float
    request_timeout_seconds: float
    poll_interval_seconds: float
    max_training_jobs: int


def request(method: str, url: str, *, payload: dict[str, Any] | None = None,
            token: str | None = None, timeout: float = 10,
            extra_headers: dict[str, str] | None = None,
            reject_graphql_errors: bool = False,
            capture_json: bool = False) -> tuple[int, float, str, dict[str, Any] | None]:
    headers = {"Accept": "application/json"}
    body = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(payload).encode("utf-8")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    headers.update(extra_headers or {})
    req = Request(url, data=body, headers=headers, method=method)
    started = time.perf_counter()
    try:
        with urlopen(req, timeout=timeout) as response:
            body_bytes = response.read()
            parsed: dict[str, Any] | None = None
            if reject_graphql_errors or capture_json:
                try:
                    parsed = json.loads(body_bytes)
                    if reject_graphql_errors and parsed.get("errors"):
                        return response.status, time.perf_counter() - started, "graphql_errors", None
                except (json.JSONDecodeError, AttributeError):
                    if reject_graphql_errors:
                        return response.status, time.perf_counter() - started, "invalid_graphql_response", None
            return response.status, time.perf_counter() - started, "", parsed
    except HTTPError as error:
        raw_error = error.read()
        code = ""
        try:
            parsed_error = json.loads(raw_error)
            candidate = parsed_error.get("code") if isinstance(parsed_error, dict) else None
            if isinstance(candidate, str) and candidate.replace("_", "").isalnum():
                code = f":{candidate[:64]}"
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass
        return error.code, time.perf_counter() - started, f"http_{error.code}{code}", None
    except (URLError, TimeoutError, OSError) as error:
        return 0, time.perf_counter() - started, type(error).__name__, None


def endpoints() -> list[tuple[str, str, str]]:
    inference_url = (BFF_URL + "/api/prediction/v1/predictions" if USE_BFF_SESSION
                     else API_URL + "/v1/predictions")
    publication_base = (BFF_URL + "/api/prediction/v1/prediction-publications" if USE_BFF_SESSION
                        else API_URL + "/v1/prediction-publications")
    publication = publication_base + "?" + urlencode({"program_ref": PROGRAM_REF, "cut_id": CUT_ID})
    targets = [("bff_health" if USE_BFF_SESSION else "health", "GET",
                BFF_URL + "/api/health" if USE_BFF_SESSION else API_URL + "/"),
               ("inference", "POST", inference_url), ("publication", "GET", publication)]
    if DASHBOARD_URL:
        targets.append(("dashboard", "GET", DASHBOARD_URL + "/predictions"))
    if BFF_URL:
        targets.append(("bff_publication", "POST", BFF_URL + "/api/graphql"))
    return targets


def probe(name: str, method: str, url: str, timeout: float) -> tuple[str, int, float, str, dict[str, Any]]:
    payload = None
    token = TOKEN
    if name == "inference":
        payload = build_inference_payload(SUBJECT_REF, PROGRAM_REF, CUT_ID)
    elif name == "bff_publication":
        payload = {
            "query": "query PredictionPublication($programRef: String!, $cutId: String!) { "
                     "predictionPublication(programRef: $programRef, cutId: $cutId) { publication } }",
            "variables": {"programRef": PROGRAM_REF, "cutId": CUT_ID},
        }
    extra_headers = {"Cookie": SESSION_COOKIE} if SESSION_COOKIE and (
        name == "dashboard" or USE_BFF_SESSION
    ) else None
    status, duration, error, response = request(
        method, url, payload=payload, token=token, timeout=timeout,
        extra_headers=extra_headers, reject_graphql_errors=name == "bff_publication",
        capture_json=name == "inference",
    )
    details: dict[str, Any] = {}
    if name == "inference" and response:
        model = response.get("model")
        if isinstance(model, dict):
            details = {"model_id": model.get("model_id"), "model_version": model.get("version")}
    return name, status, duration, error, details


def worker_loop(stop: threading.Event, records: list[dict[str, Any]], lock: threading.Lock,
                limits: Limits) -> None:
    targets = endpoints()
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(targets)) as pool:
        while not stop.is_set():
            started = time.monotonic()
            futures = [pool.submit(probe, name, method, url, limits.request_timeout_seconds)
                       for name, method, url in targets]
            batch = [future.result() for future in futures]
            timestamp = datetime.now(timezone.utc).isoformat()
            with lock:
                records.extend({"scenario": "", "timestamp": timestamp, "endpoint": name,
                                "status": status, "latency_seconds": latency, "error": error, **details}
                               for name, status, latency, error, details in batch)
            stop.wait(max(0, limits.request_interval_seconds - (time.monotonic() - started)))


def wait_job(job_id: str, timeout: float, poll_interval: float) -> str:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        url = (BFF_URL + f"/api/prediction/v1/training-jobs/{job_id}" if USE_BFF_SESSION
               else API_URL + f"/v1/training-jobs/{job_id}")
        headers = {"Accept": "application/json"}
        if USE_BFF_SESSION:
            headers["Cookie"] = TRAINING_SESSION_COOKIE
        else:
            headers["Authorization"] = f"Bearer {TRAINING_ACCESS_TOKEN}"
        req = Request(url, headers=headers)
        try:
            with urlopen(req, timeout=10) as response:
                state = json.loads(response.read()).get("status")
        except (HTTPError, URLError, TimeoutError, OSError) as error:
            raise RuntimeError(f"Could not read training job state ({type(error).__name__}).") from error
        if state in {"SUCCEEDED", "FAILED", "CANCELLED"}:
            return state
        time.sleep(poll_interval)
    raise TimeoutError("Training job did not reach a terminal state within the configured timeout.")


def submit_training(algorithm: str) -> str:
    body = {"dataset_ref": DATASET_REF, "algorithm": algorithm}
    url = (BFF_URL + "/api/prediction/v1/training-jobs" if USE_BFF_SESSION
           else API_URL + "/v1/training-jobs")
    headers = {"Content-Type": "application/json", "Idempotency-Key": str(uuid4())}
    if USE_BFF_SESSION:
        headers["Cookie"] = TRAINING_SESSION_COOKIE
    else:
        # The API verifies the JWT and the ML-operator role itself.
        headers["Authorization"] = f"Bearer {TRAINING_ACCESS_TOKEN}"
    req = Request(url, data=json.dumps(body).encode(), headers=headers, method="POST")
    try:
        with urlopen(req, timeout=15) as response:
            if response.status != 202:
                raise RuntimeError(f"Training submit returned unexpected HTTP {response.status}.")
            accepted = json.loads(response.read())
    except HTTPError as error:
        # Surface only stable, non-sensitive Problem Details fields. In particular,
        # this distinguishes an expired/invalid BFF session (401) from authorization
        # or API policy failures without logging the cookie or response detail.
        raw_error = error.read()
        error_code = ""
        error_title = ""
        try:
            problem = json.loads(raw_error)
            if isinstance(problem, dict):
                for key, target in (("code", "error_code"), ("title", "error_title")):
                    value = problem.get(key)
                    if isinstance(value, str) and value.replace("_", "").replace(" ", "").isalnum():
                        if target == "error_code":
                            error_code = value[:64]
                        else:
                            error_title = value[:80]
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass
        context = ", ".join(value for value in (error_code, error_title) if value)
        suffix = f", {context}" if context else ""
        raise RuntimeError(
            f"Could not submit synthetic {algorithm} training job (HTTP {error.code}{suffix})."
        ) from error
    return str(accepted["job_id"])


def docker_stats() -> dict[str, Any]:
    services = [part.strip() for part in os.getenv(
        "PREDICTION_LOAD_COMPOSE_SERVICES",
        "prediction-service,prediction-worker,postgres-dw,rabbitmq,graphql-bff",
    ).split(",") if part.strip()]
    lookup = subprocess.run(compose_command("ps", "-q", *services), capture_output=True,
                            text=True, check=False)
    ids = [item for item in lookup.stdout.splitlines() if item.strip()]
    if not ids:
        return {}
    result = subprocess.run(["docker", "stats", "--no-stream", "--format", "{{json .}}", *ids],
                            capture_output=True, text=True, check=False)
    if result.returncode:
        return {"error": "docker_stats_unavailable"}
    samples: dict[str, Any] = {}
    for line in result.stdout.splitlines():
        try:
            item = json.loads(line)
            samples[item.get("Name", item.get("ID", "unknown"))] = {
                "cpu_percent": item.get("CPUPerc"), "memory_usage": item.get("MemUsage"),
                "memory_percent": item.get("MemPerc"), "block_io": item.get("BlockIO"),
                "network_io": item.get("NetIO"),
            }
        except json.JSONDecodeError:
            continue
    return samples


def container_limits(service: str) -> dict[str, int | str] | None:
    lookup = subprocess.run(compose_command("ps", "-q", service), capture_output=True,
                            text=True, check=False)
    container_id = lookup.stdout.strip().splitlines()
    if not container_id:
        return None
    inspected = subprocess.run(
        ["docker", "inspect", "--format", "{{.HostConfig.NanoCpus}} {{.HostConfig.Memory}}", container_id[0]],
        capture_output=True, text=True, check=False,
    )
    if inspected.returncode:
        return {"error": "docker_inspect_unavailable"}
    parts = inspected.stdout.split()
    if len(parts) != 2:
        return {"error": "docker_inspect_unexpected_output"}
    return {"cpu_nano_cpus": int(parts[0]), "memory_bytes": int(parts[1])}


def database_activity() -> dict[str, Any] | None:
    if not DW_DSN:
        return None
    import psycopg

    try:
        with psycopg.connect(DW_DSN, connect_timeout=3,
                             options="-c default_transaction_read_only=on") as connection:
            row = connection.execute("""
                SELECT count(*) FILTER (WHERE state = 'active') AS active,
                       count(*) FILTER (WHERE wait_event_type IS NOT NULL) AS waiting
                FROM pg_stat_activity
                WHERE datname = current_database() AND pid <> pg_backend_pid()
            """).fetchone()
        return {"active_sessions": int(row[0]), "waiting_sessions": int(row[1])}
    except Exception as error:
        return {"error": type(error).__name__}


def summarize(records: list[dict[str, Any]]) -> dict[str, Any]:
    summary: dict[str, Any] = {}
    for name in sorted({item["endpoint"] for item in records}):
        items = [item for item in records if item["endpoint"] == name]
        latencies = sorted(item["latency_seconds"] for item in items)

        def percentile(fraction: float) -> float | None:
            if not latencies:
                return None
            return latencies[min(len(latencies) - 1, math.ceil(fraction * len(latencies)) - 1)]

        for item in items:
            item["request_success"] = not item.get("error") and (
                200 <= item["status"] < 400 if name == "dashboard" else item["status"] == 200
            )
        successes = sum(item["request_success"] for item in items)
        summary[name] = {
            "requests": len(items), "successful_responses": successes,
            "errors": len(items) - successes,
            "error_rate": round((len(items) - successes) / len(items), 6) if items else None,
            "latency_ms": {"p50": round(statistics.median(latencies) * 1000, 3) if latencies else None,
                           "p95": round((percentile(.95) or 0) * 1000, 3) if latencies else None,
                           "max": round(max(latencies) * 1000, 3) if latencies else None},
            "status_counts": {str(code): sum(item["status"] == code for item in items)
                              for code in sorted({item["status"] for item in items})},
        }
        if name == "inference":
            summary[name]["model_versions_seen"] = sorted({
                f"{item.get('model_id')}@{item.get('model_version')}"
                for item in items if item.get("model_id") and item.get("model_version")
            })
    return summary


def run_load_window(scenario: str, seconds: int, limits: Limits,
                    infra: list[dict[str, Any]]) -> list[dict[str, Any]]:
    stop = threading.Event()
    lock = threading.Lock()
    local: list[dict[str, Any]] = []
    clients = [threading.Thread(target=worker_loop, args=(stop, local, lock, limits), daemon=True)
               for _ in range(limits.clients)]
    for thread in clients:
        thread.start()
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        infra.append({"scenario": scenario, "timestamp": datetime.now(timezone.utc).isoformat(),
                      "docker_stats": docker_stats(), "dw_activity": database_activity(),
                      "worker_limits": container_limits(COMPOSE_WORKER_SERVICE),
                      "api_limits": container_limits(COMPOSE_API_SERVICE)})
        time.sleep(min(3, max(.1, deadline - time.monotonic())))
    stop.set()
    for thread in clients:
        thread.join(timeout=limits.request_timeout_seconds + 1)
    for item in local:
        item["scenario"] = scenario
    return local


def run_training_window(algorithm: str, limits: Limits, timeout: int,
                        records: list[dict[str, Any]], infra: list[dict[str, Any]]) -> dict[str, Any]:
    stop = threading.Event()
    lock = threading.Lock()
    local: list[dict[str, Any]] = []
    clients = [threading.Thread(target=worker_loop, args=(stop, local, lock, limits), daemon=True)
               for _ in range(limits.clients)]
    for thread in clients:
        thread.start()
    monitor_stop = threading.Event()

    def monitor() -> None:
        while not monitor_stop.is_set():
            infra.append({"scenario": f"training_{algorithm}",
                          "timestamp": datetime.now(timezone.utc).isoformat(),
                          "docker_stats": docker_stats(), "dw_activity": database_activity(),
                          "worker_limits": container_limits(COMPOSE_WORKER_SERVICE),
                          "api_limits": container_limits(COMPOSE_API_SERVICE)})
            monitor_stop.wait(3)

    monitor_thread = threading.Thread(target=monitor, daemon=True)
    monitor_thread.start()
    started = time.monotonic()
    jobs: list[dict[str, Any]] = []
    try:
        while len(jobs) < limits.max_training_jobs:
            job_id = submit_training(algorithm)
            jobs.append({"job_id": job_id, "submitted_at": datetime.now(timezone.utc).isoformat()})
            state = wait_job(job_id, timeout, limits.poll_interval_seconds)
            jobs[-1]["terminal_status"] = state
            jobs[-1]["finished_at"] = datetime.now(timezone.utc).isoformat()
            if state != "SUCCEEDED":
                raise RuntimeError(f"Synthetic {algorithm} training job ended with state {state}.")
            if time.monotonic() - started >= limits.duration_seconds:
                break
        if time.monotonic() - started < limits.duration_seconds:
            raise RuntimeError(
                f"Training-job cap reached before the {algorithm} load window elapsed; "
                "increase PREDICTION_LOAD_MAX_TRAINING_JOBS and rerun."
            )
        jobs[-1]["elapsed_seconds"] = round(time.monotonic() - started, 3)
    finally:
        stop.set()
        for thread in clients:
            thread.join(timeout=limits.request_timeout_seconds + 1)
        monitor_stop.set()
        monitor_thread.join(timeout=5)
    for item in local:
        item["scenario"] = f"training_{algorithm}"
    records.extend(local)
    return {"jobs": jobs, "elapsed_seconds": round(time.monotonic() - started, 3),
            "requests": summarize(local)}


def restart_count(service: str) -> tuple[str, int]:
    lookup = subprocess.run(compose_command("ps", "-q", service), capture_output=True,
                            text=True, check=False)
    container_ids = lookup.stdout.strip().splitlines()
    if not container_ids:
        raise RuntimeError(f"Compose service {service} is not running.")
    container_id = container_ids[0]
    inspect = subprocess.run(["docker", "inspect", "--format", "{{.RestartCount}}", container_id],
                             capture_output=True, text=True, check=False)
    if inspect.returncode:
        raise RuntimeError(f"Could not inspect Compose service {service}.")
    return container_id, int(inspect.stdout.strip())


def worker_crash_command(container_id: str) -> list[str]:
    """Kill PID 1 from inside the container so restart is treated as a crash."""
    return ["docker", "exec", "--user", "0", "--detach", container_id,
            "sh", "-c", "kill -9 1"]


def run_worker_crash_window(limits: Limits, records: list[dict[str, Any]],
                            infra: list[dict[str, Any]]) -> dict[str, Any]:
    """Kill and observe restart of an idle worker while read/scoring stays loaded."""
    container_id, before_restarts = restart_count(COMPOSE_WORKER_SERVICE)
    stop = threading.Event()
    lock = threading.Lock()
    local: list[dict[str, Any]] = []
    clients = [threading.Thread(target=worker_loop, args=(stop, local, lock, limits), daemon=True)
               for _ in range(limits.clients)]
    for thread in clients:
        thread.start()
    crash_at = time.monotonic() + max(1, limits.duration_seconds // 3)
    # Keep API/BFF traffic running while Docker has enough time to recover the
    # worker even when the configured request window is only a few seconds.
    deadline = time.monotonic() + max(limits.duration_seconds, 45)
    killed = False
    restarted = False
    try:
        while time.monotonic() < deadline:
            infra.append({"scenario": "worker_crash", "timestamp": datetime.now(timezone.utc).isoformat(),
                          "docker_stats": docker_stats(), "dw_activity": database_activity(),
                          "worker_limits": container_limits(COMPOSE_WORKER_SERVICE),
                          "api_limits": container_limits(COMPOSE_API_SERVICE)})
            if not killed and time.monotonic() >= crash_at:
                result = subprocess.run(worker_crash_command(container_id),
                                        capture_output=True, text=True, check=False)
                if result.returncode:
                    raise RuntimeError("Could not inject the requested worker crash.")
                killed = True
            if killed and not restarted:
                try:
                    inspect = subprocess.run(["docker", "inspect", "--format", "{{.State.Running}} {{.RestartCount}}",
                                              container_id], capture_output=True, text=True, check=False)
                    state = inspect.stdout.split()
                    restarted = len(state) == 2 and state[0].lower() == "true" and int(state[1]) > before_restarts
                except ValueError:
                    restarted = False
            time.sleep(min(3, max(.1, deadline - time.monotonic())))
    finally:
        stop.set()
        for thread in clients:
            thread.join(timeout=limits.request_timeout_seconds + 1)
        if killed:
            # Ensure the explicitly targeted development worker is brought back
            # even if Docker's restart policy did not recover it in time.
            subprocess.run(compose_command("start", COMPOSE_WORKER_SERVICE),
                           capture_output=True, text=True, check=False)
    for item in local:
        item["scenario"] = "worker_crash"
    records.extend(local)
    restart_error = None
    if not killed or not restarted:
        restart_error = "Worker crash/restart was not confirmed; check Compose restart policy and container logs."
    return {"worker_container_id": container_id, "restart_count_before": before_restarts,
            "restart_count_after": restart_count(COMPOSE_WORKER_SERVICE)[1], "restarted": restarted,
            "restart_error": restart_error, "requests": summarize(local)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("artifacts/pred008-load-report.json"))
    parser.add_argument("--enforce", action="store_true",
                        help="Evaluate explicitly supplied thresholds; otherwise report characterization only.")
    parser.add_argument("--max-p95-regression", type=float, default=None,
                        help="Maximum allowed concurrent-vs-baseline p95 multiplier (e.g. 1.5).")
    parser.add_argument("--max-error-rate", type=float, default=None,
                        help="Maximum allowed HTTP non-2xx/transport error rate [0,1].")
    parser.add_argument("--inject-worker-crash", action="store_true",
                        help="SIGKILL the idle prediction-worker after training scenarios; dev stack only.")
    args = parser.parse_args()
    if os.getenv("PREDICTION_ENV", "").lower() == "production":
        raise SystemExit("Refusing to run the PRED-008 load driver against PREDICTION_ENV=production.")
    if os.getenv("PRED008_CONFIRM_DEVELOPMENT", "") != "true":
        raise SystemExit("Set PRED008_CONFIRM_DEVELOPMENT=true to confirm this is a development/test stack.")
    if args.inject_worker_crash and os.getenv("PRED008_CONFIRM_WORKER_CRASH", "") != "true":
        raise SystemExit("Set PRED008_CONFIRM_WORKER_CRASH=true after confirming no other jobs use this worker.")
    if not (TOKEN or (BFF_URL and SESSION_COOKIE)):
        raise SystemExit("Set PREDICTION_LOAD_ACCESS_TOKEN or both PREDICTION_LOAD_BFF_URL and PREDICTION_LOAD_SESSION_COOKIE.")
    if not all((PROGRAM_REF, CUT_ID, SUBJECT_REF)):
        raise SystemExit("Set Faker subject/program/cut references in the PREDICTION_LOAD_* environment.")
    if args.enforce and (args.max_p95_regression is None or args.max_error_rate is None):
        raise SystemExit("--enforce requires --max-p95-regression and --max-error-rate agreed by the service owner.")
    if args.enforce and not all((DASHBOARD_URL, SESSION_COOKIE, BFF_URL, DW_DSN, args.inject_worker_crash)):
        raise SystemExit("--enforce requires dashboard session, BFF, read-only DW telemetry, and --inject-worker-crash.")
    if args.max_error_rate is not None and not 0 <= args.max_error_rate <= 1:
        raise SystemExit("--max-error-rate must be between 0 and 1.")

    limits = Limits(
        duration_seconds=int(os.getenv("PREDICTION_LOAD_DURATION_SECONDS", "30")),
        clients=int(os.getenv("PREDICTION_LOAD_CLIENTS", "2")),
        request_interval_seconds=float(os.getenv("PREDICTION_LOAD_INTERVAL_SECONDS", "1")),
        request_timeout_seconds=float(os.getenv("PREDICTION_LOAD_REQUEST_TIMEOUT_SECONDS", "10")),
        poll_interval_seconds=float(os.getenv("PREDICTION_LOAD_POLL_INTERVAL_SECONDS", "1")),
        max_training_jobs=int(os.getenv("PREDICTION_LOAD_MAX_TRAINING_JOBS", "25")),
    )
    if min(limits.duration_seconds, limits.clients, limits.max_training_jobs) < 1:
        raise SystemExit("Duration, client count and training-job cap must be positive.")
    if limits.clients > 16 or limits.max_training_jobs > 100:
        raise SystemExit("Safety cap exceeded (clients <= 16 and max jobs <= 100).")

    if not USE_BFF_SESSION:
        status, _, error, _ = request("GET", API_URL + "/", timeout=limits.request_timeout_seconds)
        if status != 200:
            raise SystemExit(f"Prediction API readiness check failed ({error or status}).")
    records: list[dict[str, Any]] = []
    infra: list[dict[str, Any]] = []
    training_scenarios: dict[str, Any] = {}
    for algorithm in ("random_forest", "xgboost"):
        baseline = run_load_window(f"baseline_{algorithm}", limits.duration_seconds, limits, infra)
        records.extend(baseline)
        contention = run_training_window(algorithm, limits, int(os.getenv("PREDICTION_LOAD_JOB_TIMEOUT_SECONDS", "1800")),
                                         records, infra)
        training_scenarios[algorithm] = contention
        print(f"Completed {algorithm} characterization: baseline requests={len(baseline)}, "
              f"training requests={sum(contention['requests'][key]['requests'] for key in contention['requests'])}, "
              f"jobs={len(contention['jobs'])}.")
    failure_scenario = None
    if args.inject_worker_crash:
        print("Injecting an idle prediction-worker crash under API/BFF/UI request load; no training job is active.")
        failure_scenario = run_worker_crash_window(limits, records, infra)

    report: dict[str, Any] = {
        "report_version": "pred008-load-v1", "generated_at": datetime.now(timezone.utc).isoformat(),
        "environment": os.getenv("PREDICTION_ENV", "unspecified"),
        "data_kind": "Faker DW for inference/publication; PRED-003 synthetic fixture for training",
        "model_evidence": "test_only; no institutional approval asserted",
        "thresholds": {"status": "AGREED" if args.enforce else "NOT_SET_CHARACTERIZATION_ONLY",
                       "max_p95_regression": args.max_p95_regression,
                       "max_error_rate": args.max_error_rate},
        "workload": {"clients": limits.clients, "interval_seconds_per_client": limits.request_interval_seconds,
                     "duration_seconds_per_scenario": limits.duration_seconds,
                     "endpoints": [name for name, _, _ in endpoints()],
                     "training_dataset_ref": DATASET_REF,
                     "compose_project": COMPOSE_PROJECT or None,
                     "compose_file": COMPOSE_FILE or None},
        "results": {}, "training_scenarios": training_scenarios,
        "failure_scenario": failure_scenario,
        "infrastructure_samples": infra,
        "raw_requests": records,
    }
    for name in ("random_forest", "xgboost"):
        base = [r for r in records if r["scenario"] == f"baseline_{name}"]
        active = [r for r in records if r["scenario"] == f"training_{name}"]
        report["results"][name] = {"baseline": summarize(base), "training_active": summarize(active),
                                   "training_jobs": training_scenarios[name]["jobs"]}
    if args.enforce:
        failures = []
        for algorithm, result in report["results"].items():
            for endpoint in (("bff_health" if USE_BFF_SESSION else "health"),
                             "inference", "publication", "bff_publication", "dashboard"):
                base = result["baseline"].get(endpoint, {})
                active = result["training_active"].get(endpoint, {})
                base_p95 = base.get("latency_ms", {}).get("p95")
                active_p95 = active.get("latency_ms", {}).get("p95")
                if not base_p95 or active_p95 is None or active_p95 / base_p95 > args.max_p95_regression:
                    failures.append(f"{algorithm}/{endpoint}: p95 regression threshold exceeded or unavailable")
                if active.get("error_rate", 1) > args.max_error_rate:
                    failures.append(f"{algorithm}/{endpoint}: error rate threshold exceeded")
        if failure_scenario:
            if not failure_scenario.get("restarted"):
                failures.append("worker_crash: isolated worker restart was not confirmed")
            baseline_models = report["results"]["random_forest"]["baseline"].get("inference", {}).get("model_versions_seen", [])
            crash_models = failure_scenario["requests"].get("inference", {}).get("model_versions_seen", [])
            if len(baseline_models) != 1 or crash_models != baseline_models:
                failures.append("worker_crash/inference: active model version was absent or changed during worker recovery")
            for endpoint, active in failure_scenario["requests"].items():
                baseline = report["results"]["random_forest"]["baseline"].get(endpoint, {})
                base_p95 = baseline.get("latency_ms", {}).get("p95")
                active_p95 = active.get("latency_ms", {}).get("p95")
                if not base_p95 or active_p95 is None or active_p95 / base_p95 > args.max_p95_regression:
                    failures.append(f"worker_crash/{endpoint}: p95 regression threshold exceeded or unavailable")
                if active.get("error_rate", 1) > args.max_error_rate:
                    failures.append(f"worker_crash/{endpoint}: error rate threshold exceeded")
        report["decision"] = "FAIL" if failures else "PASS"
        report["failures"] = failures
        expected_cpu_nanos = int(float(os.getenv("WORKER_CPU_LIMIT", "2")) * 1_000_000_000)
        expected_memory_bytes = int(os.getenv("WORKER_MEMORY_LIMIT_MB", "2048")) * 1024 * 1024
        observed_limits = [sample.get("worker_limits") for sample in infra if sample.get("worker_limits")]
        if not observed_limits or any(
            "error" in effective or effective["cpu_nano_cpus"] <= 0
            or effective["cpu_nano_cpus"] > expected_cpu_nanos
            or effective["memory_bytes"] <= 0 or effective["memory_bytes"] > expected_memory_bytes
            for effective in observed_limits
        ):
            failures.append("worker: effective Docker CPU/memory limits were absent or exceeded the configured cap")
            report["decision"] = "FAIL"
    else:
        report["decision"] = "CHARACTERIZATION_ONLY"

    report["execution_status"] = (
        "INCOMPLETE" if failure_scenario and not failure_scenario.get("restarted") else "COMPLETED"
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Report written to {args.output.resolve()}: {report['decision']} ({report['execution_status']}).")
    if report["decision"] == "FAIL" or report["execution_status"] == "INCOMPLETE":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
