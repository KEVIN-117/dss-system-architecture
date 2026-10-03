package config

import (
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type Database struct {
	Host     string `json:"-"`
	Port     uint16 `json:"-"`
	Name     string `json:"-"`
	User     string `json:"-"`
	Password string `json:"-"`
	SSLMode  string `json:"-"`
}

type Config struct {
	HTTPAddress       string        `json:"http_address"`
	ReadHeaderTimeout time.Duration `json:"read_header_timeout"`
	ShutdownTimeout   time.Duration `json:"shutdown_timeout"`
	ReadinessTimeout  time.Duration `json:"readiness_timeout"`
	ConnectTimeout    time.Duration `json:"connect_timeout"`
	Extraction        Extraction    `json:"extraction"`
	RawRoot           string        `json:"raw_root"`
	Source            Database      `json:"-"`
	Target            Database      `json:"-"`
}

type Extraction struct {
	MaxDuration            time.Duration `json:"max_duration"`
	SourceStatementTimeout time.Duration `json:"source_statement_timeout"`
	SourceIdleTimeout      time.Duration `json:"source_idle_timeout"`
	TargetWriteTimeout     time.Duration `json:"target_write_timeout"`
}

type lookupEnv func(string) (string, bool)

type fileConfig struct {
	Server struct {
		Address           string `yaml:"address"`
		ReadHeaderTimeout string `yaml:"read_header_timeout"`
		ShutdownTimeout   string `yaml:"shutdown_timeout"`
		ReadinessTimeout  string `yaml:"readiness_timeout"`
		ConnectTimeout    string `yaml:"connect_timeout"`
	} `yaml:"server"`
	Extraction struct {
		MaxDuration            string `yaml:"max_duration"`
		SourceStatementTimeout string `yaml:"source_statement_timeout"`
		SourceIdleTimeout      string `yaml:"source_idle_timeout"`
		TargetWriteTimeout     string `yaml:"target_write_timeout"`
	} `yaml:"extraction"`
	Staging struct {
		RawRootEnv string `yaml:"raw_root_env"`
	} `yaml:"staging"`
	Databases struct {
		Source databaseEnv `yaml:"source"`
		Target databaseEnv `yaml:"target"`
	} `yaml:"databases"`
}

type databaseEnv struct {
	Host     string `yaml:"host_env"`
	Port     string `yaml:"port_env"`
	Name     string `yaml:"name_env"`
	User     string `yaml:"user_env"`
	Password string `yaml:"password_env"`
	SSLMode  string `yaml:"sslmode_env"`
}

// Load reads non-secret settings from YAML and resolves every database value
// from the named environment variable. Database credentials are never read
// from, or written back to, the YAML file.
func Load(path string) (Config, error) {
	return LoadWithLookup(path, os.LookupEnv)
}

func LoadWithLookup(path string, lookup func(string) (string, bool)) (Config, error) {
	if lookup == nil {
		return Config{}, errors.New("environment lookup is required")
	}
	if strings.TrimSpace(path) == "" {
		return Config{}, errors.New("configuration file path is required")
	}
	file, err := os.Open(path)
	if err != nil {
		return Config{}, fmt.Errorf("open load manager configuration: %w", err)
	}
	defer file.Close()

	decoder := yaml.NewDecoder(file)
	decoder.KnownFields(true)
	var raw fileConfig
	if err := decoder.Decode(&raw); err != nil {
		return Config{}, fmt.Errorf("decode load manager configuration: %w", err)
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		if err == nil {
			return Config{}, errors.New("configuration file must contain a single YAML document")
		}
		return Config{}, fmt.Errorf("decode trailing configuration document: %w", err)
	}

	readHeaderTimeout, err := time.ParseDuration(strings.TrimSpace(raw.Server.ReadHeaderTimeout))
	if err != nil {
		return Config{}, fmt.Errorf("invalid server.read_header_timeout: %w", err)
	}
	shutdownTimeout, err := time.ParseDuration(strings.TrimSpace(raw.Server.ShutdownTimeout))
	if err != nil {
		return Config{}, fmt.Errorf("invalid server.shutdown_timeout: %w", err)
	}
	readinessTimeout, err := time.ParseDuration(strings.TrimSpace(raw.Server.ReadinessTimeout))
	if err != nil {
		return Config{}, fmt.Errorf("invalid server.readiness_timeout: %w", err)
	}
	connectTimeout, err := time.ParseDuration(strings.TrimSpace(raw.Server.ConnectTimeout))
	if err != nil {
		return Config{}, fmt.Errorf("invalid server.connect_timeout: %w", err)
	}
	extractDuration := func(name, value string, fallback time.Duration) (time.Duration, error) {
		if strings.TrimSpace(value) == "" {
			return fallback, nil
		}
		parsed, err := time.ParseDuration(strings.TrimSpace(value))
		if err != nil || parsed < time.Millisecond {
			return 0, fmt.Errorf("extraction.%s must be a positive duration", name)
		}
		return parsed, nil
	}
	maxDuration, err := extractDuration("max_duration", raw.Extraction.MaxDuration, 30*time.Minute)
	if err != nil {
		return Config{}, err
	}
	sourceStatementTimeout, err := extractDuration("source_statement_timeout", raw.Extraction.SourceStatementTimeout, 30*time.Second)
	if err != nil {
		return Config{}, err
	}
	sourceIdleTimeout, err := extractDuration("source_idle_timeout", raw.Extraction.SourceIdleTimeout, 2*time.Minute)
	if err != nil {
		return Config{}, err
	}
	targetWriteTimeout, err := extractDuration("target_write_timeout", raw.Extraction.TargetWriteTimeout, time.Minute)
	if err != nil {
		return Config{}, err
	}
	source, err := resolveDatabase("source", raw.Databases.Source, lookup)
	if err != nil {
		return Config{}, err
	}
	target, err := resolveDatabase("target", raw.Databases.Target, lookup)
	if err != nil {
		return Config{}, err
	}
	rawRootEnv := strings.TrimSpace(raw.Staging.RawRootEnv)
	if rawRootEnv == "" {
		return Config{}, errors.New("staging.raw_root_env is required")
	}
	rawRoot, ok := lookup(rawRootEnv)
	if !ok || strings.TrimSpace(rawRoot) == "" {
		return Config{}, fmt.Errorf("staging: required environment variable %s is missing", rawRootEnv)
	}
	cfg := Config{
		HTTPAddress:       strings.TrimSpace(raw.Server.Address),
		ReadHeaderTimeout: readHeaderTimeout,
		ShutdownTimeout:   shutdownTimeout,
		ReadinessTimeout:  readinessTimeout,
		ConnectTimeout:    connectTimeout,
		Extraction:        Extraction{maxDuration, sourceStatementTimeout, sourceIdleTimeout, targetWriteTimeout},
		RawRoot:           strings.TrimSpace(rawRoot),
		Source:            source, Target: target,
	}
	if err := cfg.Validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func resolveDatabase(name string, names databaseEnv, lookup lookupEnv) (Database, error) {
	fields := []struct {
		label string
		name  string
	}{
		{"host", names.Host}, {"port", names.Port}, {"name", names.Name},
		{"user", names.User}, {"password", names.Password}, {"sslmode", names.SSLMode},
	}
	values := make([]string, len(fields))
	for i, field := range fields {
		if strings.TrimSpace(field.name) == "" {
			return Database{}, fmt.Errorf("database %s: environment variable name for %s is required", name, field.label)
		}
		value, ok := lookup(strings.TrimSpace(field.name))
		if !ok || strings.TrimSpace(value) == "" {
			return Database{}, fmt.Errorf("database %s: required environment variable %s is missing", name, field.name)
		}
		if field.label == "password" {
			values[i] = value
		} else {
			values[i] = strings.TrimSpace(value)
		}
	}
	port, err := strconv.ParseUint(values[1], 10, 16)
	if err != nil || port == 0 {
		return Database{}, fmt.Errorf("database %s: port from %s must be in range 1..65535", name, fields[1].name)
	}
	sslMode := strings.ToLower(values[5])
	switch sslMode {
	case "disable", "require", "verify-ca", "verify-full":
	default:
		return Database{}, fmt.Errorf("database %s: SSL mode from %s is invalid", name, fields[5].name)
	}
	return Database{
		Host: values[0], Port: uint16(port), Name: values[2], User: values[3], Password: values[4], SSLMode: sslMode,
	}, nil
}

func (c Config) Validate() error {
	if strings.TrimSpace(c.RawRoot) == "" {
		return errors.New("staging.raw_root is required")
	}
	if strings.TrimSpace(c.HTTPAddress) == "" {
		return errors.New("server.address is required")
	}
	if _, _, err := net.SplitHostPort(c.HTTPAddress); err != nil {
		return errors.New("server.address must be a valid host:port address")
	}
	if c.ReadHeaderTimeout <= 0 || c.ShutdownTimeout <= 0 || c.ReadinessTimeout <= 0 || c.ConnectTimeout <= 0 {
		return errors.New("server timeouts must be positive")
	}
	if c.Extraction.MaxDuration < time.Millisecond || c.Extraction.SourceStatementTimeout < time.Millisecond || c.Extraction.SourceIdleTimeout < time.Millisecond || c.Extraction.TargetWriteTimeout < time.Millisecond {
		return errors.New("extraction timeouts must be positive")
	}
	for _, entry := range []struct {
		name string
		db   Database
	}{{"source", c.Source}, {"target", c.Target}} {
		name, db := entry.name, entry.db
		if strings.TrimSpace(db.Host) == "" || db.Port == 0 || strings.TrimSpace(db.Name) == "" ||
			strings.TrimSpace(db.User) == "" || strings.TrimSpace(db.Password) == "" || db.SSLMode == "" {
			return fmt.Errorf("database %s configuration is incomplete", name)
		}
		switch db.SSLMode {
		case "disable", "require", "verify-ca", "verify-full":
		default:
			return fmt.Errorf("database %s SSL mode is invalid", name)
		}
	}
	return nil
}
