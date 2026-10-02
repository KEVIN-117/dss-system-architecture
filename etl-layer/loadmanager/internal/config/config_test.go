package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadResolvesSecretsFromEnvironment(t *testing.T) {
	path := writeConfig(t, validConfigYAML)
	env := map[string]string{
		"DB_TX_HOST": "jachasun", "DB_TX_PORT": "5432", "DB_TX_NAME": "jachasun",
		"DB_TX_USER": "extractor", "DB_TX_PASS": "source-secret", "DB_TX_SSLMODE": "verify-full",
		"DB_DW_HOST": "warehouse", "DB_DW_PORT": "5433", "DB_DW_NAME": "dss_dw",
		"DB_DW_USER": "dw_staging_writer", "DB_DW_PASS": "target-secret", "DB_DW_SSLMODE": "require",
	}
	cfg, err := LoadWithLookup(path, func(key string) (string, bool) {
		value, ok := env[key]
		return value, ok
	})
	if err != nil {
		t.Fatalf("LoadWithLookup returned error: %v", err)
	}
	if cfg.HTTPAddress != ":8088" || cfg.ReadHeaderTimeout.String() != "5s" || cfg.ShutdownTimeout.String() != "10s" ||
		cfg.ReadinessTimeout.String() != "2s" || cfg.ConnectTimeout.String() != "5s" {
		t.Fatalf("unexpected server config: %+v", cfg)
	}
	if cfg.Source.Password != "source-secret" || cfg.Target.Password != "target-secret" || cfg.Source.SSLMode != "verify-full" {
		t.Fatal("database credentials were not resolved from the environment")
	}
	encoded := string(mustRead(t, path))
	for _, secret := range []string{cfg.Source.Password, cfg.Target.Password} {
		if strings.Contains(encoded, secret) {
			t.Fatal("configuration file must not contain resolved secrets")
		}
	}
}

func TestLoadFailsWhenRequiredSecretIsMissingWithoutLeakingValues(t *testing.T) {
	path := writeConfig(t, validConfigYAML)
	secret := "do-not-print-this"
	env := validEnvironment()
	env["DB_TX_PASS"] = secret
	delete(env, "DB_DW_PASS")
	_, err := LoadWithLookup(path, func(key string) (string, bool) {
		value, ok := env[key]
		return value, ok
	})
	if err == nil {
		t.Fatal("expected missing environment variable error")
	}
	if strings.Contains(err.Error(), secret) {
		t.Fatalf("error leaked secret value: %v", err)
	}
}

func TestLoadRejectsUnknownYAMLFields(t *testing.T) {
	path := writeConfig(t, strings.Replace(validConfigYAML, "address: ':8088'", "address: ':8088'\n  typo: true", 1))
	_, err := LoadWithLookup(path, func(string) (string, bool) { return "x", true })
	if err == nil || !strings.Contains(err.Error(), "field typo not found") {
		t.Fatalf("expected unknown-field error, got %v", err)
	}
}

const validConfigYAML = `server:
  address: ':8088'
  read_header_timeout: 5s
  shutdown_timeout: 10s
  readiness_timeout: 2s
  connect_timeout: 5s
databases:
  source:
    host_env: DB_TX_HOST
    port_env: DB_TX_PORT
    name_env: DB_TX_NAME
    user_env: DB_TX_USER
    password_env: DB_TX_PASS
    sslmode_env: DB_TX_SSLMODE
  target:
    host_env: DB_DW_HOST
    port_env: DB_DW_PORT
    name_env: DB_DW_NAME
    user_env: DB_DW_USER
    password_env: DB_DW_PASS
    sslmode_env: DB_DW_SSLMODE
`

func validEnvironment() map[string]string {
	return map[string]string{
		"DB_TX_HOST": "source", "DB_TX_PORT": "5432", "DB_TX_NAME": "source",
		"DB_TX_USER": "reader", "DB_TX_PASS": "source-secret", "DB_TX_SSLMODE": "disable",
		"DB_DW_HOST": "warehouse", "DB_DW_PORT": "5432", "DB_DW_NAME": "dss_dw",
		"DB_DW_USER": "dw_staging_writer", "DB_DW_PASS": "target-secret", "DB_DW_SSLMODE": "disable",
	}
}

func writeConfig(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "loadmanager.yaml")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write config fixture: %v", err)
	}
	return path
}

func mustRead(t *testing.T, path string) []byte {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read config fixture: %v", err)
	}
	return data
}
