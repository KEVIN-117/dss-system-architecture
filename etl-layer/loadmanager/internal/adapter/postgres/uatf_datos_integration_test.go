//go:build integration

package postgres

import (
	"context"
	"os"
	"strings"
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
	sourcePool, err := NewPool(ctx, "uatf-fixture", integrationDB("SOURCE"), true, 2, 3*time.Second)
	if err != nil {
		t.Fatal("create source fixture pool")
	}
	defer sourcePool.Close()
	targetPool, err := NewPool(ctx, "dw-fixture", integrationDB("TARGET"), false, 2, 3*time.Second)
	if err != nil {
		t.Fatal("create target fixture pool")
	}
	defer targetPool.Close()

	if err := sourcePool.Ping(ctx); err != nil {
		t.Fatalf("source fixture connectivity check failed: %v", err)
	}
	if err := targetPool.Ping(ctx); err != nil {
		t.Fatalf("DW fixture connectivity check failed: %v", err)
	}

	var defaultReadOnly string
	if err := sourcePool.pool.QueryRow(ctx, `SHOW default_transaction_read_only`).Scan(&defaultReadOnly); err != nil {
		t.Fatal("inspect source session read-only default")
	}
	if defaultReadOnly != "on" {
		t.Fatalf("source session is not read-only by default: %q", defaultReadOnly)
	}
	var hasSelect, hasInsert, hasUpdate, hasDelete, hasCreate, isPrivileged bool
	if err := sourcePool.pool.QueryRow(ctx, `
SELECT has_table_privilege(current_user, 'public.uatf_datos', 'SELECT'),
       has_table_privilege(current_user, 'public.uatf_datos', 'INSERT'),
       has_table_privilege(current_user, 'public.uatf_datos', 'UPDATE'),
       has_table_privilege(current_user, 'public.uatf_datos', 'DELETE'),
       has_schema_privilege(current_user, 'public', 'CREATE'),
       (rolsuper OR rolcreaterole OR rolcreatedb)
FROM pg_roles WHERE rolname = current_user`).Scan(&hasSelect, &hasInsert, &hasUpdate, &hasDelete, &hasCreate, &isPrivileged); err != nil {
		t.Fatal("inspect source principal privileges")
	}
	if !hasSelect || hasInsert || hasUpdate || hasDelete || hasCreate || isPrivileged {
		t.Fatalf("source fixture principal privileges exceed the read-only contract (select=%t insert=%t update=%t delete=%t create=%t privileged=%t)", hasSelect, hasInsert, hasUpdate, hasDelete, hasCreate, isPrivileged)
	}
	if _, err := sourcePool.pool.Exec(ctx, `CREATE TABLE public.dw010_write_must_fail (id integer)`); err == nil {
		t.Fatal("read-only source principal unexpectedly created a table")
	}

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

func TestSourceQueryCancellationReleasesConnectionIntegration(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	sourcePool, err := NewPool(ctx, "uatf-cancel-fixture", integrationDB("SOURCE"), true, 2, 3*time.Second)
	if err != nil {
		t.Fatal("create source fixture pool")
	}
	defer sourcePool.Close()

	queryCtx, cancelQuery := context.WithCancel(ctx)
	queryFinished := make(chan error, 1)
	started := make(chan struct{})
	go func() {
		close(started)
		var result int
		queryFinished <- sourcePool.pool.QueryRow(queryCtx, `SELECT 1 FROM pg_sleep(10)`).Scan(&result)
	}()
	<-started
	time.Sleep(100 * time.Millisecond)
	cancelQuery()

	select {
	case err := <-queryFinished:
		if err == nil {
			t.Fatal("expected canceled source query to return an error")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("source query did not stop after context cancellation")
	}

	if err := sourcePool.Ping(ctx); err != nil {
		t.Fatalf("source pool was not usable after canceled query: %v", err)
	}
}

func TestInvalidSourceCredentialsReturnSanitizedConnectivityErrorIntegration(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	database := integrationDB("SOURCE")
	database.Password = "dw010-invalid-password-not-for-logs"
	pool, err := NewPool(ctx, "uatf-invalid-credentials", database, true, 1, 2*time.Second)
	if err != nil {
		t.Fatal("create pool for negative authentication test")
	}
	defer pool.Close()

	err = pool.Ping(ctx)
	if err == nil {
		t.Fatal("expected invalid source credentials to fail connectivity")
	}
	for _, sensitive := range []string{database.Password, database.User, database.Host} {
		if strings.Contains(err.Error(), sensitive) {
			t.Fatalf("connectivity error exposed sensitive connection detail %q", sensitive)
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
