//go:build integration

package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/config"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/domain"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/source"
)

func TestUATFDatosExtractionIntegration(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	sourcePool, err := NewPool(ctx, "uatf-fixture", integrationDB("SOURCE"), true, 2)
	if err != nil {
		t.Fatal("create source fixture pool")
	}
	defer sourcePool.Close()
	targetPool, err := NewPool(ctx, "dw-fixture", integrationDB("TARGET"), false, 2)
	if err != nil {
		t.Fatal("create target fixture pool")
	}
	defer targetPool.Close()

	query, err := source.LoadUATFDatosQuery(os.Getenv("LOADMANAGER_QUERY_DIR"))
	if err != nil {
		t.Fatal(err)
	}
	extractor, err := NewUATFDatosExtractor(sourcePool, targetPool, query)
	if err != nil {
		t.Fatal(err)
	}
	for attempt := 0; attempt < 2; attempt++ {
		runID := domain.RunID(uuid.New())
		result, err := extractor.Extract(ctx, runID, "loadmanager:integration-test")
		if err != nil {
			t.Fatalf("extract synthetic source snapshot: %v", err)
		}
		if result.RecordCount != 2 || result.ByteCount == 0 || result.RowSHA256 == "" || result.SchemaSHA256 == "" {
			t.Fatalf("unexpected snapshot manifest: %+v", result)
		}
		var staged int64
		if err := targetPool.pool.QueryRow(ctx, `SELECT count(*) FROM staging.raw_uatf_datos WHERE run_id = $1`, uuid.UUID(runID)).Scan(&staged); err != nil {
			t.Fatal("count staged rows")
		}
		if staged != result.RecordCount {
			t.Fatalf("manifest rows %d differ from staged rows %d", result.RecordCount, staged)
		}
		var status string
		if err := targetPool.pool.QueryRow(ctx, `SELECT status FROM etl_control.etl_source_manifest WHERE run_id = $1 AND source_contract_id = 'public.uatf_datos'`, uuid.UUID(runID)).Scan(&status); err != nil {
			t.Fatal("read source manifest status")
		}
		if status != "COMPLETO" {
			t.Fatalf("expected complete manifest, got %s", status)
		}
		var artifacts int64
		if err := targetPool.pool.QueryRow(ctx, `
SELECT count(*)
FROM etl_control.etl_source_manifest manifest
JOIN etl_control.etl_source_manifest_artifact artifact USING (manifest_id)
WHERE manifest.run_id = $1
  AND manifest.source_contract_id = 'public.uatf_datos'
  AND manifest.status = 'COMPLETO'
  AND artifact.artifact_kind = 'RAW_EXTRACT'
  AND artifact.record_count = $2
  AND artifact.artifact_sha256 = $3`, uuid.UUID(runID), result.RecordCount, result.RowSHA256).Scan(&artifacts); err != nil {
			t.Fatal("verify completed manifest artifact")
		}
		if artifacts != 1 {
			t.Fatalf("expected one verified artifact on the complete manifest, got %d", artifacts)
		}
	}
}

func integrationDB(prefix string) config.Database {
	return config.Database{
		Host: os.Getenv(prefix + "_HOST"), Name: os.Getenv(prefix + "_DB"),
		User: os.Getenv(prefix + "_USER"), Password: os.Getenv(prefix + "_PASSWORD"),
		Port: 5432, SSLMode: "disable",
	}
}
