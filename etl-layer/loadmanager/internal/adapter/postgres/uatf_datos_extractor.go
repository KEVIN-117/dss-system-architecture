package postgres

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/domain"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/source"
)

const (
	defaultSnapshotBatchSize = 1000
	maxSnapshotBatchSize     = 10000
	uatfStepCode             = "extract_uatf_datos"
	uatfComponentVersion     = "v3-atomic-finalization"
)

var ErrRestartRequired = errors.New("partial snapshot requires a new run_id")

type ExtractionLimits struct {
	MaxDuration            time.Duration
	SourceStatementTimeout time.Duration
	SourceIdleTimeout      time.Duration
	TargetWriteTimeout     time.Duration
}

func DefaultExtractionLimits() ExtractionLimits {
	return ExtractionLimits{30 * time.Minute, 30 * time.Second, 2 * time.Minute, time.Minute}
}

func (l ExtractionLimits) valid() bool {
	return l.MaxDuration >= time.Millisecond && l.SourceStatementTimeout >= time.Millisecond && l.SourceIdleTimeout >= time.Millisecond && l.TargetWriteTimeout >= time.Millisecond
}

type UATFDatosExtractor struct {
	source      *pgxpool.Pool
	target      *pgxpool.Pool
	coordinator *pgxpool.Pool
	slot        chan struct{}
	limits      ExtractionLimits
	logger      *slog.Logger
	query       string
	queryHash   string

	// afterPage is a deterministic crash-injection seam used by integration tests.
	beforePageCommit         func(context.Context, int64) error
	afterPage                func(context.Context, int64) error
	afterSourceComplete      func(context.Context) error
	beforeFinalizationCommit func(context.Context) error
}

type SnapshotRequest struct {
	RunID          domain.RunID
	Actor          string
	ExecutionKind  domain.ExecutionKind
	Period         *domain.AcademicPeriod
	ClosureID      *int64
	RetryOfRunID   *domain.RunID
	RequestedCutAt *time.Time
	BatchSize      int
}

type ExtractedSnapshot struct {
	RunID        string
	RecordCount  int64
	ByteCount    int64
	BatchCount   int64
	RowSHA256    string
	SchemaSHA256 string
}

type extractionCheckpoint struct {
	Version            int     `json:"version"`
	RequestFingerprint string  `json:"request_fingerprint"`
	QuerySHA256        string  `json:"query_sha256"`
	SchemaSHA256       string  `json:"schema_sha256,omitempty"`
	BatchSize          int     `json:"batch_size"`
	LastIDRA           *string `json:"last_id_ra,omitempty"`
	RecordCount        int64   `json:"record_count"`
	ByteCount          int64   `json:"byte_count"`
	BatchCount         int64   `json:"batch_count"`
	SourceComplete     bool    `json:"source_complete,omitempty"`
	RowSHA256          string  `json:"row_sha256,omitempty"`
	// V1 is retained only so completed historical runs remain readable.
	HashState string `json:"sha256_state,omitempty"`
}

func NewUATFDatosExtractor(sourcePool, targetPool, coordinatorPool *Pool, query []byte, limits ExtractionLimits) (*UATFDatosExtractor, error) {
	if sourcePool == nil || targetPool == nil || coordinatorPool == nil ||
		sourcePool.pool == nil || targetPool.pool == nil || coordinatorPool.pool == nil ||
		coordinatorPool.pool == targetPool.pool || len(query) == 0 || !limits.valid() {
		return nil, errors.New("separate source, target, coordinator pools, approved query, and positive limits are required")
	}
	validatedQuery, err := source.ValidateUATFDatosQuery(query)
	if err != nil {
		return nil, err
	}
	return &UATFDatosExtractor{
		source: sourcePool.pool, target: targetPool.pool, coordinator: coordinatorPool.pool,
		slot: make(chan struct{}, 1), limits: limits, logger: slog.Default(),
		query: string(validatedQuery), queryHash: source.QuerySHA256(validatedQuery),
	}, nil
}

// Extract stages one source-observed snapshot. Partial reads are never resumed.
func (e *UATFDatosExtractor) Extract(ctx context.Context, request SnapshotRequest) (ExtractedSnapshot, error) {
	if err := validateSnapshotRequest(&request); err != nil {
		return ExtractedSnapshot{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, e.limits.MaxDuration)
	defer cancel()
	select {
	case e.slot <- struct{}{}:
		defer func() { <-e.slot }()
	case <-ctx.Done():
		return ExtractedSnapshot{}, errors.New("extraction slot wait exceeded its deadline")
	}
	requestFingerprint, err := snapshotRequestFingerprint(request)
	if err != nil {
		return ExtractedSnapshot{}, errors.New("could not identify snapshot request")
	}
	runID := uuid.UUID(request.RunID)
	releaseRunLock, err := e.acquireRunLock(ctx, runID)
	if err != nil {
		return ExtractedSnapshot{}, err
	}
	defer releaseRunLock()
	_, err = e.prepareExecution(ctx, request)
	if err != nil {
		return ExtractedSnapshot{}, err
	}
	var executionStarted time.Time
	if err := e.target.QueryRow(ctx, `SELECT started_at FROM etl_control.etl_execution WHERE run_id = $1`, runID).Scan(&executionStarted); err != nil {
		return ExtractedSnapshot{}, errors.New("could not read execution start time")
	}
	stepID, checkpoint, err := e.prepareCheckpoint(ctx, request, requestFingerprint)
	if err != nil {
		return ExtractedSnapshot{}, err
	}
	completed, result, err := e.completedSnapshot(ctx, runID, request.RunID.String(), stepID, checkpoint)
	if err != nil {
		return ExtractedSnapshot{}, err
	}
	if completed {
		return result, nil
	}
	if checkpoint.SourceComplete {
		if err := e.finalizeCompletedSource(ctx, runID, stepID, checkpoint, time.Since(executionStarted)); err != nil {
			return ExtractedSnapshot{}, errors.New("source is complete but manifest finalization was not confirmed; retry the same run_id")
		}
		return snapshotFromCheckpoint(request.RunID.String(), checkpoint), nil
	}
	if checkpoint.Version == 1 || checkpoint.BatchCount > 0 {
		return ExtractedSnapshot{}, errors.Join(ErrRestartRequired, e.fail(runID, request.Actor, stepID, "abandoned partial snapshot", nil))
	}
	manifestID, err := e.registerPendingManifest(ctx, runID)
	if err != nil {
		return ExtractedSnapshot{}, e.fail(runID, request.Actor, stepID, "could not register source manifest", err)
	}
	if err := e.verifyStagedCheckpoint(ctx, runID, checkpoint); err != nil {
		return ExtractedSnapshot{}, e.fail(runID, request.Actor, stepID, "staging does not match its checkpoint", err)
	}

	result, err = e.extractPages(ctx, request, runID, stepID, checkpoint, sha256.New())
	if err != nil {
		return ExtractedSnapshot{}, e.fail(runID, request.Actor, stepID, "source snapshot failed", err)
	}

	if err := e.verifyStagedCheckpoint(ctx, runID, checkpoint); err != nil {
		return ExtractedSnapshot{}, e.fail(runID, request.Actor, stepID, "staging count does not reconcile", err)
	}
	result.RunID = request.RunID.String()
	checkpoint.SourceComplete = true
	checkpoint.RowSHA256 = result.RowSHA256
	if err := e.saveCheckpoint(ctx, runID, checkpoint); err != nil {
		// A lost commit acknowledgement is ambiguous. Reconciliation checks the
		// persisted marker before deciding whether to finalize or fail this run.
		return ExtractedSnapshot{}, errors.New("source completion checkpoint was not confirmed; reconcile this run_id")
	}
	if e.afterSourceComplete != nil {
		if err := e.afterSourceComplete(ctx); err != nil {
			return ExtractedSnapshot{}, errors.New("source completion persisted; retry metadata finalization with the same run_id")
		}
	}
	if err := e.completeSnapshot(ctx, runID, stepID, manifestID, result, checkpoint, time.Since(executionStarted)); err != nil {
		return ExtractedSnapshot{}, errors.New("source is complete but manifest finalization was not confirmed; retry the same run_id")
	}
	return result, nil
}

func (e *UATFDatosExtractor) acquireRunLock(ctx context.Context, runID uuid.UUID) (func(), error) {
	connection, err := e.coordinator.Acquire(ctx)
	if err != nil {
		return nil, errors.New("could not acquire execution coordinator connection")
	}
	var acquired bool
	if err := connection.QueryRow(ctx, `SELECT pg_try_advisory_lock(hashtext($1), hashtext('loadmanager:dw-011'))`, runID.String()).Scan(&acquired); err != nil {
		connection.Release()
		return nil, errors.New("could not acquire execution coordinator lock")
	}
	if !acquired {
		connection.Release()
		return nil, errors.New("this run_id is already being processed")
	}
	return func() {
		unlockCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		var released bool
		err := connection.QueryRow(unlockCtx, `SELECT pg_advisory_unlock(hashtext($1), hashtext('loadmanager:dw-011'))`, runID.String()).Scan(&released)
		if err != nil || !released {
			_ = connection.Conn().Close(unlockCtx)
		}
		connection.Release()
	}, nil
}

func validateSnapshotRequest(request *SnapshotRequest) error {
	if request == nil || request.RunID.IsZero() || strings.TrimSpace(request.Actor) == "" {
		return errors.New("run_id and actor are required")
	}
	if request.ExecutionKind == "" {
		request.ExecutionKind = domain.ExecutionHistorical
	}
	if request.BatchSize == 0 {
		request.BatchSize = defaultSnapshotBatchSize
	}
	if request.BatchSize < 1 || request.BatchSize > maxSnapshotBatchSize {
		return fmt.Errorf("batch size must be between 1 and %d", maxSnapshotBatchSize)
	}
	if request.RequestedCutAt != nil {
		cut := request.RequestedCutAt.UTC()
		request.RequestedCutAt = &cut
	}
	_, err := domain.NewExecution(domain.NewExecutionInput{
		RunID: request.RunID, Kind: request.ExecutionKind, RequestedBy: request.Actor,
		Period: request.Period, ClosureID: request.ClosureID, RetryOfRunID: request.RetryOfRunID,
		RequestedCutAt: request.RequestedCutAt,
	})
	return err
}

func snapshotRequestFingerprint(request SnapshotRequest) (string, error) {
	canonical := struct {
		Kind           domain.ExecutionKind   `json:"kind"`
		Period         *domain.AcademicPeriod `json:"period,omitempty"`
		ClosureID      *int64                 `json:"closure_id,omitempty"`
		RetryOfRunID   *domain.RunID          `json:"retry_of_run_id,omitempty"`
		RequestedCutAt *time.Time             `json:"requested_cut_at,omitempty"`
		BatchSize      int                    `json:"batch_size"`
	}{request.ExecutionKind, request.Period, request.ClosureID, request.RetryOfRunID, request.RequestedCutAt, request.BatchSize}
	encoded, err := json.Marshal(canonical)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", sha256.Sum256(encoded)), nil
}

func (e *UATFDatosExtractor) prepareExecution(ctx context.Context, request SnapshotRequest) (string, error) {
	runID := uuid.UUID(request.RunID)
	var status, kind, actor string
	var closureID pgtype.Int8
	var gestion, periodo pgtype.Int2
	var cutAt pgtype.Timestamptz
	var retryID pgtype.UUID
	readExecution := func() error {
		return e.target.QueryRow(ctx, `SELECT status, execution_kind, requested_by, closure_id, requested_gestion,
requested_periodo, requested_cut_at, retry_of_run_id
FROM etl_control.etl_execution WHERE run_id = $1`, runID).Scan(
			&status, &kind, &actor, &closureID, &gestion, &periodo, &cutAt, &retryID)
	}
	err := readExecution()
	if errors.Is(err, pgx.ErrNoRows) {
		writeCtx, cancel := context.WithTimeout(ctx, e.limits.TargetWriteTimeout)
		defer cancel()
		var created uuid.UUID
		if err := e.target.QueryRow(writeCtx, `SELECT execution.run_id FROM etl_control.create_etl_execution(
 $1::uuid, $2::varchar(24), $3::varchar(255), $4::bigint, $5::smallint, $6::smallint,
 $7::timestamptz, $8::uuid
) AS execution`, runID, request.ExecutionKind, request.Actor, request.ClosureID,
			periodValue(request.Period, true), periodValue(request.Period, false), request.RequestedCutAt, nullableRunID(request.RetryOfRunID)).Scan(&created); err != nil {
			return "", errors.New("could not create ETL execution")
		}
		if err := readExecution(); err != nil {
			return "", errors.New("could not inspect created ETL execution")
		}
	} else if err != nil {
		return "", errors.New("could not inspect ETL execution")
	}
	if kind != string(request.ExecutionKind) || actor != request.Actor || !storedRequestMatches(request, closureID, gestion, periodo, cutAt, retryID) {
		return "", errors.New("run_id belongs to different snapshot parameters")
	}
	if status == string(domain.ExecutionRequested) {
		writeCtx, cancel := context.WithTimeout(ctx, e.limits.TargetWriteTimeout)
		defer cancel()
		var started uuid.UUID
		if err := e.target.QueryRow(writeCtx, `SELECT execution.run_id FROM etl_control.start_etl_execution(
 $1::uuid, $2::varchar(255), 'Starting paginated approved uatf_datos snapshot'::text
) AS execution`, runID, request.Actor).Scan(&started); err != nil {
			return "", errors.New("could not start ETL execution")
		}
		return string(domain.ExecutionRunning), nil
	}
	if status != string(domain.ExecutionRunning) {
		return "", errors.New("only a requested or active run can start or resume extraction")
	}
	return status, nil
}

func storedRequestMatches(request SnapshotRequest, closureID pgtype.Int8, gestion, periodo pgtype.Int2, cutAt pgtype.Timestamptz, retryID pgtype.UUID) bool {
	if (request.ClosureID == nil) != !closureID.Valid {
		return false
	}
	if request.ClosureID != nil && closureID.Int64 != *request.ClosureID {
		return false
	}
	if request.RetryOfRunID == nil {
		if retryID.Valid {
			return false
		}
	} else if !retryID.Valid || uuid.UUID(retryID.Bytes) != uuid.UUID(*request.RetryOfRunID) {
		return false
	}
	if request.Period != nil {
		if !gestion.Valid || !periodo.Valid || gestion.Int16 != request.Period.Year || periodo.Int16 != request.Period.Period {
			return false
		}
	} else if request.ClosureID == nil && (gestion.Valid || periodo.Valid) {
		return false
	}
	if request.RequestedCutAt != nil {
		return cutAt.Valid && cutAt.Time.Equal(*request.RequestedCutAt)
	}
	return request.ClosureID != nil || !cutAt.Valid
}

func periodValue(period *domain.AcademicPeriod, year bool) any {
	if period == nil {
		return nil
	}
	if year {
		return period.Year
	}
	return period.Period
}

func nullableRunID(runID *domain.RunID) any {
	if runID == nil {
		return nil
	}
	return uuid.UUID(*runID)
}
