package postgres

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/config"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/domain"
)

func TestBuildPoolConfigAppliesSafetySettings(t *testing.T) {
	db := config.Database{Host: "db.internal", Port: 5432, Name: "dss_dw", User: "reader", Password: "p@ss:/word", SSLMode: "verify-full"}
	connectTimeout := 7 * time.Second
	cfg, err := BuildPoolConfig(db, "loadmanager-source", true, 3, connectTimeout)
	if err != nil {
		t.Fatalf("BuildPoolConfig: %v", err)
	}
	if cfg.MaxConns != 3 || cfg.ConnConfig.ConnectTimeout != connectTimeout || cfg.ConnConfig.RuntimeParams["application_name"] != "loadmanager-source" ||
		cfg.ConnConfig.RuntimeParams["default_transaction_read_only"] != "on" || cfg.ConnConfig.TLSConfig == nil {
		t.Fatalf("unexpected source pool settings: %+v", cfg)
	}
	target, err := BuildPoolConfig(db, "loadmanager-target", false, 4, connectTimeout)
	if err != nil {
		t.Fatalf("BuildPoolConfig target: %v", err)
	}
	if _, ok := target.ConnConfig.RuntimeParams["default_transaction_read_only"]; ok {
		t.Fatal("writable target pool unexpectedly configured read-only")
	}
}

func TestSnapshotRequestSupportsHistoricalAndClosureModes(t *testing.T) {
	period := &domain.AcademicPeriod{Year: 2025, Period: 3}
	historical := SnapshotRequest{RunID: domain.RunID(uuid.New()), Actor: "loadmanager:test", Period: period}
	if err := validateSnapshotRequest(&historical); err != nil {
		t.Fatalf("valid historical snapshot request: %v", err)
	}
	if historical.ExecutionKind != domain.ExecutionHistorical || historical.BatchSize != defaultSnapshotBatchSize {
		t.Fatalf("unexpected historical defaults: %+v", historical)
	}

	closureID := int64(7)
	closure := SnapshotRequest{
		RunID: domain.RunID(uuid.New()), Actor: "loadmanager:test", ExecutionKind: domain.ExecutionClosure,
		ClosureID: &closureID, BatchSize: 512,
	}
	if err := validateSnapshotRequest(&closure); err != nil {
		t.Fatalf("valid academic-closure snapshot request: %v", err)
	}
	closure.ClosureID = nil
	if err := validateSnapshotRequest(&closure); err == nil {
		t.Fatal("closure snapshot without closure_id must be rejected")
	}
	closure.ExecutionKind = domain.ExecutionHistorical
	closure.BatchSize = maxSnapshotBatchSize + 1
	if err := validateSnapshotRequest(&closure); err == nil {
		t.Fatal("oversized extraction batch must be rejected")
	}
}

func TestBuildPoolConfigRejectsMissingTimeoutWithoutLeakingConfiguration(t *testing.T) {
	db := config.Database{Host: "db.internal", Port: 5432, Name: "dss_dw", User: "reader", Password: "never-log-this", SSLMode: "verify-full"}
	_, err := BuildPoolConfig(db, "loadmanager-source", true, 3, 0)
	if err == nil {
		t.Fatal("expected missing connect timeout to be rejected")
	}
	if strings.Contains(err.Error(), db.Password) || strings.Contains(err.Error(), db.Host) {
		t.Fatalf("configuration error exposed connection details: %v", err)
	}

	if _, err := NewPool(context.Background(), "loadmanager-source", db, true, 1, 0); err == nil {
		t.Fatal("expected NewPool to reject a missing connect timeout")
	}
}
