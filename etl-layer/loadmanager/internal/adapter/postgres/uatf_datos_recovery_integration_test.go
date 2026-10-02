//go:build integration

package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/domain"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/source"
)

func newRecoveryFixture(t *testing.T, ctx context.Context) (*Pool, *Pool, *Pool, *UATFDatosExtractor) {
	t.Helper()
	src, err := NewPool(ctx, "uatf-recovery-fixture", integrationDB("SOURCE"), true, 2, 3*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(src.Close)
	dst, err := NewPool(ctx, "dw-recovery-fixture", integrationDB("TARGET"), false, 4, 3*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(dst.Close)
	coord, err := NewPool(ctx, "dw-recovery-coordinator", integrationDB("TARGET"), false, 2, 3*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(coord.Close)
	query, err := source.LoadUATFDatosQuery(os.Getenv("LOADMANAGER_QUERY_DIR"))
	if err != nil {
		t.Fatal(err)
	}
	extractor, err := NewUATFDatosExtractor(src, dst, coord, query, DefaultExtractionLimits())
	if err != nil {
		t.Fatal(err)
	}
	return src, dst, coord, extractor
}

func TestInterruptedSnapshotRequiresNewRunIDIntegration(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	_, target, _, extractor := newRecoveryFixture(t, ctx)
	request := SnapshotRequest{RunID: domain.RunID(uuid.New()), Actor: "loadmanager:restart-test", ExecutionKind: domain.ExecutionHistorical, BatchSize: 512}
	release, err := extractor.acquireRunLock(ctx, uuid.UUID(request.RunID))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := extractor.Extract(ctx, request); err == nil {
		t.Fatal("same run_id acquired twice")
	}
	release()
	extractor.afterPage = func(_ context.Context, batch int64) error {
		if batch == 1 {
			return errors.New("injected interruption")
		}
		return nil
	}
	if _, err := extractor.Extract(ctx, request); err == nil {
		t.Fatal("expected interrupted snapshot")
	}
	var rows int64
	var executionStatus, manifestStatus string
	if err := target.pool.QueryRow(ctx, `SELECT count(*) FROM staging.raw_uatf_datos WHERE run_id = $1`, uuid.UUID(request.RunID)).Scan(&rows); err != nil {
		t.Fatal(err)
	}
	if err := target.pool.QueryRow(ctx, `SELECT status FROM etl_control.etl_execution WHERE run_id = $1`, uuid.UUID(request.RunID)).Scan(&executionStatus); err != nil {
		t.Fatal(err)
	}
	if err := target.pool.QueryRow(ctx, `SELECT status FROM etl_control.etl_source_manifest WHERE run_id = $1`, uuid.UUID(request.RunID)).Scan(&manifestStatus); err != nil {
		t.Fatal(err)
	}
	if rows != 512 || executionStatus != "FALLIDA" || manifestStatus != "FALLIDO" {
		t.Fatalf("partial run not sealed: rows=%d execution=%s manifest=%s", rows, executionStatus, manifestStatus)
	}
	if _, err := extractor.Extract(ctx, request); err == nil {
		t.Fatal("failed run_id was reused")
	}
	extractor.afterPage = nil
	previous := request.RunID
	request.RunID = domain.RunID(uuid.New())
	request.RetryOfRunID = &previous
	request.ExecutionKind = domain.ExecutionReplay
	result, err := extractor.Extract(ctx, request)
	if err != nil {
		t.Fatalf("new retry run: %v", err)
	}
	if result.RecordCount != 2002 {
		t.Fatalf("new run omitted rows: %+v", result)
	}
}

func TestSourceCompleteReconcilesWithoutOLTPIntegration(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	src, _, _, extractor := newRecoveryFixture(t, ctx)
	request := SnapshotRequest{RunID: domain.RunID(uuid.New()), Actor: "loadmanager:finalize-test", ExecutionKind: domain.ExecutionHistorical, BatchSize: 1000}
	extractor.afterSourceComplete = func(context.Context) error { return errors.New("injected finalization crash") }
	if _, err := extractor.Extract(ctx, request); err == nil {
		t.Fatal("expected finalization interruption")
	}
	src.Close()
	extractor.afterSourceComplete = nil
	result, err := extractor.RecoverInterruptedRun(ctx, request)
	if err != nil {
		t.Fatalf("metadata-only finalization with OLTP disconnected: %v", err)
	}
	if result.RecordCount != 2002 || result.RowSHA256 == "" {
		t.Fatalf("unexpected reconciled result: %+v", result)
	}
}

func TestBeforePageCommitLeavesNoPartialRowsIntegration(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	_, target, _, extractor := newRecoveryFixture(t, ctx)
	request := SnapshotRequest{RunID: domain.RunID(uuid.New()), Actor: "loadmanager:precommit-test", ExecutionKind: domain.ExecutionHistorical, BatchSize: 128}
	extractor.beforePageCommit = func(context.Context, int64) error { return errors.New("injected precommit crash") }
	if _, err := extractor.Extract(ctx, request); err == nil {
		t.Fatal("expected failure before first page commit")
	}
	var rows int64
	if err := target.pool.QueryRow(ctx, `SELECT count(*) FROM staging.raw_uatf_datos WHERE run_id = $1`, uuid.UUID(request.RunID)).Scan(&rows); err != nil {
		t.Fatal(err)
	}
	if rows != 0 {
		t.Fatalf("uncommitted page left %d RAW rows", rows)
	}
	var blockingErrors int64
	if err := target.pool.QueryRow(ctx, `SELECT count(*) FROM etl_control.etl_execution_error WHERE run_id = $1 AND is_blocking`, uuid.UUID(request.RunID)).Scan(&blockingErrors); err != nil {
		t.Fatal(err)
	}
	if blockingErrors != 1 {
		t.Fatalf("expected one blocking audit error, got %d", blockingErrors)
	}
}

func TestFinalizationRollbackCanBeReconciledIntegration(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	_, target, _, extractor := newRecoveryFixture(t, ctx)
	request := SnapshotRequest{RunID: domain.RunID(uuid.New()), Actor: "loadmanager:final-tx-test", ExecutionKind: domain.ExecutionHistorical, BatchSize: 1000}
	extractor.beforeFinalizationCommit = func(context.Context) error { return errors.New("injected metadata commit failure") }
	if _, err := extractor.Extract(ctx, request); err == nil {
		t.Fatal("expected metadata finalization failure")
	}
	var manifestStatus string
	if err := target.pool.QueryRow(ctx, `SELECT status FROM etl_control.etl_source_manifest WHERE run_id = $1`, uuid.UUID(request.RunID)).Scan(&manifestStatus); err != nil {
		t.Fatal(err)
	}
	if manifestStatus != "PENDIENTE" {
		t.Fatalf("partial manifest published: %s", manifestStatus)
	}
	extractor.beforeFinalizationCommit = nil
	if _, err := extractor.RecoverInterruptedRun(ctx, request); err != nil {
		t.Fatalf("finalize persisted source: %v", err)
	}
}

func TestTargetOutageReportsFailureAuditOutageIntegration(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	_, target, _, extractor := newRecoveryFixture(t, ctx)
	request := SnapshotRequest{RunID: domain.RunID(uuid.New()), Actor: "loadmanager:outage-test", ExecutionKind: domain.ExecutionHistorical, BatchSize: 128}
	extractor.afterPage = func(context.Context, int64) error {
		target.Close()
		return errors.New("injected DW outage")
	}
	_, err := extractor.Extract(ctx, request)
	if err == nil || !strings.Contains(err.Error(), "failure audit unavailable") {
		t.Fatalf("destination outage was silently swallowed: %v", err)
	}
}

func TestFourRequestsWithFourTargetConnectionsDoNotStarveIntegration(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	_, target, _, extractor := newRecoveryFixture(t, ctx)
	var group sync.WaitGroup
	errorsByRun := make(chan error, 4)
	for index := 0; index < 4; index++ {
		group.Add(1)
		go func() {
			defer group.Done()
			request := SnapshotRequest{RunID: domain.RunID(uuid.New()), Actor: "loadmanager:parallel-test", ExecutionKind: domain.ExecutionHistorical, BatchSize: 500}
			result, err := extractor.Extract(ctx, request)
			if err == nil && result.RecordCount != 2002 {
				err = errors.New("parallel snapshot row count differs")
			}
			errorsByRun <- err
		}()
	}
	group.Wait()
	close(errorsByRun)
	for err := range errorsByRun {
		if err != nil {
			t.Fatalf("parallel extraction did not terminate successfully: %v", err)
		}
	}
	if target.pool.Stat().MaxConns() != 4 {
		t.Fatal("test did not use a four-connection DW pool")
	}
}

func TestCompletedV1SnapshotRemainsReadableIntegration(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	src, target, _, extractor := newRecoveryFixture(t, ctx)
	request := SnapshotRequest{RunID: domain.RunID(uuid.New()), Actor: "loadmanager:legacy-v1-test", ExecutionKind: domain.ExecutionHistorical, BatchSize: 100}
	if err := validateSnapshotRequest(&request); err != nil {
		t.Fatal(err)
	}
	fingerprint, err := snapshotRequestFingerprint(request)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := extractor.prepareExecution(ctx, request); err != nil {
		t.Fatal(err)
	}
	runID := uuid.UUID(request.RunID)
	legacyHash := strings.Repeat("a", 64)
	schemaHash := strings.Repeat("b", 64)
	artifactHash := strings.Repeat("c", 64)
	key := "RA-Legacy"
	checkpoint, err := json.Marshal(extractionCheckpoint{Version: 1, RequestFingerprint: fingerprint,
		QuerySHA256: legacyHash, SchemaSHA256: schemaHash, BatchSize: 100, LastIDRA: &key,
		RecordCount: 1, ByteCount: 8, BatchCount: 1})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := extractor.registerStep(ctx, runID, "EXITOSO", checkpoint); err != nil {
		t.Fatal(err)
	}
	if _, err := target.pool.Exec(ctx, `INSERT INTO staging.raw_uatf_datos
(run_id,row_ordinal,id_ra,estado_civil,_modificado,row_sha256)
VALUES ($1,1,$2,1,'2025-12-01 00:00:00'::timestamp,$3)`, runID, key, artifactHash); err != nil {
		t.Fatal(err)
	}
	var manifestID int64
	if err := target.pool.QueryRow(ctx, `SELECT manifest.manifest_id FROM etl_control.register_etl_source_manifest(
$1::uuid,'public.uatf_datos'::varchar(150),'legacy-v1'::varchar(64),'public'::varchar(63),
'uatf_datos'::varchar(63),$2::char(64),'id_ra ASC'::text,'COMPLETO'::varchar(16),
$3::char(64),NULL::smallint,NULL::smallint,NULL::timestamptz,1::bigint,'{}'::jsonb
) AS manifest`, runID, legacyHash, schemaHash).Scan(&manifestID); err != nil {
		t.Fatal(err)
	}
	var artifactID int64
	if err := target.pool.QueryRow(ctx, `SELECT artifact.artifact_id FROM etl_control.register_etl_source_manifest_artifact(
$1::bigint,'RAW_EXTRACT'::varchar(32),$2::text,$3::char(64),8::bigint,1::bigint
) AS artifact`, manifestID, "postgresql://dw/staging.raw_uatf_datos/"+runID.String(), artifactHash).Scan(&artifactID); err != nil {
		t.Fatal(err)
	}
	src.Close()
	result, err := extractor.Extract(ctx, request)
	if err != nil {
		t.Fatalf("completed v1 snapshot unreadable: %v", err)
	}
	if result.RecordCount != 1 || result.RowSHA256 != artifactHash {
		t.Fatalf("unexpected legacy result: %+v", result)
	}
}

func TestPartialV1SnapshotIsFailedWithoutSourceResumeIntegration(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	src, target, _, extractor := newRecoveryFixture(t, ctx)
	request := SnapshotRequest{RunID: domain.RunID(uuid.New()), Actor: "loadmanager:partial-v1-test", ExecutionKind: domain.ExecutionHistorical, BatchSize: 100}
	if err := validateSnapshotRequest(&request); err != nil {
		t.Fatal(err)
	}
	fingerprint, err := snapshotRequestFingerprint(request)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := extractor.prepareExecution(ctx, request); err != nil {
		t.Fatal(err)
	}
	checkpoint, err := json.Marshal(extractionCheckpoint{Version: 1, RequestFingerprint: fingerprint,
		QuerySHA256: strings.Repeat("a", 64), BatchSize: 100})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := extractor.registerStep(ctx, uuid.UUID(request.RunID), "EN_EJECUCION", checkpoint); err != nil {
		t.Fatal(err)
	}
	src.Close()
	if _, err := extractor.RecoverInterruptedRun(ctx, request); !errors.Is(err, ErrRestartRequired) {
		t.Fatalf("partial v1 snapshot was not sealed for new run_id: %v", err)
	}
	var status string
	if err := target.pool.QueryRow(ctx, `SELECT status FROM etl_control.etl_execution WHERE run_id = $1`, uuid.UUID(request.RunID)).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "FALLIDA" {
		t.Fatalf("partial v1 execution remained active: %s", status)
	}
}
