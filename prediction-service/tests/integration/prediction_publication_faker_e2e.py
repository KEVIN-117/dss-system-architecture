"""Exercise population scoring/publication against the local Faker DW.

The test creates an explicitly test-only active bundle and an isolated SQLite
publication store under a temporary directory. The DW connection is used only
by ``DwPredictionDataProvider`` read-only transactions. No shared model bundle
or DW state is changed.
"""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(SERVICE_ROOT))

from fastapi.testclient import TestClient

from inference import InferenceFailure, Principal
from inference_adapters import ConfiguredAcademicPolicy, DwPredictionDataProvider
from main import app
from training.model_registry import ModelRegistry
from training.population_publication import PopulationPublicationService
from training.prediction_publication_store import PredictionPublicationStore
from training.tasks import publish_population_task

from prediction_faker_e2e import _create_test_bundle, _sample


class IntegrationIdentity:
    def authenticate(self, token: str) -> Principal:
        if token == "faker-rector-token":
            return Principal("faker-rector", frozenset({"RECTOR"}), ())
        if token == "faker-out-of-scope-token":
            return Principal("faker-director", frozenset({"DIRECTOR"}), ())
        raise InferenceFailure("INVALID_TOKEN", 401, "The access token is invalid or expired.")


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def main() -> None:
    # The development Compose file currently provides the DW login through this
    # setting. It is never printed, and the provider enforces read-only mode.
    dw_url = os.getenv("PREDICTION_DW_DATABASE_URL", "").strip()
    if not dw_url:
        dw_url = os.getenv("PREDICTION_DATABASE_URL", "").strip()
    if not dw_url:
        raise SystemExit("Configure a development DW connection for this isolated smoke test.")
    os.environ["PREDICTION_DW_DATABASE_URL"] = dw_url
    os.environ["PREDICTION_ALLOWED_ROLES"] = '["RECTOR","DIRECTOR"]'
    os.environ["PREDICTION_BATCH_SUBMITTER_ROLES"] = '["RECTOR"]'

    _, program_ref, cut_id, _, cadence = _sample(dw_url)
    with tempfile.TemporaryDirectory(prefix="pred007-publication-faker-") as temporary:
        root = Path(temporary)
        artifacts = root / "artifacts"
        artifacts.mkdir()
        _create_test_bundle(artifacts, "program_dropout", cadence)

        sqlite_url = f"sqlite://{root / 'publication.sqlite'}"
        os.environ["PREDICTION_DATABASE_URL"] = sqlite_url
        os.environ["WORKER_ARTIFACTS_DIR"] = str(artifacts)

        store = PredictionPublicationStore(sqlite_url)
        service = PopulationPublicationService(
            store=store,
            identity=IntegrationIdentity(),
            data=DwPredictionDataProvider(dw_url),
            policy=ConfiguredAcademicPolicy(),
            registry=ModelRegistry(artifacts),
        )
        app.state.publication_service = service
        try:
            with TestClient(app) as client:
                path = f"/v1/prediction-publications?program_ref={program_ref}&cut_id={cut_id}"
                _assert(client.get(path).status_code == 401, "Unauthenticated current-publication read was not rejected.")
                _assert(client.get(path, headers={"Authorization": "Bearer faker-out-of-scope-token"}).status_code == 403,
                        "Out-of-scope current-publication read was not rejected.")
                _assert(client.get(path, headers={"Authorization": "Bearer faker-rector-token"}).json()["publication"] is None,
                        "An unpublished program/cut did not return an explicit empty state.")

                payload = {
                    "contract_version": "1.0",
                    "event_type": "program_dropout",
                    "program_ref": program_ref,
                    "academic_cut": {"cut_id": cut_id},
                }
                headers = {
                    "Authorization": "Bearer faker-rector-token",
                    "Idempotency-Key": "faker-publication-e2e-0001",
                }
                with __import__("unittest.mock", fromlist=["patch"]).patch("main._dispatch_pending_prediction_batches"):
                    accepted = client.post("/v1/prediction-batches", json=payload, headers=headers)
                _assert(accepted.status_code == 202, f"Batch submission failed: HTTP {accepted.status_code}.")
                batch_id = accepted.json()["batch_id"]
                _assert(accepted.json()["status"] == "QUEUED", "Submitted batch was not QUEUED.")
                _assert(client.get(path, headers={"Authorization": "Bearer faker-rector-token"}).json()["publication"] is None,
                        "A queued batch leaked as a partial publication.")

                # Invoke the real worker task synchronously, against the
                # temporary registry/store and real read-only Faker DW.
                task_result = publish_population_task.run(batch_id, str(artifacts))
                _assert(task_result.get("status") == "PUBLISHED", "Worker task did not publish the population batch.")
                publication_response = client.get(path, headers={"Authorization": "Bearer faker-rector-token"})
                _assert(publication_response.status_code == 200, "Authorized current-publication read failed.")
                publication = publication_response.json()["publication"]
                _assert(publication and publication["batch_id"] == batch_id, "Current publication does not match the completed batch.")
                _assert(publication["result_count"] > 0, "Published Faker population has no eligible result rows.")
                _assert(all(row["model_version"] == publication["model_version"] for row in publication["results"]),
                        "Published result page mixes model versions.")
                detail = client.get(f"/v1/prediction-batches/{batch_id}?limit=1000",
                                    headers={"Authorization": "Bearer faker-rector-token"})
                _assert(detail.status_code == 200, "Authorized batch-detail query failed.")
                _assert(detail.json()["result_count"] == publication["result_count"], "Batch detail count differs from the current publication.")
                _assert(client.get(f"/v1/prediction-batches/{batch_id}").status_code == 401,
                        "Unauthenticated batch-detail query was not rejected.")
                _assert(client.get(f"/v1/prediction-batches/{batch_id}",
                                   headers={"Authorization": "Bearer faker-out-of-scope-token"}).status_code == 403,
                        "Out-of-scope batch-detail query was not rejected.")

                # Recalculate the same cut with a distinct complete model
                # bundle. The old publication remains current until the full
                # second batch commits; history retains its original version.
                previous_version = publication["model_version"]
                _create_test_bundle(artifacts, "program_dropout", cadence, version="integration-v2")
                second_headers = {**headers, "Idempotency-Key": "faker-publication-e2e-0002"}
                with __import__("unittest.mock", fromlist=["patch"]).patch("main._dispatch_pending_prediction_batches"):
                    second_accepted = client.post("/v1/prediction-batches", json=payload, headers=second_headers)
                _assert(second_accepted.status_code == 202, "Second versioned batch submission failed.")
                second_batch_id = second_accepted.json()["batch_id"]
                _assert(second_accepted.json()["model_version"] == "integration-v2", "Recalculation did not pin the new model version.")
                during_recalculation = client.get(path, headers={"Authorization": "Bearer faker-rector-token"}).json()["publication"]
                _assert(during_recalculation["batch_id"] == batch_id,
                        "A queued recalculation replaced the last complete publication.")
                _assert(all(row["model_version"] == previous_version for row in during_recalculation["results"]),
                        "The previous publication mixed model versions during recalculation.")

                second_result = publish_population_task.run(second_batch_id, str(artifacts))
                _assert(second_result.get("status") == "PUBLISHED", "Second model version did not publish completely.")
                newest = client.get(path, headers={"Authorization": "Bearer faker-rector-token"}).json()["publication"]
                _assert(newest["batch_id"] == second_batch_id, "The complete recalculation did not become current.")
                _assert(all(row["model_version"] == "integration-v2" for row in newest["results"]),
                        "The recalculated publication mixes model versions.")
                historical = client.get(f"/v1/prediction-batches/{batch_id}?limit=1000",
                                        headers={"Authorization": "Bearer faker-rector-token"}).json()
                _assert(all(row["model_version"] == previous_version for row in historical["results"]),
                        "The prior batch history was overwritten with the recalculated version.")

                print("PASS: real worker scored and atomically published the eligible Faker DW population.")
                print("PASS: API current-publication and batch-detail endpoints returned the completed batch.")
                print("PASS: unauthenticated and out-of-scope reads were rejected; queued rows were not exposed.")
                print("PASS: queued recalculation kept the old complete batch current; completed v2 replaced it without mixing or overwriting history.")
                print(f"PASS: {newest['result_count']} eligible results use the v2 bundle; temporary bundles/store removed.")
        finally:
            if hasattr(app.state, "publication_service"):
                del app.state.publication_service


if __name__ == "__main__":
    main()
