package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/adapter/postgres"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/config"
)

func main() {
	if err := run(); err != nil {
		log.Printf("RAW snapshot verification failed: %v", err)
		os.Exit(1)
	}
}

func run() error {
	runID := flag.String("run-id", "", "completed DW execution UUID")
	flag.Parse()
	if *runID == "" {
		return errors.New("-run-id is required")
	}
	database, err := targetDatabase(os.LookupEnv)
	if err != nil {
		return err
	}
	rawRoot := os.Getenv("DW_RAW_ROOT")
	if rawRoot == "" {
		return errors.New("DW_RAW_ROOT is required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	target, err := postgres.NewPool(ctx, "dw-raw-readiness-check", database, false, 2, 10*time.Second)
	if err != nil {
		return errors.New("could not initialize DW verification connection")
	}
	defer target.Close()
	result, err := postgres.VerifyRawBundle(ctx, target, rawRoot, *runID)
	if err != nil {
		return err
	}
	fmt.Printf("RAW bundle eligible: run_id=%s sources=%d artifacts=%d rows=%d bytes=%d\n",
		result.RunID, result.SourceCount, result.ArtifactCount, result.RecordCount, result.ByteCount)
	return nil
}

func targetDatabase(lookup func(string) (string, bool)) (config.Database, error) {
	read := func(name string) (string, error) {
		value, ok := lookup(name)
		if !ok || value == "" {
			return "", fmt.Errorf("required environment variable %s is missing", name)
		}
		return value, nil
	}
	host, err := read("DB_DW_HOST")
	if err != nil {
		return config.Database{}, err
	}
	portText, err := read("DB_DW_PORT")
	if err != nil {
		return config.Database{}, err
	}
	port, err := strconv.ParseUint(portText, 10, 16)
	if err != nil || port == 0 {
		return config.Database{}, errors.New("DB_DW_PORT must be between 1 and 65535")
	}
	name, err := read("DB_DW_NAME")
	if err != nil {
		return config.Database{}, err
	}
	user, err := read("DB_DW_USER")
	if err != nil {
		return config.Database{}, err
	}
	password, err := read("DB_DW_PASS")
	if err != nil {
		return config.Database{}, err
	}
	sslMode, ok := lookup("DB_DW_SSLMODE")
	if !ok || sslMode == "" {
		sslMode = "disable"
	}
	database := config.Database{Host: host, Port: uint16(port), Name: name, User: user, Password: password, SSLMode: sslMode}
	switch database.SSLMode {
	case "disable", "require", "verify-ca", "verify-full":
	default:
		return config.Database{}, errors.New("DW verification connection settings are invalid")
	}
	return database, nil
}
