package postgres

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/config"
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
