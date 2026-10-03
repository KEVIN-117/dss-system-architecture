//go:build integration

package postgres

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/domain"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/source"
)

func TestNineSourceRawBundleIntegration(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	sourcePool, err := NewPool(ctx, "dw012-source-fixture", integrationDB("SOURCE"), true, 2, 5*time.Second)
	if err != nil {
		t.Fatal("create source pool")
	}
	defer sourcePool.Close()
	targetPool, err := NewPool(ctx, "dw012-target-fixture", integrationDB("TARGET"), false, 4, 5*time.Second)
	if err != nil {
		t.Fatal("create target pool")
	}
	defer targetPool.Close()
	coordinatorPool, err := NewPool(ctx, "dw012-coordinator-fixture", integrationDB("TARGET"), false, 2, 5*time.Second)
	if err != nil {
		t.Fatal("create coordinator pool")
	}
	defer coordinatorPool.Close()
	verifierPool, err := NewPool(ctx, "dw012-verifier-fixture", integrationDB("VERIFY"), false, 2, 5*time.Second)
	if err != nil {
		t.Fatal("create read-only verifier pool")
	}
	defer verifierPool.Close()
	var canRead, canInsert, canUpdate bool
	if err := verifierPool.pool.QueryRow(ctx, `SELECT
has_table_privilege(current_user,'etl_control.etl_source_manifest','SELECT'),
has_table_privilege(current_user,'etl_control.etl_source_manifest','INSERT'),
has_table_privilege(current_user,'etl_control.etl_source_manifest','UPDATE')`).Scan(&canRead, &canInsert, &canUpdate); err != nil {
		t.Fatal("check verifier privileges")
	}
	if !canRead || canInsert || canUpdate {
		t.Fatalf("verifier privileges are not read-only (select=%t insert=%t update=%t)", canRead, canInsert, canUpdate)
	}

	root := os.Getenv("DW_RAW_ROOT")
	if root == "" {
		root = t.TempDir()
	}
	queryDir := os.Getenv("LOADMANAGER_QUERY_DIR")
	if queryDir == "" {
		_, filename, _, _ := runtime.Caller(0)
		queryDir = filepath.Clean(filepath.Join(filepath.Dir(filename), "..", "..", "..", "..", "..", "infra", "postgres-tx", "extract"))
	}
	extractor, err := NewRawBundleExtractor(sourcePool, targetPool, coordinatorPool, queryDir, root, DefaultExtractionLimits(), 128)
	if err != nil {
		t.Fatal("initialize nine-source extractor")
	}
	period := &domain.AcademicPeriod{Year: 2025, Period: 2}
	runID := domain.RunID(uuid.New())
	if _, err := VerifyRawBundle(ctx, verifierPool, root, uuid.NewString()); err == nil {
		t.Fatal("a run without a successful completeness gate was eligible for Hop")
	}
	extractor.afterSourceComplete = func(context.Context) error { return errors.New("injected post-checkpoint interruption") }
	if _, err := extractor.ExtractAll(ctx, RawBundleRequest{RunID: runID, Actor: "loadmanager:dw012-integration",
		ExecutionKind: domain.ExecutionHistorical, Period: period, BatchSize: 128}); err == nil {
		t.Fatal("injected finalization interruption was not observed")
	}
	extractor.afterSourceComplete = nil
	result, err := extractor.ExtractAll(ctx, RawBundleRequest{RunID: runID, Actor: "loadmanager:dw012-integration",
		ExecutionKind: domain.ExecutionHistorical, Period: period, BatchSize: 128})
	if err != nil {
		t.Fatalf("extract nine-source bundle: %v", err)
	}
	if result.SourceCount != 9 || result.ArtifactCount < 9 || result.RecordCount != 2025 || result.ByteCount == 0 {
		t.Fatalf("unexpected raw bundle result: %+v", result)
	}
	for _, spec := range source.Contracts() {
		var status string
		var count int64
		if err := targetPool.pool.QueryRow(ctx, `SELECT status,record_count FROM etl_control.etl_source_manifest WHERE run_id=$1 AND source_contract_id=$2`, uuid.UUID(runID), spec.Contract.ID).Scan(&status, &count); err != nil {
			t.Fatalf("read manifest for %s: %v", spec.Contract.ID, err)
		}
		if status != "COMPLETO" || count == 0 {
			t.Fatalf("source %s manifest is not complete: status=%s rows=%d", spec.Contract.ID, status, count)
		}
	}
	verified, err := VerifyRawBundle(ctx, verifierPool, root, runID.String())
	if err != nil || verified.ArtifactCount != result.ArtifactCount || verified.RecordCount != result.RecordCount {
		t.Fatalf("completed bundle failed checksum/gate verification: result=%+v err=%v", verified, err)
	}
	var artifactURI string
	if err := targetPool.pool.QueryRow(ctx, `SELECT artifact.artifact_uri FROM etl_control.etl_source_manifest manifest
JOIN etl_control.etl_source_manifest_artifact artifact USING (manifest_id)
WHERE manifest.run_id=$1 ORDER BY artifact.artifact_id LIMIT 1`, uuid.UUID(runID)).Scan(&artifactURI); err != nil {
		t.Fatal("read artifact URI for tamper check")
	}
	artifactPath, err := filePathFromArtifactURI(artifactURI)
	if err != nil {
		t.Fatal("decode artifact URI")
	}
	if err := os.WriteFile(artifactPath, []byte("modified"), 0600); err != nil {
		t.Fatal("tamper with integration artifact")
	}
	if _, err := VerifyRawBundle(ctx, verifierPool, root, runID.String()); err == nil {
		t.Fatal("tampered artifact was eligible for Hop")
	}
	var legacyRows int64
	if err := targetPool.pool.QueryRow(ctx, `SELECT count(*) FROM staging.raw_uatf_datos WHERE run_id=$1`, uuid.UUID(runID)).Scan(&legacyRows); err != nil {
		t.Fatal("inspect legacy RAW table")
	}
	if legacyRows != 0 {
		t.Fatalf("DW-012 wrote %d duplicate rows into legacy SQL RAW", legacyRows)
	}
}
