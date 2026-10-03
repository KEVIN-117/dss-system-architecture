package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/domain"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/source"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/staging"
)

const (
	rawBundleStepCode = "extract_raw_bundle"
	rawBundleGateStep = "verify_raw_bundle"
	rawBundleVersion  = "dw012-jsonl-gzip-v1"
	rawBundleLockName = "loadmanager:dw-011"
)

type RawBundleRequest struct {
	RunID          domain.RunID
	Actor          string
	ExecutionKind  domain.ExecutionKind
	Period         *domain.AcademicPeriod
	ClosureID      *int64
	RetryOfRunID   *domain.RunID
	RequestedCutAt *time.Time
	BatchSize      int
}

type RawBundleResult struct {
	RunID         string
	SourceCount   int
	ArtifactCount int64
	RecordCount   int64
	ByteCount     int64
	CompletedAt   time.Time
}

type rawBundleCheckpoint struct {
	Version        int                   `json:"version"`
	RequestSHA256  string                `json:"request_sha256"`
	SourceComplete bool                  `json:"source_complete"`
	Sources        []rawSourceCheckpoint `json:"sources"`
	CompletedAt    *time.Time            `json:"completed_at,omitempty"`
}

type rawSourceCheckpoint struct {
	ContractID   string  `json:"contract_id"`
	QuerySHA256  string  `json:"query_sha256"`
	SchemaSHA256 string  `json:"schema_sha256,omitempty"`
	LastKey      []any   `json:"last_key,omitempty"`
	RecordCount  int64   `json:"record_count"`
	ByteCount    int64   `json:"byte_count"`
	PartCount    int64   `json:"part_count"`
	ArtifactIDs  []int64 `json:"artifact_ids,omitempty"`
}

type rawBundleStep struct {
	StepID  int64
	Status  string
	Details rawBundleCheckpoint
}

type RawBundleExtractor struct {
	source              *Pool
	target              *Pool
	coordinator         *Pool
	archive             *staging.Archive
	queries             map[string][]byte
	limits              ExtractionLimits
	pageSize            int
	afterSourceComplete func(context.Context) error
	extractionSlot      chan struct{}
}

func NewRawBundleExtractor(sourcePool, targetPool, coordinatorPool *Pool, queryDirectory, rawRoot string, limits ExtractionLimits, pageSize int) (*RawBundleExtractor, error) {
	if sourcePool == nil || targetPool == nil || coordinatorPool == nil || sourcePool.pool == nil || targetPool.pool == nil || coordinatorPool.pool == nil ||
		sourcePool == targetPool || sourcePool == coordinatorPool || targetPool == coordinatorPool || !limits.valid() || pageSize < 1 || pageSize > maxSnapshotBatchSize {
		return nil, errors.New("separate source, target, coordinator pools, archive root, and valid limits are required")
	}
	queries, err := source.LoadApprovedQueries(queryDirectory)
	if err != nil {
		return nil, err
	}
	archive, err := staging.NewArchive(rawRoot)
	if err != nil {
		return nil, err
	}
	return &RawBundleExtractor{source: sourcePool, target: targetPool, coordinator: coordinatorPool, archive: archive,
		queries: queries, limits: limits, pageSize: pageSize, extractionSlot: make(chan struct{}, 1)}, nil
}

func (e *RawBundleExtractor) ExtractAll(ctx context.Context, request RawBundleRequest) (RawBundleResult, error) {
	if e == nil || ctx == nil || request.RunID.IsZero() || strings.TrimSpace(request.Actor) == "" || request.Period == nil {
		return RawBundleResult{}, errors.New("bundle extraction requires run_id, actor, and an academic cut")
	}
	if err := request.Period.Validate(); err != nil {
		return RawBundleResult{}, err
	}
	if request.BatchSize == 0 {
		request.BatchSize = e.pageSize
	}
	if request.BatchSize < 1 || request.BatchSize > maxSnapshotBatchSize {
		return RawBundleResult{}, fmt.Errorf("batch size must be between 1 and %d", maxSnapshotBatchSize)
	}
	if request.ExecutionKind == "" {
		request.ExecutionKind = domain.ExecutionHistorical
	}
	if _, err := domain.NewExecution(domain.NewExecutionInput{RunID: request.RunID, Kind: request.ExecutionKind, RequestedBy: request.Actor,
		Period: request.Period, ClosureID: request.ClosureID, RetryOfRunID: request.RetryOfRunID, RequestedCutAt: request.RequestedCutAt}); err != nil {
		return RawBundleResult{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, e.limits.MaxDuration)
	defer cancel()
	select {
	case e.extractionSlot <- struct{}{}:
		defer func() { <-e.extractionSlot }()
	case <-ctx.Done():
		return RawBundleResult{}, errors.New("timed out waiting for the process extraction slot")
	}
	lock, err := e.acquireBundleLock(ctx, uuid.UUID(request.RunID))
	if err != nil {
		return RawBundleResult{}, err
	}
	defer lock()
	requestHash, err := rawBundleRequestHash(request)
	if err != nil {
		return RawBundleResult{}, errors.New("could not fingerprint raw bundle request")
	}
	if err := e.ensureBundleExecution(ctx, request); err != nil {
		return RawBundleResult{}, err
	}
	step, err := e.loadOrCreateBundleStep(ctx, request, requestHash)
	if err != nil {
		return RawBundleResult{}, err
	}
	if step.Status == "EXITOSO" {
		return e.verifyCompletedBundle(ctx, request.RunID.String())
	}
	if step.Details.SourceComplete {
		return e.finalizeBundle(ctx, request, step)
	}
	if len(step.Details.Sources) != 0 {
		return RawBundleResult{}, errors.Join(ErrRestartRequired, e.failBundle(ctx, request, step, "interrupted raw bundle requires a new run_id"))
	}
	if err := e.beginBundleSources(ctx, request); err != nil {
		return RawBundleResult{}, e.failBundle(ctx, request, step, "could not create source manifests", err)
	}
	sourceTx, err := e.beginSourceSnapshot(ctx)
	if err != nil {
		return RawBundleResult{}, e.failBundle(ctx, request, step, "could not begin read-only OLTP snapshot", err)
	}
	defer sourceTx.Rollback(context.Background())

	checkpoint := step.Details
	checkpoint.Sources = make([]rawSourceCheckpoint, 0, len(source.Contracts()))
	for _, spec := range source.Contracts() {
		query := e.queries[spec.Contract.ID]
		result, err := e.extractRawSource(ctx, sourceTx, request, step.StepID, spec, query, &checkpoint)
		if err != nil {
			return RawBundleResult{}, e.failBundle(ctx, request, rawBundleStep{StepID: step.StepID, Details: checkpoint}, "source snapshot failed", err)
		}
		checkpoint.Sources = appendOrReplaceSource(checkpoint.Sources, result)
		if err := e.saveBundleCheckpoint(ctx, request.RunID, step.StepID, checkpoint, "EN_EJECUCION"); err != nil {
			return RawBundleResult{}, errors.New("could not persist source bundle checkpoint")
		}
	}
	if err := sourceTx.Commit(ctx); err != nil {
		return RawBundleResult{}, e.failBundle(ctx, request, rawBundleStep{StepID: step.StepID, Details: checkpoint}, "OLTP snapshot could not be committed", err)
	}
	completedAt := time.Now().UTC()
	checkpoint.SourceComplete = true
	checkpoint.CompletedAt = &completedAt
	if err := e.saveBundleCheckpoint(ctx, request.RunID, step.StepID, checkpoint, "EN_EJECUCION"); err != nil {
		return RawBundleResult{}, errors.New("source bundle completed but checkpoint confirmation was lost; retry the same run_id")
	}
	if e.afterSourceComplete != nil {
		if err := e.afterSourceComplete(ctx); err != nil {
			return RawBundleResult{}, errors.New("source bundle completion is persisted; retry metadata finalization with the same run_id")
		}
	}
	return e.finalizeBundle(ctx, request, rawBundleStep{StepID: step.StepID, Details: checkpoint})
}

func (e *RawBundleExtractor) extractRawSource(ctx context.Context, sourceTx pgx.Tx, request RawBundleRequest, bundleStepID int64,
	spec source.ContractSpec, query []byte, bundle *rawBundleCheckpoint) (rawSourceCheckpoint, error) {
	contract := spec.Contract
	queryHash := spec.QuerySHA
	stepCode := rawSourceStepCode(contract.ID)
	stepID, existing, err := e.prepareRawSourceStep(ctx, request.RunID, stepCode, contract.ID, queryHash)
	if err != nil {
		return rawSourceCheckpoint{}, err
	}
	if existing.PartCount > 0 {
		return rawSourceCheckpoint{}, ErrRestartRequired
	}
	manifestID, err := e.registerRawManifest(ctx, request, spec, queryHash)
	if err != nil {
		return rawSourceCheckpoint{}, err
	}
	queryText := string(query)
	var args []any
	if contract.ID == source.UATFDatosContractID {
		args = []any{nil, request.BatchSize + 1}
	} else if contract.SnapshotPolicy == domain.SnapshotAcademicCut {
		queryText = strings.ReplaceAll(queryText, ":snapshot_gestion", "$1::smallint")
		queryText = strings.ReplaceAll(queryText, ":snapshot_periodo", "$2::smallint")
		args = []any{request.Period.Year, request.Period.Period}
	}
	page := make([][]any, 0, request.BatchSize)
	part := int64(0)
	var columns []string
	var schemaHash string
	previousNaturalKey := ""
	var lastKey []any
	flush := func() error {
		if len(page) == 0 {
			return nil
		}
		part++
		artifact, err := e.archive.WritePart(ctx, contract.ID, request.RunID.String(), part, columns, page)
		if err != nil {
			return err
		}
		current := rawSourceCheckpoint{ContractID: contract.ID, QuerySHA256: queryHash, SchemaSHA256: schemaHash,
			RecordCount: existing.RecordCount + int64(len(page)), ByteCount: existing.ByteCount + artifact.ByteCount,
			PartCount: part, ArtifactIDs: append(existing.ArtifactIDs, int64(0)), LastKey: append([]any(nil), lastKey...)}
		checkpoint := *bundle
		checkpoint.Sources = appendOrReplaceSource(checkpoint.Sources, current)
		checkpointBytes, err := json.Marshal(current)
		if err != nil {
			return errors.New("could not encode extraction checkpoint")
		}
		writeCtx, cancel := context.WithTimeout(ctx, e.limits.TargetWriteTimeout)
		defer cancel()
		tx, err := e.target.pool.BeginTx(writeCtx, pgx.TxOptions{})
		if err != nil {
			return errors.New("could not begin RAW manifest transaction")
		}
		defer tx.Rollback(writeCtx)
		var savedArtifactID int64
		if err := tx.QueryRow(writeCtx, `SELECT artifact.artifact_id FROM etl_control.register_etl_source_manifest_artifact(
 $1::bigint, 'RAW_EXTRACT'::varchar(32), $2::text, $3::char(64), $4::bigint, $5::bigint
) AS artifact`, manifestID, artifact.URI, artifact.SHA256, artifact.ByteCount, artifact.RecordCount).Scan(&savedArtifactID); err != nil {
			return errors.New("could not register RAW part metadata")
		}
		current.ArtifactIDs[len(current.ArtifactIDs)-1] = savedArtifactID
		checkpoint.Sources[len(checkpoint.Sources)-1] = current
		checkpointBytes, err = json.Marshal(current)
		if err != nil {
			return errors.New("could not encode committed source checkpoint")
		}
		if err := registerRawStepTx(writeCtx, tx, request.RunID, stepID, stepCode, "EN_EJECUCION", contract.ID, checkpointBytes); err != nil {
			return errors.New("could not register RAW checkpoint")
		}
		bundleBytes, err := json.Marshal(checkpoint)
		if err != nil {
			return errors.New("could not encode bundle checkpoint")
		}
		if err := registerRawStepTx(writeCtx, tx, request.RunID, bundleStepID, rawBundleStepCode, "EN_EJECUCION", "bundle", bundleBytes); err != nil {
			return errors.New("could not register bundle checkpoint")
		}
		if err := tx.Commit(writeCtx); err != nil {
			return errors.New("could not commit RAW artifact checkpoint")
		}
		bundle.Sources = checkpoint.Sources
		existing = current
		page = page[:0]
		return nil
	}
	consume := func(rows pgx.Rows) error {
		defer rows.Close()
		fields := rows.FieldDescriptions()
		if columns == nil {
			columnOIDs := make([]uint32, len(fields))
			modifiers := make([]int32, len(fields))
			columns = make([]string, len(fields))
			for index, field := range fields {
				columns[index], columnOIDs[index], modifiers[index] = field.Name, field.DataTypeOID, field.TypeModifier
			}
			if err := source.ValidateContractColumns(contract, columns, columnOIDs); err != nil {
				return err
			}
			if err := source.ValidateContractTypeModifiers(contract, columns, modifiers); err != nil {
				return err
			}
			schemaHash = rawSchemaHash(contract, fields)
			if err := e.saveRawSchemaCheckpoint(ctx, request.RunID, stepID, stepCode, contract.ID, queryHash, schemaHash); err != nil {
				return err
			}
		}
		for rows.Next() {
			values, err := rows.Values()
			if err != nil {
				return errors.New("could not decode source row")
			}
			key, err := source.ValidateContractRow(contract, columns, values, previousNaturalKey)
			if err != nil {
				return err
			}
			previousNaturalKey = key
			lastKey = stableKeyValues(contract, columns, values)
			page = append(page, values)
			if len(page) >= request.BatchSize {
				if err := flush(); err != nil {
					return err
				}
			}
		}
		if err := rows.Err(); err != nil {
			return errors.New("source stream failed")
		}
		if len(page) > 0 {
			if err := flush(); err != nil {
				return err
			}
		}
		return nil
	}
	if contract.ID == source.UATFDatosContractID {
		var cursor any
		for {
			rows, err := sourceTx.Query(ctx, queryText, cursor, request.BatchSize+1)
			if err != nil {
				return rawSourceCheckpoint{}, errors.New("approved source page query failed")
			}
			fields := rows.FieldDescriptions()
			if columns == nil {
				columns = make([]string, len(fields))
				oids := make([]uint32, len(fields))
				modifiers := make([]int32, len(fields))
				for index, field := range fields {
					columns[index], oids[index], modifiers[index] = field.Name, field.DataTypeOID, field.TypeModifier
				}
				if err := source.ValidateContractColumns(contract, columns, oids); err != nil {
					rows.Close()
					return rawSourceCheckpoint{}, err
				}
				if err := source.ValidateContractTypeModifiers(contract, columns, modifiers); err != nil {
					rows.Close()
					return rawSourceCheckpoint{}, err
				}
				schemaHash = rawSchemaHash(contract, fields)
				if err := e.saveRawSchemaCheckpoint(ctx, request.RunID, stepID, stepCode, contract.ID, queryHash, schemaHash); err != nil {
					rows.Close()
					return rawSourceCheckpoint{}, err
				}
			}
			var valuesPage [][]any
			var previousKey *string
			for rows.Next() {
				values, err := rows.Values()
				if err != nil {
					rows.Close()
					return rawSourceCheckpoint{}, errors.New("could not decode source row")
				}
				key, err := validateUATFKey(values, previousKey)
				if err != nil {
					rows.Close()
					return rawSourceCheckpoint{}, err
				}
				if _, err := source.ValidateContractRow(contract, columns, values, ""); err != nil {
					rows.Close()
					return rawSourceCheckpoint{}, err
				}
				valuesPage = append(valuesPage, values)
				previousKey = &key
			}
			if err := rows.Err(); err != nil {
				rows.Close()
				return rawSourceCheckpoint{}, errors.New("source page stream failed")
			}
			rows.Close()
			if len(valuesPage) == 0 {
				break
			}
			if len(valuesPage) > request.BatchSize {
				valuesPage = valuesPage[:request.BatchSize]
			}
			lastKey = stableKeyValues(contract, columns, valuesPage[len(valuesPage)-1])
			page = append(page, valuesPage...)
			if err := flush(); err != nil {
				return rawSourceCheckpoint{}, err
			}
			cursor = valuesPage[len(valuesPage)-1][0]
			bundle.Sources = appendOrReplaceSource(bundle.Sources, rawSourceCheckpoint{ContractID: contract.ID, QuerySHA256: queryHash,
				SchemaSHA256: schemaHash, LastKey: []any{cursor}, RecordCount: existing.RecordCount, ByteCount: existing.ByteCount, PartCount: part, ArtifactIDs: existing.ArtifactIDs})
			if len(valuesPage) < request.BatchSize {
				break
			}
		}
	} else {
		rows, err := sourceTx.Query(ctx, queryText, args...)
		if err != nil {
			return rawSourceCheckpoint{}, errors.New("approved source query failed")
		}
		if err := consume(rows); err != nil {
			return rawSourceCheckpoint{}, err
		}
	}
	if columns == nil {
		return rawSourceCheckpoint{}, errors.New("source query returned no schema")
	}
	if part == 0 {
		artifact, err := e.archive.WritePart(ctx, contract.ID, request.RunID.String(), 1, columns, nil)
		if err != nil {
			return rawSourceCheckpoint{}, err
		}
		part = 1
		writeCtx, cancel := context.WithTimeout(ctx, e.limits.TargetWriteTimeout)
		defer cancel()
		var artifactID int64
		if err := e.target.pool.QueryRow(writeCtx, `SELECT artifact.artifact_id FROM etl_control.register_etl_source_manifest_artifact(
 $1::bigint, 'RAW_EXTRACT'::varchar(32), $2::text, $3::char(64), $4::bigint, $5::bigint
) AS artifact`, manifestID, artifact.URI, artifact.SHA256, artifact.ByteCount, int64(0)).Scan(&artifactID); err != nil {
			return rawSourceCheckpoint{}, err
		}
		existing.ArtifactIDs = append(existing.ArtifactIDs, artifactID)
	}
	return rawSourceCheckpoint{ContractID: contract.ID, QuerySHA256: queryHash, SchemaSHA256: schemaHash,
		RecordCount: existing.RecordCount, ByteCount: existing.ByteCount, PartCount: part, ArtifactIDs: existing.ArtifactIDs}, nil
}

func (e *RawBundleExtractor) prepareRawSourceStep(ctx context.Context, runID domain.RunID, code, contractID, queryHash string) (int64, rawSourceCheckpoint, error) {
	uuidRunID := uuid.UUID(runID)
	var stepID int64
	var details []byte
	err := e.target.pool.QueryRow(ctx, `SELECT step_id, details FROM etl_control.etl_execution_step WHERE run_id=$1 AND step_code=$2`, uuidRunID, code).Scan(&stepID, &details)
	if errors.Is(err, pgx.ErrNoRows) {
		encoded, _ := json.Marshal(rawSourceCheckpoint{ContractID: contractID, QuerySHA256: queryHash})
		if err := e.registerRawStep(ctx, runID, code, "PENDIENTE", contractID, encoded); err != nil {
			return 0, rawSourceCheckpoint{}, err
		}
		if err := e.target.pool.QueryRow(ctx, `SELECT step_id, details FROM etl_control.etl_execution_step WHERE run_id=$1 AND step_code=$2`, uuidRunID, code).Scan(&stepID, &details); err != nil {
			return 0, rawSourceCheckpoint{}, err
		}
	} else if err != nil {
		return 0, rawSourceCheckpoint{}, err
	}
	var checkpoint rawSourceCheckpoint
	if err := json.Unmarshal(details, &checkpoint); err != nil {
		return 0, rawSourceCheckpoint{}, errors.New("stored source checkpoint is malformed")
	}
	if checkpoint.ContractID != contractID || checkpoint.QuerySHA256 != queryHash {
		return 0, rawSourceCheckpoint{}, errors.New("source checkpoint does not match approved contract")
	}
	return stepID, checkpoint, nil
}

func (e *RawBundleExtractor) registerRawManifest(ctx context.Context, request RawBundleRequest, spec source.ContractSpec, queryHash string) (int64, error) {
	var id int64
	var cut any
	if request.RequestedCutAt != nil {
		cut = request.RequestedCutAt.UTC()
	}
	if err := e.target.pool.QueryRow(ctx, `SELECT manifest.manifest_id FROM etl_control.register_etl_source_manifest(
 $1::uuid,$2::varchar(150),$3::varchar(64),$4::varchar(63),$5::varchar(63),$6::char(64),$7::text,'PENDIENTE'::varchar(16),
 NULL::char(64),$8::smallint,$9::smallint,$10::timestamptz,NULL::bigint,$11::jsonb) AS manifest`, uuid.UUID(request.RunID), spec.Contract.ID,
		spec.Contract.Version, spec.Contract.Schema, spec.Contract.Object, queryHash, stableOrderString(spec.Contract), request.Period.Year,
		request.Period.Period, cut, `{"format":"JSONL","compression":"GZIP","serializer_version":1}`,
	).Scan(&id); err != nil {
		return 0, errors.New("could not register source manifest")
	}
	return id, nil
}

func (e *RawBundleExtractor) beginSourceSnapshot(ctx context.Context) (pgx.Tx, error) {
	tx, err := e.source.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, errors.New("could not begin read-only repeatable-read transaction")
	}
	if _, err := tx.Exec(ctx, `SELECT set_config('statement_timeout',$1,true),set_config('idle_in_transaction_session_timeout',$2,true)`,
		fmt.Sprintf("%dms", e.limits.SourceStatementTimeout.Milliseconds()), fmt.Sprintf("%dms", e.limits.SourceIdleTimeout.Milliseconds())); err != nil {
		_ = tx.Rollback(ctx)
		return nil, errors.New("could not set source transaction limits")
	}
	return tx, nil
}

func (e *RawBundleExtractor) saveRawSchemaCheckpoint(ctx context.Context, runID domain.RunID, stepID int64, stepCode, contractID, queryHash, schemaHash string) error {
	data, _ := json.Marshal(rawSourceCheckpoint{ContractID: contractID, QuerySHA256: queryHash, SchemaSHA256: schemaHash})
	return e.registerRawStep(ctx, runID, stepCode, "EN_EJECUCION", contractID, data)
}

func stableOrderString(contract domain.SourceContract) string {
	keys := make([]string, 0, len(contract.StableOrder))
	for _, key := range contract.StableOrder {
		keys = append(keys, key+" ASC")
	}
	return strings.Join(keys, ", ")
}

func stableKeyValues(contract domain.SourceContract, columns []string, values []any) []any {
	indices := make(map[string]int, len(columns))
	for index, name := range columns {
		indices[name] = index
	}
	key := make([]any, 0, len(contract.StableOrder))
	for _, name := range contract.StableOrder {
		index, ok := indices[name]
		if !ok || index >= len(values) {
			return nil
		}
		key = append(key, values[index])
	}
	return key
}
