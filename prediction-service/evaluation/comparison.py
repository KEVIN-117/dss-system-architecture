"""Create a traceable comparison of completed candidates trained on one partition.

Classification candidates are ranked by validation recall/F1 (or an error-cost
policy); regression candidates (PRED-103) by validation out-of-fold RMSE, then
MAE. The outer test is copied into the report and never ranks candidates.
"""

from __future__ import annotations

import json
import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _read(path: Path, name: str) -> dict[str, Any]:
    value = json.loads((path / name).read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{name} in {path} must contain a JSON object.")
    return value


def compare_artifacts(artifact_dirs: list[Path], output_path: Path | None = None) -> dict[str, Any]:
    """Compare two or more candidates trained on an identical holdout.

    Candidate ranking uses the configured validation-only policy. Test metrics are
    copied into the report and never influence selection or institutional status.
    """
    if len(artifact_dirs) < 2:
        raise ValueError("At least two completed model artifact directories are required.")
    entries = []
    for directory in artifact_dirs:
        path = Path(directory)
        manifest = _read(path, "manifest.json")
        metrics = _read(path, "metrics.json")
        config = _read(path, "training_config.json")
        dataset = _read(path, "dataset_ref.json")
        protocol = config.get("evaluation_protocol", {})
        tuning = config.get("tuning", {})
        entries.append({
            "path": path,
            "manifest": manifest,
            "metrics": metrics,
            "config": config,
            "dataset": dataset,
            "protocol": protocol,
            "validation": {
                "mean_recall": tuning.get("best_mean_recall"),
                "mean_f1": tuning.get("best_mean_f1"),
                "mean_rmse": tuning.get("best_mean_rmse"),
                "mean_mae": tuning.get("best_mean_mae"),
                "selection_metric": protocol.get("selection_metric"),
                "validation_cost": tuning.get("best_validation_cost"),
            },
        })
    model_keys = [(entry["manifest"].get("model_id"), entry["manifest"].get("version")) for entry in entries]
    if len(set(model_keys)) != len(model_keys):
        raise ValueError("Each compared artifact must be a different candidate.")
    kinds = {entry["manifest"].get("task_kind") or "classification" for entry in entries}
    if len(kinds) != 1:
        raise ValueError("Classification and regression candidates cannot be compared together.")
    regression = kinds == {"regression"}
    required_identity = ("partition_id", "dataset_digest", "target_definition_ref")
    identity = {
        key: entries[0]["protocol"].get(key)
        for key in required_identity
    }
    identity["decision_policy"] = entries[0]["protocol"].get("decision_policy")
    identity["classes"] = entries[0]["manifest"].get("classes")
    if any(not identity[key] for key in required_identity):
        raise ValueError("Artifacts are missing partition, dataset, or target identity metadata.")
    for entry in entries[1:]:
        other = {key: entry["protocol"].get(key) for key in required_identity}
        other["decision_policy"] = entry["protocol"].get("decision_policy")
        other["classes"] = entry["manifest"].get("classes")
        if other != identity:
            raise ValueError("Artifacts do not share the same dataset, target definition, and evaluation partition.")
    dataset_identity_fields = (
        "dataset_ref", "manifest_ref", "dataset_id", "dataset_digest", "snapshot_ref",
        "target_definition_ref", "population_definition_ref", "partition_id", "fixture_only", "exploratory_only",
        "source", "academic_cut",
    )
    dataset_identity = {key: entries[0]["dataset"].get(key) for key in dataset_identity_fields}
    if dataset_identity["dataset_digest"] != identity["dataset_digest"]:
        raise ValueError("Dataset reference digest does not match the evaluation identity.")
    if dataset_identity["target_definition_ref"] != identity["target_definition_ref"]:
        raise ValueError("Dataset target reference does not match the evaluation identity.")
    for entry in entries[1:]:
        if {key: entry["dataset"].get(key) for key in dataset_identity_fields} != dataset_identity:
            raise ValueError("Artifacts do not reference the same prepared dataset and population.")
    for entry in entries:
        if entry["config"].get("tuning", {}).get("outer_test_used_for_selection") is True:
            raise ValueError("An artifact indicates that the outer test influenced model selection.")
        required = ("mean_rmse", "mean_mae") if regression else ("mean_recall", "mean_f1")
        if any(entry["validation"][key] is None for key in required):
            raise ValueError("Artifacts must include validation metrics for candidate selection.")

    cost_policy = (not regression and identity["decision_policy"] is not None
                   and identity["decision_policy"].get("kind", "cost") == "cost")
    if regression:
        ranked = sorted(entries, key=lambda e: (e["validation"]["mean_rmse"], e["validation"]["mean_mae"]))
        best_key = (ranked[0]["validation"]["mean_rmse"], ranked[0]["validation"]["mean_mae"])
        selection_rule = (
            "Validation out-of-fold RMSE, then MAE. If both tie, no unique candidate is selected. "
            "Outer test does not participate."
        )
    elif not cost_policy:
        ranked = sorted(entries, key=lambda e: (-e["validation"]["mean_recall"], -e["validation"]["mean_f1"]))
        best_key = (-ranked[0]["validation"]["mean_recall"], -ranked[0]["validation"]["mean_f1"])
        selection_rule = (
            "Validation out-of-fold recall, then F1 at the validation-selected descriptive threshold. "
            "If both tie, no unique candidate is selected. Outer test does not participate."
        )
    else:
        if any(entry["validation"].get("validation_cost") is None for entry in entries):
            raise ValueError("Approved decision policy requires validation cost for each model candidate.")
        ranked = sorted(entries, key=lambda e: (e["validation"]["validation_cost"], -e["validation"]["mean_recall"], -e["validation"]["mean_f1"]))
        best_key = (ranked[0]["validation"]["validation_cost"], -ranked[0]["validation"]["mean_recall"], -ranked[0]["validation"]["mean_f1"])
        selection_rule = (
            "Approved validation cost, then validation out-of-fold recall and F1. "
            "If all tie, no unique candidate is selected. Outer test does not participate."
        )
    if regression:
        tied = [entry for entry in ranked if (entry["validation"]["mean_rmse"], entry["validation"]["mean_mae"]) == best_key]
    elif not cost_policy:
        tied = [entry for entry in ranked if (-entry["validation"]["mean_recall"], -entry["validation"]["mean_f1"]) == best_key]
    else:
        tied = [entry for entry in ranked if (entry["validation"]["validation_cost"], -entry["validation"]["mean_recall"], -entry["validation"]["mean_f1"]) == best_key]
    selected = tied[0] if len(tied) == 1 else None
    is_synthetic = all(e["dataset"].get("fixture_only") is True for e in entries)
    is_exploratory = not is_synthetic and all(e["dataset"].get("exploratory_only") is True for e in entries)
    evidence_kind = "synthetic_fixture" if is_synthetic else "exploratory_unapproved" if is_exploratory else "institutional_unverified"
    # PRED-105: no external DSA decision is required. A unique winner chosen on
    # validation, trained on real data, is deployable; synthetic evidence never is.
    deployable = selected is not None and not is_synthetic
    if is_synthetic:
        decision_status = "EVIDENCIA_INSUFICIENTE"
        decision_reason = ("La evidencia corresponde a un fixture sintético y solo valida el software; "
                           "no permite inferir utilidad institucional.")
    elif selected is None:
        decision_status = "EVIDENCIA_INSUFICIENTE"
        decision_reason = ("Los candidatos empatan en validación; no hay un único ganador. Revise las métricas "
                           "o entrene con otra configuración antes de activar.")
    else:
        decision_status = "APTO"
        decision_reason = ("Candidato elegido solo con métricas de validación sobre la misma partición; el test "
                           "externo no participó. La activación queda auditada (operador, fecha y motivo).")
    report = {
        "report_version": "pred004-comparison-v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "report_scope": "software_validation_only" if is_synthetic else "exploratory_analysis_only" if is_exploratory else "institutional_evaluation_incomplete",
        "evidence_kind": evidence_kind,
        "decision_status": decision_status,
        "decision_reason": decision_reason,
        "task_kind": "regression" if regression else "classification",
        "evaluation_identity": identity,
        "dataset": dataset_identity,
        "selection_rule": selection_rule,
        "candidate_selection_status": "SELECTED_BY_VALIDATION" if selected else "NO_UNIQUE_WINNER",
        "selected_candidate_by_validation": selected["manifest"].get("model_id") if selected else None,
        "top_candidates_by_validation": [entry["manifest"].get("model_id") for entry in tied],
        "crisp_dm_next_step": {
            "phase": "Deployment" if deployable else "Modeling",
            "reason": ("Activate the selected candidate for its event and cadence; monitor its metrics on new cuts."
                       if deployable else
                       "No candidate can be deployed from this comparison; synthetic evidence or a validation tie."),
            "deployment_allowed": deployable,
        },
        "models": [
            {
                "model_id": entry["manifest"].get("model_id"),
                "version": entry["manifest"].get("version"),
                "algorithm": entry["manifest"].get("algorithm"),
                "artifact_digest": entry["manifest"].get("artifact_digest"),
                "validation": entry["validation"],
                "test_metrics_final_only": entry["metrics"],
                "training_config": entry["config"],
            }
            for entry in sorted(entries, key=lambda e: (e["manifest"].get("algorithm", ""), e["manifest"].get("model_id", "")))
        ],
    }
    if output_path is not None:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(report, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare completed prediction model artifacts.")
    parser.add_argument("--output", required=True, type=Path, help="Path for the traceable comparison JSON report.")
    parser.add_argument("artifacts", nargs="+", type=Path, help="Two or more candidate artifact directories.")
    args = parser.parse_args()
    report = compare_artifacts(args.artifacts, args.output)
    print(json.dumps({"output": str(args.output), "decision_status": report["decision_status"], "selected_candidate": report["selected_candidate_by_validation"]}, indent=2))


if __name__ == "__main__":
    main()
