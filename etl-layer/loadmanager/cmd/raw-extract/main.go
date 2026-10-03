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

	"github.com/google/uuid"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/adapter/postgres"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/config"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/domain"
)

func main() {
	if err := run(); err != nil {
		log.Printf("RAW snapshot extraction failed: %v", err)
		os.Exit(1)
	}
}

func run() error {
	runIDText := flag.String("run-id", "", "new UUID for this extraction attempt")
	actor := flag.String("actor", "", "authenticated or operational requester identity")
	year := flag.Int("year", 0, "academic year of the snapshot cut")
	periodNumber := flag.Int("period", 0, "academic period code of the snapshot cut")
	cutAtText := flag.String("cut-at", "", "optional RFC3339 cutoff timestamp")
	batchSize := flag.Int("batch-size", 500, "maximum rows per deterministic file part")
	flag.Parse()
	if *runIDText == "" || *actor == "" || *year < 2000 || *year > 32767 || *periodNumber < 1 || *periodNumber > 32767 {
		return errors.New("-run-id, -actor, and a valid -year/-period academic cut are required")
	}
	runID, err := uuid.Parse(*runIDText)
	if err != nil {
		return errors.New("-run-id must be a UUID")
	}
	period := &domain.AcademicPeriod{Year: int16(*year), Period: int16(*periodNumber)}
	if err := period.Validate(); err != nil {
		return err
	}
	var cutAt *time.Time
	if *cutAtText != "" {
		parsed, err := time.Parse(time.RFC3339, *cutAtText)
		if err != nil {
			return errors.New("-cut-at must use RFC3339")
		}
		parsed = parsed.UTC()
		cutAt = &parsed
	}
	ctx, cancel := context.WithTimeout(context.Background(), 35*time.Minute)
	defer cancel()
	sourceConfig, err := databaseFromEnv("DB_TX", os.LookupEnv)
	if err != nil {
		return err
	}
	targetConfig, err := databaseFromEnv("DB_DW", os.LookupEnv)
	if err != nil {
		return err
	}
	sourcePool, err := postgres.NewPool(ctx, "jachasun-oltp", sourceConfig, true, 2, 10*time.Second)
	if err != nil {
		return errors.New("could not initialize read-only source pool")
	}
	defer sourcePool.Close()
	targetPool, err := postgres.NewPool(ctx, "dw-postgresql", targetConfig, false, 4, 10*time.Second)
	if err != nil {
		return errors.New("could not initialize DW target pool")
	}
	defer targetPool.Close()
	coordinatorPool, err := postgres.NewPool(ctx, "dw-extraction-coordinator", targetConfig, false, 2, 10*time.Second)
	if err != nil {
		return errors.New("could not initialize extraction coordinator pool")
	}
	defer coordinatorPool.Close()
	queryDirectory := os.Getenv("LOADMANAGER_QUERY_DIR")
	if queryDirectory == "" {
		queryDirectory = "infra/postgres-tx/extract"
	}
	rawRoot := os.Getenv("DW_RAW_ROOT")
	if rawRoot == "" {
		return errors.New("DW_RAW_ROOT is required")
	}
	extractor, err := postgres.NewRawBundleExtractor(sourcePool, targetPool, coordinatorPool,
		queryDirectory, rawRoot, postgres.DefaultExtractionLimits(), 500)
	if err != nil {
		return errors.New("could not initialize approved RAW bundle")
	}
	result, err := extractor.ExtractAll(ctx, postgres.RawBundleRequest{RunID: domain.RunID(runID), Actor: *actor,
		ExecutionKind: domain.ExecutionHistorical, Period: period, RequestedCutAt: cutAt, BatchSize: *batchSize})
	if err != nil {
		return err
	}
	fmt.Printf("RAW snapshot complete: run_id=%s sources=%d artifacts=%d rows=%d bytes=%d\n",
		result.RunID, result.SourceCount, result.ArtifactCount, result.RecordCount, result.ByteCount)
	return nil
}

func databaseFromEnv(prefix string, lookup func(string) (string, bool)) (config.Database, error) {
	read := func(suffix string) (string, error) {
		name := prefix + "_" + suffix
		value, ok := lookup(name)
		if !ok || value == "" {
			return "", fmt.Errorf("required environment variable %s is missing", name)
		}
		return value, nil
	}
	host, err := read("HOST")
	if err != nil {
		return config.Database{}, err
	}
	portText, err := read("PORT")
	if err != nil {
		return config.Database{}, err
	}
	port, err := strconv.ParseUint(portText, 10, 16)
	if err != nil || port == 0 {
		return config.Database{}, fmt.Errorf("%s_PORT must be between 1 and 65535", prefix)
	}
	name, err := read("NAME")
	if err != nil {
		return config.Database{}, err
	}
	user, err := read("USER")
	if err != nil {
		return config.Database{}, err
	}
	password, err := read("PASS")
	if err != nil {
		return config.Database{}, err
	}
	sslMode, ok := lookup(prefix + "_SSLMODE")
	if !ok || sslMode == "" {
		sslMode = "disable"
	}
	switch sslMode {
	case "disable", "require", "verify-ca", "verify-full":
	default:
		return config.Database{}, fmt.Errorf("%s_SSLMODE is invalid", prefix)
	}
	return config.Database{Host: host, Port: uint16(port), Name: name, User: user, Password: password, SSLMode: sslMode}, nil
}
