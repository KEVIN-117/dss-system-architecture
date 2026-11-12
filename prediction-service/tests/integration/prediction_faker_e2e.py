"""Exercise both prediction events against the local Faker DW.

This integration check creates approved *test-only* bundles under a temporary
directory, injects a test identity, and reads features from the configured DW
in read-only transactions. It never touches the shared artifact volume or
prints student/program/course identifiers.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import psycopg
from fastapi.testclient import TestClient
from sklearn.dummy import DummyClassifier

SERVICE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(SERVICE_ROOT))

from feature_contract import contract_reference
from inference import PredictionService, Principal
from inference_adapters import ConfiguredAcademicPolicy, DwPredictionDataProvider
from main import app
from training.artifact_writer import write_training_artifacts
from training.model_registry import ModelRegistry
from training.trainer import get_dependency_versions


SAMPLE_SQL = """
WITH coursework AS (
    SELECT e.id_alumno, p.id_programa, m.id_materia, c.closure_id,
           c.gestion, c.periodo, c.effective_at, fc.run_id
    FROM dw.fact_cursado fc
    JOIN dw.dim_estudiante e ON e.estudiante_sk=fc.estudiante_sk AND e.member_type='STANDARD'
    JOIN dw.dim_programa p ON p.programa_sk=fc.programa_sk AND p.member_type='STANDARD' AND p.activo='A'
    JOIN dw.dim_materia m ON m.materia_sk=fc.materia_sk AND m.member_type='STANDARD'
    JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk=fc.periodo_academico_sk
    JOIN etl_control.academic_period_closure c ON c.closure_id=pa.closure_id
      AND c.status='PROCESADO' AND c.processed_at IS NOT NULL
    WHERE fc.es_abandono IS NOT NULL
      AND EXISTS (SELECT 1 FROM etl_control.etl_execution r WHERE r.run_id=fc.run_id AND r.status='EXITOSA')
), profiles AS (
    SELECT id_alumno,id_programa,
      count(DISTINCT CASE WHEN periodo=3 THEN 'ANUAL' WHEN periodo IN (1,2) THEN 'SEMESTRAL' END) AS cadence_count,
      min(CASE WHEN periodo=3 THEN 'ANUAL' WHEN periodo IN (1,2) THEN 'SEMESTRAL' END) AS cadence
    FROM coursework GROUP BY id_alumno,id_programa
), starts AS (
    SELECT DISTINCT ON (id_alumno,id_programa) id_alumno,id_programa,gestion,periodo
    FROM coursework
    ORDER BY id_alumno,id_programa,gestion,
      CASE periodo WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 1 ELSE 9 END,closure_id
)
SELECT e.id_alumno,p.id_programa,pa.closure_id::text,course.id_materia::text,
       CASE WHEN pa.periodo=3 THEN 'ANUAL' ELSE 'SEMESTRAL' END AS cadence
FROM dw.fact_retencion_desercion f
JOIN dw.dim_estudiante e ON e.estudiante_sk=f.estudiante_sk AND e.member_type='STANDARD'
JOIN dw.dim_programa p ON p.programa_sk=f.programa_sk AND p.member_type='STANDARD' AND p.activo='A'
JOIN dw.dim_periodo_academico pa ON pa.periodo_academico_sk=f.periodo_academico_sk
JOIN etl_control.academic_period_closure c ON c.closure_id=f.closure_id
  AND c.status='PROCESADO' AND c.processed_at IS NOT NULL
JOIN etl_control.etl_execution rr ON rr.run_id=f.run_id AND rr.status='EXITOSA'
JOIN profiles pr ON pr.id_alumno=e.id_alumno AND pr.id_programa=p.id_programa AND pr.cadence_count=1
JOIN starts st ON st.id_alumno=e.id_alumno AND st.id_programa=p.id_programa
JOIN LATERAL (
    SELECT m.id_materia
    FROM dw.fact_cursado fc
    JOIN dw.dim_materia m ON m.materia_sk=fc.materia_sk AND m.member_type='STANDARD'
    JOIN etl_control.etl_execution rc ON rc.run_id=fc.run_id AND rc.status='EXITOSA'
    WHERE fc.estudiante_sk=f.estudiante_sk AND fc.programa_sk=f.programa_sk
      AND fc.periodo_academico_sk=f.periodo_academico_sk AND fc.es_abandono IS NOT NULL
    ORDER BY m.id_materia LIMIT 1
) course ON TRUE
WHERE (pr.cadence='ANUAL' AND pa.periodo=3 AND (pa.gestion-st.gestion+1) BETWEEN 1 AND 3)
   OR (pr.cadence='SEMESTRAL' AND pa.periodo IN (1,2)
       AND ((pa.gestion-st.gestion)*2+pa.periodo-st.periodo+1) BETWEEN 1 AND 6)
ORDER BY c.effective_at DESC
LIMIT 1
"""


class IntegrationIdentity:
    def authenticate(self, token: str) -> Principal:
        if token != "faker-integration-token":
            from inference import InferenceFailure
            raise InferenceFailure("INVALID_TOKEN", 401, "The access token is invalid or expired.")
        return Principal("faker-integration-test", frozenset({"RECTOR"}), ())


def _sample(database_url: str) -> tuple[str, str, str, str, str]:
    with psycopg.connect(database_url, connect_timeout=5, options="-c default_transaction_read_only=on") as connection:
        row = connection.execute(SAMPLE_SQL).fetchone()
    if not row:
        raise RuntimeError("The Faker DW has no same-cut course/program sample in the first three years.")
    student, program, cut, course, cadence = row
    return str(student), str(program), str(cut), str(course), str(cadence)


def _create_test_bundle(root: Path, event_type: str, cadence: str, version: str = "integration-v1") -> str:
    if event_type == "course_abandonment":
        event_code = "COURSE_ABANDONMENT"
        evaluation_unit = "student_course_academic_period"
        feature_names = ["materia_ciclo", "materia_nivel", "prior_course_count", "prior_abandonment_count"]
        categorical = ["materia_ciclo", "materia_nivel"]
        fields = [
            {"name": "materia_ciclo", "logical_type": "category", "nullable": True, "available_at_cut": True},
            {"name": "materia_nivel", "logical_type": "category", "nullable": True, "available_at_cut": True},
            {"name": "prior_course_count", "logical_type": "integer", "nullable": False, "available_at_cut": True},
            {"name": "prior_abandonment_count", "logical_type": "integer", "nullable": False, "available_at_cut": True},
        ]
        x = pd.DataFrame([
            ["1", "1", 0, 0], ["2", "1", 1, 0], ["3", "2", 3, 1], ["4", "2", 5, 2],
        ], columns=feature_names)
    else:
        event_code = "PROGRAM_DROPOUT_NEXT_EXPECTED_CLOSURE"
        evaluation_unit = "student_program_academic_cut"
        feature_names = ["materias_cursadas", "materias_aprobadas", "materias_reprobadas"]
        categorical = []
        fields = [
            {"name": name, "logical_type": "integer", "nullable": True, "available_at_cut": True}
            for name in feature_names
        ]
        x = pd.DataFrame([[1, 0, 1], [2, 1, 1], [4, 3, 1], [6, 4, 2]], columns=feature_names)

    from preparation.pipeline import build_preprocessing_pipeline
    preprocessor = build_preprocessing_pipeline(feature_names, categorical)
    transformed = preprocessor.fit_transform(x)
    model = DummyClassifier(strategy="prior").fit(transformed, np.asarray([0, 1, 0, 1]))
    model_id = f"faker-e2e-{event_type}-{cadence.lower()}-{version}"
    manifest = {
        "contract_version": "1.0", "model_id": model_id, "version": version,
        "algorithm": "random_forest", "dataset_id": "faker-dw-e2e-integration",
        "input_schema_version": "prepared-dataset-v1",
        "classes": {"positive_class": "RISK", "negative_class": "NO_RISK", "event_code": event_code},
        "serving_scope": {"event_type": event_type, "cadence": cadence, "evaluation_unit": evaluation_unit},
        "created_at": "2026-11-03T00:00:00Z", "evaluation_ref": f"integration-{model_id}",
        "lifecycle_state": "CANDIDATE",
        # Serving refuses bundles not bound to the running point-in-time contract.
        "feature_contract": contract_reference(event_code, feature_names),
    }
    dataset_digest = f"integration-only-{event_type}-{cadence}"
    result = write_training_artifacts(
        job_id=model_id, artifacts_dir=root, model=model, preprocessing_pipeline=preprocessor,
        manifest=manifest, metrics={"purpose": "integration_only"},
        training_config={"evaluation_protocol": {"purpose": "faker_dw_e2e_integration_only"}},
        balance_report={"technique": None}, feature_names=feature_names,
        dependency_lock=get_dependency_versions(),
        dataset_ref={"dataset_ref": "faker-dw-e2e-integration", "dataset_digest": dataset_digest, "fixture_only": False},
        feature_schema=fields,
    )
    report_path = root / f"{model_id}-approval-test-only.json"
    report_path.write_text(json.dumps({
        "decision_status": "APTO", "crisp_dm_next_step": {"deployment_allowed": True},
        "evidence_kind": "integration_test",
        "dataset": {"fixture_only": False, "dataset_digest": dataset_digest},
        "evaluation_identity": {"classes": manifest["classes"]},
        "candidate_selection_status": "SELECTED_BY_VALIDATION", "selected_candidate_by_validation": model_id,
        "models": [{"model_id": model_id, "version": version, "artifact_digest": result["artifact_digest"]}],
    }), encoding="utf-8")
    registry = ModelRegistry(root)
    registry.promote(model_id, version, "faker-integration-test-only", report_path)
    return model_id


def main() -> None:
    database_url = os.getenv("PREDICTION_DW_DATABASE_URL", "").strip()
    if not database_url:
        raise SystemExit("Set PREDICTION_DW_DATABASE_URL to the local Faker DW connection string.")
    student, program, cut, course, cadence = _sample(database_url)
    with tempfile.TemporaryDirectory(prefix="pred006-faker-e2e-") as temporary:
        root = Path(temporary)
        expected = {
            ("course_abandonment", cadence): _create_test_bundle(root, "course_abandonment", cadence),
            ("program_dropout", cadence): _create_test_bundle(root, "program_dropout", cadence),
        }
        registry = ModelRegistry(root)
        data = DwPredictionDataProvider(database_url)
        os.environ["PREDICTION_ALLOWED_ROLES"] = '["RECTOR"]'
        service = PredictionService(registry, IntegrationIdentity(), data, ConfiguredAcademicPolicy())
        app.state.prediction_service = service
        try:
            with TestClient(app) as client:
                common = {
                    "contract_version": "1.0", "subject_ref": student,
                    "program_ref": program, "academic_cut": {"cut_id": cut},
                }
                headers = {"Authorization": "Bearer faker-integration-token"}
                course_response = client.post("/v1/predictions", json={
                    **common, "event_type": "course_abandonment", "course_ref": course,
                }, headers=headers)
                program_response = client.post("/v1/predictions", json={
                    **common, "event_type": "program_dropout",
                }, headers=headers)
                for event_type, response in (("course_abandonment", course_response), ("program_dropout", program_response)):
                    if response.status_code != 200:
                        raise RuntimeError(f"{event_type} inference returned HTTP {response.status_code}: {response.text}")
                    result = response.json()
                    if result["model"]["model_id"] != expected[(event_type, cadence)]:
                        raise RuntimeError(f"{event_type} resolved the wrong event/cadence bundle")
                    if not 0 <= result["event_probability"] <= 1:
                        raise RuntimeError(f"{event_type} returned an invalid event probability")
                print("PASS: course-abandonment and program-dropout inference returned 200 through /v1/predictions using the local Faker DW.")
                print("PASS: each event resolved its isolated integration bundle for the sample's cadence; bundles were deleted with the temporary workspace.")
        finally:
            if hasattr(app.state, "prediction_service"):
                del app.state.prediction_service


if __name__ == "__main__":
    main()
