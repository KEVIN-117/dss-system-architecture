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

from fastapi.testclient import TestClient

from main import app


class TestDatasetUploadAPI(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_root = tempfile.mkdtemp(prefix="test_dataset_root_")
        self.orig_dataset_root = os.environ.get("PREDICTION_DATASET_ROOT")
        os.environ["PREDICTION_DATASET_ROOT"] = self.temp_root
        self.client = TestClient(app)

        # Cargar datos base de fixture pred003
        fixtures_dir = Path(__file__).parent / "fixtures" / "pred003_synthetic"
        self.valid_manifest = json.loads((fixtures_dir / "manifest.json").read_text(encoding="utf-8"))
        self.valid_rows_text = (fixtures_dir / "rows.jsonl").read_text(encoding="utf-8")

    def tearDown(self) -> None:
        if self.orig_dataset_root is not None:
            os.environ["PREDICTION_DATASET_ROOT"] = self.orig_dataset_root
        else:
            os.environ.pop("PREDICTION_DATASET_ROOT", None)
        shutil.rmtree(self.temp_root, ignore_errors=True)

    def _create_zip(self, manifest: dict, rows_text: str, manifest_name="manifest.json", rows_name="rows.jsonl") -> bytes:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr(manifest_name, json.dumps(manifest))
            z.writestr(rows_name, rows_text)
        return buf.getvalue()

    def test_list_datasets_includes_pred003_fixture(self) -> None:
        resp = self.client.get("/v1/datasets")
        self.assertEqual(resp.status_code, 200)
        datasets = resp.json()
        self.assertGreaterEqual(len(datasets), 1)
        fixture_item = next((d for d in datasets if d["dataset_ref"] == "fixture:pred003_synthetic-v1"), None)
        self.assertIsNotNone(fixture_item)
        self.assertEqual(fixture_item["is_custom"], False)

    def test_upload_valid_dataset_zip_succeeds(self) -> None:
        zip_bytes = self._create_zip(self.valid_manifest, self.valid_rows_text)
        resp = self.client.post(
            "/v1/datasets/upload",
            files={"file": ("my_clean_dataset.zip", zip_bytes, "application/zip")},
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertIn("custom:", data["dataset_ref"])
        self.assertEqual(data["row_count"], 40)
        self.assertEqual(data["content_digest"], self.valid_manifest["content_digest"])

        # Verificar que ahora figure en el listado
        list_resp = self.client.get("/v1/datasets")
        self.assertEqual(list_resp.status_code, 200)
        refs = [d["dataset_ref"] for d in list_resp.json()]
        self.assertIn(data["dataset_ref"], refs)

    def test_upload_invalid_file_extension_rejected(self) -> None:
        resp = self.client.post(
            "/v1/datasets/upload",
            files={"file": ("dataset.csv", b"a,b,c\n1,2,3", "text/csv")},
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], "INVALID_FILE_TYPE")

    def test_upload_zip_missing_files_rejected(self) -> None:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("manifest.json", json.dumps(self.valid_manifest))
        zip_bytes = buf.getvalue()

        resp = self.client.post(
            "/v1/datasets/upload",
            files={"file": ("incomplete.zip", zip_bytes, "application/zip")},
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["code"], "MISSING_DATASET_FILES")

    def test_upload_invalid_contract_rejected(self) -> None:
        invalid_manifest = dict(self.valid_manifest)
        invalid_manifest["content_digest"] = "0000000000000000000000000000000000000000000000000000000000000000"
        zip_bytes = self._create_zip(invalid_manifest, self.valid_rows_text)

        resp = self.client.post(
            "/v1/datasets/upload",
            files={"file": ("corrupt.zip", zip_bytes, "application/zip")},
        )
        self.assertEqual(resp.status_code, 422)
        self.assertEqual(resp.json()["code"], "DATASET_CONTRACT_VIOLATION")


if __name__ == "__main__":
    unittest.main()
