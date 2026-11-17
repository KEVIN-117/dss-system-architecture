"""Tests for custom dataset uploading and listing."""

from __future__ import annotations

import io
import json
import os
import shutil
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from inference import InferenceFailure, Principal
from main import app


class FakeIdentity:
    PRINCIPALS = {
        "operator-token": Principal("operator-1", frozenset({"SUPERADMIN"}), ()),
        "director-token": Principal("director-1", frozenset({"DIRECTOR"}), ()),
    }

    def authenticate(self, access_token: str) -> Principal:
        if access_token not in self.PRINCIPALS:
            raise InferenceFailure("INVALID_TOKEN", 401, "The access token is invalid or expired.")
        return self.PRINCIPALS[access_token]


class TestDatasetUploadAPI(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_root = tempfile.mkdtemp(prefix="test_dataset_root_")
        self.env_patcher = patch.dict(os.environ, {"PREDICTION_DATASET_ROOT": self.temp_root})
        self.env_patcher.start()
        os.environ.pop("PREDICTION_CUSTOM_DATASET_ROOT", None)
        app.state.identity_provider = FakeIdentity()
        self.client = TestClient(app)
        self.operator = TestClient(app, headers={"Authorization": "Bearer operator-token"})

        # Cargar datos base de fixture pred003
        fixtures_dir = Path(__file__).parent / "fixtures" / "pred003_synthetic"
        self.valid_manifest = json.loads((fixtures_dir / "manifest.json").read_text(encoding="utf-8"))
        self.valid_rows_text = (fixtures_dir / "rows.jsonl").read_text(encoding="utf-8")

    def tearDown(self) -> None:
        del app.state.identity_provider
        self.env_patcher.stop()
        shutil.rmtree(self.temp_root, ignore_errors=True)

    def _create_zip(self, manifest: dict, rows_text: str, manifest_name="manifest.json", rows_name="rows.jsonl") -> bytes:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr(manifest_name, json.dumps(manifest))
            z.writestr(rows_name, rows_text)
        return buf.getvalue()

    def _upload(self, content: bytes, name: str = "dataset.zip", client: TestClient | None = None):
        return (client or self.operator).post(
            "/v1/datasets/upload", files={"file": (name, content, "application/zip")},
        )

    def test_list_datasets_includes_pred003_fixture(self) -> None:
        resp = self.operator.get("/v1/datasets")
        self.assertEqual(resp.status_code, 200)
        datasets = resp.json()
        self.assertGreaterEqual(len(datasets), 1)
        fixture_item = next((d for d in datasets if d["dataset_ref"] == "fixture:pred003_synthetic-v1"), None)
        self.assertIsNotNone(fixture_item)
        self.assertEqual(fixture_item["is_custom"], False)

    def test_dataset_endpoints_require_ml_operator(self) -> None:
        zip_bytes = self._create_zip(self.valid_manifest, self.valid_rows_text)
        self.assertEqual(self.client.get("/v1/datasets").status_code, 401)
        self.assertEqual(self._upload(zip_bytes, client=self.client).status_code, 401)
        director = TestClient(app, headers={"Authorization": "Bearer director-token"})
        forbidden = self._upload(zip_bytes, client=director)
        self.assertEqual(forbidden.status_code, 403)
        self.assertEqual(forbidden.json()["code"], "INSUFFICIENT_SCOPE")
        self.assertFalse((Path(self.temp_root) / "custom").exists())

    def test_upload_valid_dataset_zip_succeeds(self) -> None:
        resp = self._upload(self._create_zip(self.valid_manifest, self.valid_rows_text))
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertIn("custom:", data["dataset_ref"])
        self.assertEqual(data["row_count"], 40)
        self.assertEqual(data["content_digest"], self.valid_manifest["content_digest"])

        # Verificar que ahora figure en el listado
        list_resp = self.operator.get("/v1/datasets")
        self.assertEqual(list_resp.status_code, 200)
        refs = [d["dataset_ref"] for d in list_resp.json()]
        self.assertIn(data["dataset_ref"], refs)

        provenance = json.loads((Path(self.temp_root) / "custom" / data["dataset_id"] / "upload.json").read_text(encoding="utf-8"))
        self.assertEqual(provenance["uploaded_by"], "operator-1")
        self.assertEqual(len(provenance["upload_sha256"]), 64)

    def test_uploaded_dataset_is_immutable(self) -> None:
        first = self._upload(self._create_zip(self.valid_manifest, self.valid_rows_text))
        self.assertEqual(first.status_code, 201)
        rows_path = Path(self.temp_root) / "custom" / first.json()["dataset_id"] / "rows.jsonl"
        original = rows_path.read_bytes()

        second = self._upload(self._create_zip(self.valid_manifest, self.valid_rows_text))
        self.assertEqual(second.status_code, 409)
        self.assertEqual(second.json()["code"], "DATASET_ALREADY_EXISTS")
        self.assertEqual(rows_path.read_bytes(), original)

    def test_uploaded_dataset_resolves_from_shared_store_for_worker(self) -> None:
        shared = Path(self.temp_root) / "shared-store"
        with patch.dict(os.environ, {"PREDICTION_CUSTOM_DATASET_ROOT": str(shared)}):
            resp = self._upload(self._create_zip(self.valid_manifest, self.valid_rows_text))
            self.assertEqual(resp.status_code, 201)
            self.assertTrue((shared / resp.json()["dataset_id"] / "manifest.json").is_file())

            from training.tasks import _resolve_dataset
            manifest, rows = _resolve_dataset(resp.json()["dataset_ref"])
        self.assertEqual(manifest["dataset_id"], self.valid_manifest["dataset_id"])
        self.assertEqual(len(rows), 40)

    def test_custom_reference_cannot_escape_dataset_root(self) -> None:
        from training.tasks import _resolve_dataset
        with self.assertRaises(ValueError):
            _resolve_dataset("custom:../../etc")

    def test_upload_over_size_limit_is_rejected(self) -> None:
        zip_bytes = self._create_zip(self.valid_manifest, self.valid_rows_text)
        with patch.dict(os.environ, {"PREDICTION_DATASET_UPLOAD_MAX_BYTES": "1024"}):
            resp = self._upload(zip_bytes)
        self.assertEqual(resp.status_code, 413)
        self.assertEqual(resp.json()["code"], "PAYLOAD_TOO_LARGE")

    def test_upload_over_decompressed_limit_is_rejected(self) -> None:
        zip_bytes = self._create_zip(self.valid_manifest, self.valid_rows_text + "\n" * 20000)
        with patch.dict(os.environ, {"PREDICTION_DATASET_MAX_UNCOMPRESSED_BYTES": "4096"}):
            resp = self._upload(zip_bytes)
        self.assertEqual(resp.status_code, 413)
        self.assertEqual(resp.json()["code"], "PAYLOAD_TOO_LARGE")

    def test_upload_invalid_file_extension_rejected(self) -> None:
        for name in ("dataset.csv", "rows.jsonl"):
            resp = self.operator.post(
                "/v1/datasets/upload",
                files={"file": (name, b"a,b,c\n1,2,3", "text/plain")},
            )
            self.assertEqual(resp.status_code, 400)
            self.assertEqual(resp.json()["code"], "INVALID_FILE_TYPE")

    def test_upload_zip_missing_files_rejected(self) -> None:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("manifest.json", json.dumps(self.valid_manifest))
        resp = self._upload(buf.getvalue(), "incomplete.zip")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], "MISSING_DATASET_FILES")

    def test_upload_zip_with_ambiguous_files_rejected(self) -> None:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("a/manifest.json", json.dumps(self.valid_manifest))
            z.writestr("b/manifest.json", json.dumps(self.valid_manifest))
            z.writestr("rows.jsonl", self.valid_rows_text)
        resp = self._upload(buf.getvalue())
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], "AMBIGUOUS_DATASET_FILES")

    def test_upload_invalid_contract_rejected(self) -> None:
        invalid_manifest = dict(self.valid_manifest)
        invalid_manifest["content_digest"] = "0" * 64
        resp = self._upload(self._create_zip(invalid_manifest, self.valid_rows_text), "corrupt.zip")
        self.assertEqual(resp.status_code, 422)
        self.assertEqual(resp.json()["code"], "DATASET_CONTRACT_VIOLATION")


if __name__ == "__main__":
    unittest.main()
