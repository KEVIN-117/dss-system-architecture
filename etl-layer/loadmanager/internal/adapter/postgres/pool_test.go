package postgres

import (
	"testing"

	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/config"
)

func TestBuildPoolConfigAppliesSafetySettings(t *testing.T) {
	db := config.Database{Host: "db.internal", Port: 5432, Name: "dss_dw", User: "reader", Password: "p@ss:/word", SSLMode: "verify-full"}
	cfg, err := BuildPoolConfig(db, "loadmanager-source", true, 3)
	if err != nil {
		t.Fatalf("BuildPoolConfig: %v", err)
	}
	if cfg.MaxConns != 3 || cfg.ConnConfig.RuntimeParams["application_name"] != "loadmanager-source" ||
		cfg.ConnConfig.RuntimeParams["default_transaction_read_only"] != "on" || cfg.ConnConfig.TLSConfig == nil {
		t.Fatalf("unexpected source pool settings: %+v", cfg)
	}
	target, err := BuildPoolConfig(db, "loadmanager-target", false, 4)
	if err != nil {
		t.Fatalf("BuildPoolConfig target: %v", err)
	}
	if _, ok := target.ConnConfig.RuntimeParams["default_transaction_read_only"]; ok {
		t.Fatal("writable target pool unexpectedly configured read-only")
	}
}
