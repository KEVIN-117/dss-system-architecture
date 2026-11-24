"""Trusted, filesystem-backed registry for immutable model bundles.

Only artifacts under the configured shared workspace can be resolved. Clients
never supply paths or serialized objects. The atomic active pointer pins a full
model + preprocessing bundle for each request.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import platform
import tempfile
import threading
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from importlib.metadata import PackageNotFoundError
from pathlib import Path
from typing import Any, Iterator

import joblib

from ml_tasks import CADENCES, UnknownTask, get_task, servable_event_codes
from training.artifact_writer import _compute_bundle_digest


class ModelRegistryError(RuntimeError):
    """Base error for registry operations."""


class NoActiveModel(ModelRegistryError):
    """No explicitly approved model is active."""


class InvalidModelArtifact(ModelRegistryError):
    """Artifact provenance, integrity, or compatibility check failed."""


@dataclass(frozen=True)
class LoadedModel:
    model_id: str
    version: str
    digest: str
    manifest: dict[str, Any]
    model: Any
    pipeline: Any


_thread_lock = threading.RLock()

# Activation performed by an ML administrator from the admin portal, without a
# PRED-004 report. Any candidate trained on real (non-synthetic) data is
# eligible -- no external DSA approval is required; the operator and reason are
# audited instead.
ADMIN_ACTIVATION = "ADMIN_ACTIVATION"
_NON_ACTIVATABLE_EVIDENCE = {"synthetic_fixture"}


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def candidate_evidence(folder: Path) -> dict[str, Any]:
    """Classify the data a candidate was trained on, from its own bundle files."""
    dataset = _read_json(folder / "dataset_ref.json") or {}
    report = _read_json(folder / "evaluation_report.json") or {}
    split = ((report.get("protocol") or {}).get("split") or {}) if isinstance(report, dict) else {}
    evidence_kind = split.get("evidence_kind")
    if dataset.get("fixture_only") is True:
        evidence_kind = "synthetic_fixture"
    elif dataset.get("exploratory_only") is True:
        evidence_kind = "exploratory_unapproved"
    target_ref = dataset.get("target_definition_ref")
    population_ref = dataset.get("population_definition_ref")
    reason = "Entrenado con datos sintéticos de prueba." if evidence_kind in _NON_ACTIVATABLE_EVIDENCE else None
    return {
        "evidence_kind": evidence_kind,
        "dataset_id": dataset.get("dataset_id"),
        "dataset_ref": dataset.get("dataset_ref"),
        "dataset_digest": dataset.get("dataset_digest"),
        "target_definition_ref": target_ref,
        "population_definition_ref": population_ref,
        "target_definition": dataset.get("target_definition"),
        "activatable": reason is None,
        "not_activatable_reason": reason,
    }


@contextmanager
def _registry_lock(path: Path) -> Iterator[None]:
    """Serialize registry writes across threads and processes on Windows/Linux."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with _thread_lock, path.open("a+b") as handle:
        if os.name == "nt":
            import msvcrt
            handle.seek(0)
            if handle.read(1) == b"":
                handle.write(b"0")
                handle.flush()
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_LOCK, 1)
            try:
                yield
            finally:
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _atomic_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(value, stream, indent=2, sort_keys=True)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


class ModelRegistry:
    def __init__(self, artifacts_dir: Path):
        self.root = artifacts_dir.resolve()
        self.state_dir = self.root / ".model-registry"
        self.active_path = self.state_dir / "active.json"
        self.lock_path = self.state_dir / "registry.lock"
        self._cache: dict[tuple[str, str, str], LoadedModel] = {}

    def _find(self, model_id: str, version: str) -> tuple[Path, dict[str, Any]]:
        for manifest_path in self.root.glob("*/manifest.json"):
            if manifest_path.is_symlink() or not manifest_path.resolve().is_relative_to(self.root):
                continue
            try:
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if isinstance(manifest, dict) and manifest.get("model_id") == model_id and manifest.get("version") == version:
                return manifest_path.parent, manifest
        raise InvalidModelArtifact("No trusted artifact matches the requested model_id/version.")

    def _validate(self, folder: Path, manifest: dict[str, Any], expected_digest: str | None = None) -> None:
        if not isinstance(manifest, dict) or manifest.get("contract_version") != "1.0":
            raise InvalidModelArtifact("Unsupported model manifest contract version.")
        if manifest.get("algorithm") not in {"random_forest", "xgboost"}:
            raise InvalidModelArtifact("Unsupported model algorithm.")
        classes = manifest.get("classes", {})
        if not isinstance(classes, dict) or not all(classes.get(key) for key in ("positive_class", "negative_class", "event_code")):
            raise InvalidModelArtifact("Model class order or event definition is incomplete.")
        scope = manifest.get("serving_scope")
        if scope is not None:
            try:
                expected_type = get_task(classes["event_code"]).serving_event_type
            except UnknownTask:
                expected_type = None
            if (not isinstance(scope, dict) or expected_type is None
                    or scope.get("event_type") != expected_type
                    or scope.get("cadence") not in CADENCES
                    or not isinstance(scope.get("evaluation_unit"), str)):
                raise InvalidModelArtifact("Model serving scope conflicts with its event or cadence.")
        schema = manifest.get("input_schema", {})
        features = schema.get("feature_names")
        if not isinstance(features, list) or not features or any(not isinstance(name, str) or not name for name in features) or len(features) != len(set(features)) or schema.get("additional_properties") is not False:
            raise InvalidModelArtifact("Model input schema is missing or invalid.")
        schema_fields = schema.get("fields")
        if (not isinstance(schema_fields, list) or len(schema_fields) != len(features)
                or any(not isinstance(field, dict) for field in schema_fields)
                or [field.get("name") for field in schema_fields] != features
                or any(field.get("logical_type") not in {"string", "integer", "number", "boolean", "date", "datetime", "category"} or not isinstance(field.get("nullable"), bool) for field in schema_fields)):
            raise InvalidModelArtifact("Typed input schema fields do not match the ordered feature list.")
        if "decision_threshold" in manifest:
            threshold = manifest["decision_threshold"]
            if (isinstance(threshold, bool) or not isinstance(threshold, (int, float))
                    or not math.isfinite(threshold) or not 0 <= threshold <= 1):
                raise InvalidModelArtifact("Model decision threshold must be a finite probability between 0 and 1.")
        files = manifest.get("artifact_files")
        required_files = {
            "model.joblib", "pipeline.joblib", "metrics.json", "evaluation_report.json",
            "training_config.json", "balance_report.json", "feature_names.json",
            "dependency_lock.json", "dataset_ref.json",
        }
        if not isinstance(files, dict) or set(files) != required_files:
            raise InvalidModelArtifact("Bundle file digest set is incomplete or contains unexpected files.")
        for name, expected in files.items():
            if not isinstance(name, str) or not isinstance(expected, str) or len(expected) != 64:
                raise InvalidModelArtifact("Bundle file digest entry is invalid.")
            path = folder / name
            if Path(name).name != name or path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(folder.resolve()):
                raise InvalidModelArtifact("Bundle references an unsafe or missing file.")
            if _sha256(path) != expected:
                raise InvalidModelArtifact(f"Bundle integrity check failed for {name}.")
        calculated = _compute_bundle_digest(manifest)
        if calculated != manifest.get("artifact_digest") or (expected_digest and calculated != expected_digest):
            raise InvalidModelArtifact("Bundle digest does not match the approved registry pointer.")
        try:
            feature_names = json.loads((folder / "feature_names.json").read_text(encoding="utf-8"))
            if feature_names != schema["feature_names"] or schema.get("required") != feature_names:
                raise InvalidModelArtifact("Manifest input schema does not match the bundled feature list.")
            if "decision_threshold" in manifest:
                metrics = json.loads((folder / "metrics.json").read_text(encoding="utf-8"))
                if isinstance(metrics, dict) and "decision_threshold" in metrics and metrics["decision_threshold"] != manifest["decision_threshold"]:
                    raise InvalidModelArtifact("Serving decision threshold differs from the evaluated threshold.")
            probability = manifest.get("probability_definition", {})
            if probability.get("positive_class") != classes["positive_class"] or probability.get("class_order") != [classes["negative_class"], classes["positive_class"]]:
                raise InvalidModelArtifact("Probability semantics or class ordering conflict with the manifest.")
            lock = json.loads((folder / "dependency_lock.json").read_text(encoding="utf-8"))
            running_python = platform.python_version()
            if ".".join(lock.get("python", "").split(".")[:2]) != ".".join(running_python.split(".")[:2]):
                raise InvalidModelArtifact("Python runtime is incompatible with this model bundle.")
            from importlib.metadata import version as package_version
            for key, package in (("scikit_learn", "scikit-learn"), ("xgboost", "xgboost"), ("joblib", "joblib")):
                expected = lock.get(key)
                if expected:
                    actual = package_version(package)
                    if actual != expected:
                        raise InvalidModelArtifact(f"Runtime dependency {package}={actual} differs from artifact lock {expected}.")
        except (OSError, json.JSONDecodeError, KeyError, PackageNotFoundError) as exc:
            raise InvalidModelArtifact("Dependency lock is missing or unreadable.") from exc

    def _validate_approval_record(self, pointer: dict[str, Any], manifest: dict[str, Any]) -> None:
        reference = pointer.get("approval_report_ref")
        if not reference or manifest.get("approval_evaluation_ref") != reference:
            raise InvalidModelArtifact("Approved evaluation report reference is missing or inconsistent.")
        report_path = (self.root / reference).resolve()
        if not report_path.is_relative_to(self.root) or report_path.is_symlink() or not report_path.is_file():
            raise InvalidModelArtifact("Approved evaluation report is outside the trusted registry or missing.")
        if _sha256(report_path) != pointer.get("approval_report_digest"):
            raise InvalidModelArtifact("Approved evaluation report integrity check failed.")
        try:
            report = json.loads(report_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise InvalidModelArtifact("Approved evaluation report cannot be read.") from exc
        if pointer.get("activation_kind") == ADMIN_ACTIVATION:
            # Activated by an ML administrator from the admin portal: the record
            # pins the exact bundle and keeps the data-approval guard.
            if (report.get("kind") != ADMIN_ACTIVATION
                    or report.get("model_id") != pointer.get("model_id")
                    or report.get("version") != pointer.get("version")
                    or report.get("artifact_digest") != pointer.get("artifact_digest")
                    or report.get("evidence_kind") in _NON_ACTIVATABLE_EVIDENCE):
                raise InvalidModelArtifact("Administrative activation record no longer authorizes this model.")
            return
        exact_candidate = any(
            item.get("model_id") == pointer.get("model_id")
            and item.get("version") == pointer.get("version")
            and item.get("artifact_digest") == pointer.get("artifact_digest")
            for item in report.get("models", [])
        )
        if (report.get("decision_status") != "APTO"
                or report.get("crisp_dm_next_step", {}).get("deployment_allowed") is not True
                or report.get("evidence_kind") in _NON_ACTIVATABLE_EVIDENCE
                or not exact_candidate):
            raise InvalidModelArtifact("Approved evaluation evidence no longer authorizes this model.")

    def _load(self, model_id: str, version: str, digest: str, require_approved: bool,
              manifest_digest: str | None = None, approval_pointer: dict[str, Any] | None = None) -> LoadedModel:
        folder, manifest = self._find(model_id, version)
        if manifest_digest and _sha256(folder / "manifest.json") != manifest_digest:
            raise InvalidModelArtifact("Approved manifest changed after activation.")
        if require_approved and manifest.get("lifecycle_state") != "APPROVED":
            raise InvalidModelArtifact("Only explicitly approved models can be served.")
        if require_approved:
            if approval_pointer is None:
                raise InvalidModelArtifact("Approval pointer is required to load an approved model.")
            self._validate_approval_record(approval_pointer, manifest)
        key = (model_id, version, digest)
        cached = self._cache.get(key)
        if cached:
            return cached
        self._validate(folder, manifest, digest)
        # Deserialize only after provenance (trusted path), compatibility and
        # every payload digest pass. The pair becomes visible as one object.
        try:
            loaded = LoadedModel(
                model_id, version, digest, manifest,
                joblib.load(folder / "model.joblib"),
                joblib.load(folder / "pipeline.joblib"),
            )
        except Exception as exc:
            raise InvalidModelArtifact("Serialized model or preprocessing pipeline could not be loaded.") from exc
        self._cache[key] = loaded
        return loaded

    @staticmethod
    def _scope_key(event_code: str, cadence: str) -> str:
        if event_code not in servable_event_codes() or cadence not in CADENCES:
            raise NoActiveModel("No approved model exists for the requested event/cadence scope.")
        return f"{event_code}|{cadence}"

    def active(self, event_code: str | None = None, cadence: str | None = None) -> LoadedModel:
        try:
            state = json.loads(self.active_path.read_text(encoding="utf-8"))
        except FileNotFoundError as exc:
            raise NoActiveModel("No approved model is active.") from exc
        except json.JSONDecodeError as exc:
            raise InvalidModelArtifact("Active model registry state is invalid JSON.") from exc
        if not isinstance(state, dict):
            raise InvalidModelArtifact("Active model registry state is malformed.")
        if event_code is not None or cadence is not None:
            if not event_code or not cadence:
                raise NoActiveModel("Both event and cadence are required to resolve a scoped model.")
            active_by_scope = state.get("active_by_scope", {})
            if not isinstance(active_by_scope, dict):
                raise InvalidModelArtifact("Scoped active model registry state is malformed.")
            pointer = active_by_scope.get(self._scope_key(event_code, cadence))
            if not pointer:
                raise NoActiveModel("No approved model is active for the requested event and cadence.")
        else:
            pointer = state.get("active", state)
        if not pointer:
            raise NoActiveModel("No approved model is active.")
        try:
            loaded = self._load(pointer["model_id"], pointer["version"], pointer["artifact_digest"], True, pointer.get("manifest_digest"), pointer)
            if event_code is not None:
                scope = loaded.manifest.get("serving_scope", {})
                if loaded.manifest.get("classes", {}).get("event_code") != event_code or scope.get("cadence") != cadence:
                    raise InvalidModelArtifact("Active scoped pointer does not match the requested event/cadence.")
            return loaded
        except (KeyError, TypeError) as exc:
            raise InvalidModelArtifact("Active model pointer is malformed.") from exc

    def promote(self, model_id: str, version: str, approved_by: str, evaluation_path: Path) -> dict[str, Any]:
        if not approved_by.strip():
            raise ValueError("An operator identity is required for promotion.")
        folder, manifest = self._find(model_id, version)
        if manifest.get("lifecycle_state") not in {"CANDIDATE", "APPROVED"}:
            raise InvalidModelArtifact("Only a candidate can be explicitly promoted.")
        self._validate(folder, manifest)
        # Prove that both serialized objects can be loaded before any state is
        # changed. A broken candidate cannot interrupt the current deployment.
        self._load(model_id, version, manifest["artifact_digest"], False)
        try:
            report = json.loads(evaluation_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise InvalidModelArtifact("Evaluation approval report is missing or invalid.") from exc
        if report.get("decision_status") != "APTO" or report.get("crisp_dm_next_step", {}).get("deployment_allowed") is not True:
            raise InvalidModelArtifact("Evaluation evidence does not authorize deployment.")
        if report.get("evidence_kind") == "synthetic_fixture" or report.get("dataset", {}).get("fixture_only") is True:
            raise InvalidModelArtifact("Synthetic evidence cannot approve institutional deployment.")
        matched = any(item.get("model_id") == model_id and item.get("version") == version and item.get("artifact_digest") == manifest["artifact_digest"] for item in report.get("models", []))
        if not matched:
            raise InvalidModelArtifact("Approval report does not identify this exact candidate digest.")
        if report.get("candidate_selection_status") != "SELECTED_BY_VALIDATION" or report.get("selected_candidate_by_validation") != model_id:
            raise InvalidModelArtifact("Evaluation report does not select this candidate under the approved validation rule.")
        dataset_ref = json.loads((folder / "dataset_ref.json").read_text(encoding="utf-8"))
        if report.get("dataset", {}).get("dataset_digest") != dataset_ref.get("dataset_digest"):
            raise InvalidModelArtifact("Approval report dataset digest does not match this artifact.")
        if report.get("evaluation_identity", {}).get("classes") != manifest.get("classes"):
            raise InvalidModelArtifact("Approval report class/event definition does not match this artifact.")
        report_key = hashlib.sha256(f"{model_id}|{version}|{manifest['artifact_digest']}".encode("utf-8")).hexdigest()
        approval_report_path = self.state_dir / "approvals" / f"{report_key}.json"
        with _registry_lock(self.lock_path):
            approval_report_path.parent.mkdir(parents=True, exist_ok=True)
            _atomic_json(approval_report_path, report)
            approval_report_digest = _sha256(approval_report_path)
            now = datetime.now(timezone.utc).isoformat()
            state = {"active": None, "events": []}
            if self.active_path.exists():
                state = json.loads(self.active_path.read_text(encoding="utf-8"))
                if "active" not in state:  # tolerate the earlier pointer-only format
                    state = {"active": state, "events": []}
            previous = state.get("active")
            manifest["lifecycle_state"] = "APPROVED"
            manifest["approved_at"] = now
            manifest["approved_by"] = approved_by
            manifest["approval_evaluation_ref"] = str(approval_report_path.relative_to(self.root).as_posix())
            _atomic_json(folder / "manifest.json", manifest)
            scope = manifest.get("serving_scope", {})
            event_code = manifest.get("classes", {}).get("event_code")
            cadence = scope.get("cadence")
            scoped = bool(event_code and cadence)
            scope_key = self._scope_key(event_code, cadence) if scoped else None
            active_by_scope = dict(state.get("active_by_scope", {}))
            previous_scope = active_by_scope.get(scope_key) if scope_key else None
            pointer = {"model_id": model_id, "version": version, "artifact_digest": manifest["artifact_digest"], "manifest_digest": _sha256(folder / "manifest.json"), "approval_report_ref": str(approval_report_path.relative_to(self.root).as_posix()), "approval_report_digest": approval_report_digest, "activated_at": now, "approved_by": approved_by}
            if scoped:
                active_by_scope[scope_key] = pointer
            history = state.get("events", [])
            history.append({"action": "PROMOTE", "scope_key": scope_key, "previous": previous_scope if scoped else previous, "active": pointer, "evaluation_ref": pointer["approval_report_ref"], "evaluation_digest": approval_report_digest})
            _atomic_json(self.active_path, {"active": pointer, "active_by_scope": active_by_scope, "events": history})
        return pointer

    def rollback(self, approved_by: str, event_code: str | None = None, cadence: str | None = None) -> dict[str, Any]:
        if not approved_by.strip():
            raise ValueError("An operator identity is required for rollback.")
        with _registry_lock(self.lock_path):
            state = json.loads(self.active_path.read_text(encoding="utf-8"))
            state = state if "active" in state else {"active": state, "events": []}
            history = state.get("events", [])
            scoped = event_code is not None or cadence is not None
            if scoped and (not event_code or not cadence):
                raise ValueError("Scoped rollback requires both event_code and cadence.")
            scope_key = self._scope_key(event_code, cadence) if scoped else None
            previous = next((event.get("previous") for event in reversed(history)
                             if event.get("action") in {"PROMOTE", "ROLLBACK"}
                             and event.get("scope_key") == scope_key and event.get("previous")), None)
            if not previous:
                raise NoActiveModel("No previous approved version is available for rollback.")
            self._load(previous["model_id"], previous["version"], previous["artifact_digest"], True, previous.get("manifest_digest"), previous)
            current = state.get("active_by_scope", {}).get(scope_key) if scoped else state.get("active")
            pointer = {**previous, "activated_at": datetime.now(timezone.utc).isoformat(), "approved_by": approved_by}
            history.append({"action": "ROLLBACK", "scope_key": scope_key, "previous": current, "active": pointer, "approved_by": approved_by})
            active_by_scope = dict(state.get("active_by_scope", {}))
            if scoped:
                active_by_scope[scope_key] = pointer
            _atomic_json(self.active_path, {"active": pointer, "active_by_scope": active_by_scope, "events": history})
            return pointer

    # ------------------------------------------------------------------
    # Admin portal: inspect candidates, activate and deactivate per scope.

    def _read_state(self) -> dict[str, Any]:
        if not self.active_path.exists():
            return {"active": None, "active_by_scope": {}, "events": []}
        state = json.loads(self.active_path.read_text(encoding="utf-8"))
        if not isinstance(state, dict):
            raise InvalidModelArtifact("Active model registry state is malformed.")
        if "active" not in state:  # tolerate the earlier pointer-only format
            state = {"active": state, "events": []}
        state.setdefault("active_by_scope", {})
        state.setdefault("events", [])
        return state

    def registry_state(self) -> dict[str, Any]:
        """Active pointer per event/cadence scope and the audited event history."""
        state = self._read_state()
        return {"active_by_scope": state.get("active_by_scope") or {}, "events": list(state.get("events") or [])}

    def list_models(self) -> list[dict[str, Any]]:
        """Summaries of every trusted candidate bundle, newest first.

        Reads only the bundle's own JSON files; full integrity is verified on
        activation and on every load.
        """
        active_by_scope = self.registry_state()["active_by_scope"]
        active_keys = {(p.get("model_id"), p.get("version")): key for key, p in active_by_scope.items() if isinstance(p, dict)}
        models = []
        for manifest_path in self.root.glob("*/manifest.json"):
            if manifest_path.is_symlink() or not manifest_path.resolve().is_relative_to(self.root):
                continue
            folder = manifest_path.parent
            manifest = _read_json(manifest_path)
            if not isinstance(manifest, dict) or not manifest.get("model_id") or not manifest.get("version"):
                continue
            metrics = _read_json(folder / "metrics.json") or {}
            config = _read_json(folder / "training_config.json") or {}
            tuning = config.get("tuning") or {}
            classes = manifest.get("classes") or {}
            scope = manifest.get("serving_scope") or {}
            scope_key = (f"{classes.get('event_code')}|{scope.get('cadence')}"
                         if classes.get("event_code") and scope.get("cadence") else None)
            evidence = candidate_evidence(folder)
            per_class = metrics.get("per_class") or {}
            positive = per_class.get("1") or {}
            models.append({
                "model_id": manifest["model_id"],
                "version": manifest["version"],
                "algorithm": manifest.get("algorithm"),
                "created_at": manifest.get("created_at"),
                "lifecycle_state": manifest.get("lifecycle_state"),
                "event_code": classes.get("event_code"),
                "cadence": scope.get("cadence"),
                "scope_key": scope_key,
                "is_active": active_keys.get((manifest["model_id"], manifest["version"])) == scope_key and scope_key is not None,
                "decision_threshold": metrics.get("decision_threshold", manifest.get("decision_threshold")),
                "dataset": {k: evidence[k] for k in ("dataset_id", "dataset_ref", "evidence_kind", "target_definition_ref",
                                                     "population_definition_ref", "target_definition")},
                "activatable": evidence["activatable"] and scope_key is not None,
                "not_activatable_reason": evidence["not_activatable_reason"]
                if scope_key is not None else "El candidato no declara tipo de evento y cadencia.",
                "test_metrics": {
                    "recall": metrics.get("recall"),
                    "precision": metrics.get("precision"),
                    "f1_score": metrics.get("f1_score"),
                    "accuracy": metrics.get("accuracy"),
                    "roc_auc": metrics.get("roc_auc"),
                    "pr_auc": metrics.get("pr_auc"),
                    "alert_rate": metrics.get("holdout_alert_rate"),
                    "macro_f1": (metrics.get("macro_average") or {}).get("f1_score"),
                    "test_row_count": metrics.get("test_row_count"),
                    "positive_support": positive.get("support"),
                    "threshold_origin": metrics.get("threshold_origin"),
                },
                "per_class": [
                    {"class_name": item.get("class_name"), "precision": item.get("precision"), "recall": item.get("recall"),
                     "f1_score": item.get("f1_score"), "support": item.get("support")}
                    for _, item in sorted(per_class.items())
                ],
                "confusion_matrix": metrics.get("confusion_matrix"),
                "validation": {
                    "mean_recall": tuning.get("best_mean_recall"),
                    "mean_f1": tuning.get("best_mean_f1"),
                    "method": tuning.get("method"),
                    "n_splits": tuning.get("n_splits"),
                    "candidate_count": tuning.get("candidate_count"),
                },
                "hyperparameters": config.get("hyperparameters"),
            })
        models.sort(key=lambda item: item.get("created_at") or "", reverse=True)
        return models

    def activate(self, model_id: str, version: str, activated_by: str, reason: str) -> dict[str, Any]:
        """Activate a candidate for its event/cadence scope from the admin portal."""
        if not activated_by.strip():
            raise ValueError("An operator identity is required for activation.")
        if not reason.strip():
            raise ValueError("An activation reason is required.")
        folder, manifest = self._find(model_id, version)
        if manifest.get("lifecycle_state") not in {"CANDIDATE", "APPROVED"}:
            raise InvalidModelArtifact("Only a candidate can be activated.")
        evidence = candidate_evidence(folder)
        if not evidence["activatable"]:
            raise InvalidModelArtifact(evidence["not_activatable_reason"])
        event_code = (manifest.get("classes") or {}).get("event_code")
        cadence = (manifest.get("serving_scope") or {}).get("cadence")
        if not event_code or not cadence:
            raise InvalidModelArtifact("El candidato no declara tipo de evento y cadencia.")
        scope_key = self._scope_key(event_code, cadence)
        self._validate(folder, manifest)
        # Both serialized objects must load before any state changes.
        self._load(model_id, version, manifest["artifact_digest"], False)
        metrics = _read_json(folder / "metrics.json") or {}
        now = datetime.now(timezone.utc).isoformat()
        record = {
            "kind": ADMIN_ACTIVATION,
            "model_id": model_id,
            "version": version,
            "artifact_digest": manifest["artifact_digest"],
            "algorithm": manifest.get("algorithm"),
            "scope_key": scope_key,
            "evidence_kind": evidence["evidence_kind"],
            "dataset_digest": evidence["dataset_digest"],
            "target_definition_ref": evidence["target_definition_ref"],
            "population_definition_ref": evidence["population_definition_ref"],
            "test_metrics": {key: metrics.get(key) for key in ("recall", "precision", "f1_score", "roc_auc", "pr_auc", "holdout_alert_rate")},
            "activated_by": activated_by,
            "reason": reason.strip(),
            "activated_at": now,
        }
        record_key = hashlib.sha256(f"{model_id}|{version}|{manifest['artifact_digest']}|{now}".encode("utf-8")).hexdigest()
        record_path = self.state_dir / "approvals" / f"admin-{record_key}.json"
        with _registry_lock(self.lock_path):
            _atomic_json(record_path, record)
            record_ref = str(record_path.relative_to(self.root).as_posix())
            state = self._read_state()
            manifest["lifecycle_state"] = "APPROVED"
            manifest["approved_at"] = now
            manifest["approved_by"] = activated_by
            manifest["approval_evaluation_ref"] = record_ref
            _atomic_json(folder / "manifest.json", manifest)
            pointer = {
                "model_id": model_id, "version": version, "artifact_digest": manifest["artifact_digest"],
                "manifest_digest": _sha256(folder / "manifest.json"), "approval_report_ref": record_ref,
                "approval_report_digest": _sha256(record_path), "activation_kind": ADMIN_ACTIVATION,
                "activated_at": now, "approved_by": activated_by,
            }
            active_by_scope = dict(state.get("active_by_scope") or {})
            previous = active_by_scope.get(scope_key)
            active_by_scope[scope_key] = pointer
            history = list(state.get("events") or [])
            history.append({"action": "ACTIVATE", "scope_key": scope_key, "previous": previous, "active": pointer,
                            "approved_by": activated_by, "reason": reason.strip(), "at": now})
            _atomic_json(self.active_path, {"active": pointer, "active_by_scope": active_by_scope, "events": history})
        return pointer

    def deactivate(self, event_code: str, cadence: str, deactivated_by: str, reason: str) -> dict[str, Any]:
        """Leave a scope without an active model; serving then answers 'no active model'."""
        if not deactivated_by.strip():
            raise ValueError("An operator identity is required for deactivation.")
        if not reason.strip():
            raise ValueError("A deactivation reason is required.")
        scope_key = self._scope_key(event_code, cadence)
        now = datetime.now(timezone.utc).isoformat()
        with _registry_lock(self.lock_path):
            state = self._read_state()
            active_by_scope = dict(state.get("active_by_scope") or {})
            current = active_by_scope.pop(scope_key, None)
            if not current:
                raise NoActiveModel("No active model exists for the requested event and cadence.")
            legacy = state.get("active")
            if isinstance(legacy, dict) and (legacy.get("model_id"), legacy.get("version")) == (current.get("model_id"), current.get("version")):
                legacy = None
            history = list(state.get("events") or [])
            event = {"action": "DEACTIVATE", "scope_key": scope_key, "previous": current, "active": None,
                     "approved_by": deactivated_by, "reason": reason.strip(), "at": now}
            history.append(event)
            _atomic_json(self.active_path, {"active": legacy, "active_by_scope": active_by_scope, "events": history})
        return event


def main() -> None:
    """Operator-only CLI; promotion is deliberately not exposed to clients."""
    import argparse

    parser = argparse.ArgumentParser(description="Inspect, promote, or roll back an approved model bundle.")
    parser.add_argument("action", choices=("show", "promote", "rollback"))
    parser.add_argument("--artifacts-dir", type=Path, default=Path(os.getenv("WORKER_ARTIFACTS_DIR", "/app/artifacts")))
    parser.add_argument("--model-id")
    parser.add_argument("--version")
    parser.add_argument("--approved-by")
    parser.add_argument("--evaluation-report", type=Path)
    parser.add_argument("--event-code", choices=sorted(servable_event_codes()))
    parser.add_argument("--cadence", choices=CADENCES)
    args = parser.parse_args()
    registry = ModelRegistry(args.artifacts_dir)
    if args.action == "show":
        print(args.artifacts_dir.joinpath(".model-registry", "active.json").read_text(encoding="utf-8"))
    elif args.action == "promote":
        if not (args.model_id and args.version and args.approved_by and args.evaluation_report):
            parser.error("promote requires --model-id, --version, --approved-by, and --evaluation-report")
        print(json.dumps(registry.promote(args.model_id, args.version, args.approved_by, args.evaluation_report), indent=2))
    else:
        if not args.approved_by:
            parser.error("rollback requires --approved-by")
        print(json.dumps(registry.rollback(args.approved_by, args.event_code, args.cadence), indent=2))


if __name__ == "__main__":
    main()
