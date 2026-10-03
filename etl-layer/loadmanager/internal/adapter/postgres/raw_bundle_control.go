package postgres

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/domain"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/source"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/staging"
)

func appendOrReplaceSource(sources []rawSourceCheckpoint, sourceCheckpoint rawSourceCheckpoint) []rawSourceCheckpoint {
	for index := range sources {
		if sources[index].ContractID == sourceCheckpoint.ContractID {
			sources[index] = sourceCheckpoint
			return sources
		}
	}
	return append(sources, sourceCheckpoint)
}

func validateUATFKey(values []any, previous *string) (string, error) {
	if len(values) != 8 || values[0] == nil {
		return "", errors.New("uatf_datos row violates its source contract")
	}
	key, ok := values[0].(string)
	if !ok || strings.TrimSpace(key) == "" || previous != nil && key == *previous {
		return "", errors.New("uatf_datos order key is missing or duplicated")
	}
	return key, nil
}

func rawSchemaHash(contract domain.SourceContract, fields []pgconn.FieldDescription) string {
	columns := make([]source.ColumnMetadata, len(fields))
	for index, field := range fields {
		columns[index] = source.ColumnMetadata{Name: field.Name, TypeOID: field.DataTypeOID, TypeModifier: field.TypeModifier}
	}
	encoded, _ := json.Marshal(struct {
		ContractID string                  `json:"contract_id"`
		Columns    []source.ColumnMetadata `json:"columns"`
	}{contract.ID, columns})
	hash := sha256.Sum256(encoded)
	return hex.EncodeToString(hash[:])
}

func rawBundleRequestHash(request RawBundleRequest) (string, error) {
	encoded, err := json.Marshal(struct {
		Kind      domain.ExecutionKind   `json:"kind"`
		Period    *domain.AcademicPeriod `json:"period"`
		ClosureID *int64                 `json:"closure_id,omitempty"`
		RetryOf   *domain.RunID          `json:"retry_of,omitempty"`
		CutAt     *time.Time             `json:"cut_at,omitempty"`
		BatchSize int                    `json:"batch_size"`
	}{request.ExecutionKind, request.Period, request.ClosureID, request.RetryOfRunID, request.RequestedCutAt, request.BatchSize})
	if err != nil {
		return "", err
	}
	hash := sha256.Sum256(encoded)
	return hex.EncodeToString(hash[:]), nil
}

func rawSourceStepCode(contractID string) string {
	return "extract_" + strings.NewReplacer(".", "_", "-", "_").Replace(contractID)
}

func (e *RawBundleExtractor) acquireBundleLock(ctx context.Context, runID uuid.UUID) (func(), error) {
	connection, err := e.coordinator.pool.Acquire(ctx)
	if err != nil {
		return nil, errors.New("could not acquire bundle coordination connection")
	}
	var acquired bool
	if err := connection.QueryRow(ctx, `SELECT pg_try_advisory_lock(hashtext($1),hashtext($2))`, runID.String(), rawBundleLockName).Scan(&acquired); err != nil {
		connection.Release()
		return nil, errors.New("could not acquire bundle coordination lock")
	}
	if !acquired {
		connection.Release()
		return nil, errors.New("this run_id is already being processed")
	}
	return func() {
		unlockCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		var released bool
		if err := connection.QueryRow(unlockCtx, `SELECT pg_advisory_unlock(hashtext($1),hashtext($2))`, runID.String(), rawBundleLockName).Scan(&released); err != nil || !released {
			_ = connection.Conn().Close(unlockCtx)
		}
		connection.Release()
	}, nil
}

func (e *RawBundleExtractor) ensureBundleExecution(ctx context.Context, request RawBundleRequest) error {
	runID := uuid.UUID(request.RunID)
	read := func() (string, string, error) {
		var status, kind, actor string
		err := e.target.pool.QueryRow(ctx, `SELECT status,execution_kind,requested_by FROM etl_control.etl_execution WHERE run_id=$1`, runID).Scan(&status, &kind, &actor)
		return status, kind + "\x00" + actor, err
	}
	status, identity, err := read()
	if errors.Is(err, pgx.ErrNoRows) {
		var result uuid.UUID
		if err := e.target.pool.QueryRow(ctx, `SELECT execution.run_id FROM etl_control.create_etl_execution(
 $1::uuid,$2::varchar(24),$3::varchar(255),$4::bigint,$5::smallint,$6::smallint,$7::timestamptz,$8::uuid
) AS execution`, runID, request.ExecutionKind, request.Actor, request.ClosureID, request.Period.Year, request.Period.Period,
			request.RequestedCutAt, nullableRunID(request.RetryOfRunID)).Scan(&result); err != nil {
			return errors.New("could not create raw bundle execution")
		}
		status, identity, err = read()
	}
	if err != nil {
		return errors.New("could not read raw bundle execution")
	}
	wantIdentity := string(request.ExecutionKind) + "\x00" + request.Actor
	if identity != wantIdentity {
		return errors.New("run_id belongs to a different execution actor or kind")
	}
	if status == string(domain.ExecutionRequested) {
		var started uuid.UUID
		if err := e.target.pool.QueryRow(ctx, `SELECT execution.run_id FROM etl_control.start_etl_execution($1::uuid,$2::varchar(255),$3::text) AS execution`,
			runID, request.Actor, "Start DW-012 raw snapshot bundle").Scan(&started); err != nil {
			return errors.New("could not start raw bundle execution")
		}
		return nil
	}
	if status != string(domain.ExecutionRunning) {
		return errors.New("raw bundle execution must be requested or active")
	}
	return nil
}

func (e *RawBundleExtractor) loadOrCreateBundleStep(ctx context.Context, request RawBundleRequest, requestHash string) (rawBundleStep, error) {
	var result rawBundleStep
	var details []byte
	err := e.target.pool.QueryRow(ctx, `SELECT step_id,status,details FROM etl_control.etl_execution_step WHERE run_id=$1 AND step_code=$2`,
		uuid.UUID(request.RunID), rawBundleStepCode).Scan(&result.StepID, &result.Status, &details)
	if errors.Is(err, pgx.ErrNoRows) {
		result.Details = rawBundleCheckpoint{Version: 1, RequestSHA256: requestHash, Sources: []rawSourceCheckpoint{}}
		encoded, _ := json.Marshal(result.Details)
		if err := e.registerRawStep(ctx, request.RunID, rawBundleStepCode, "EN_EJECUCION", "bundle", encoded); err != nil {
			return result, err
		}
		err = e.target.pool.QueryRow(ctx, `SELECT step_id,status,details FROM etl_control.etl_execution_step WHERE run_id=$1 AND step_code=$2`, uuid.UUID(request.RunID), rawBundleStepCode).Scan(&result.StepID, &result.Status, &details)
	}
	if err != nil {
		return result, errors.New("could not load bundle checkpoint")
	}
	if err := json.Unmarshal(details, &result.Details); err != nil {
		return result, errors.New("bundle checkpoint is malformed")
	}
	if result.Details.Version != 1 || result.Details.RequestSHA256 != requestHash {
		return result, errors.New("bundle checkpoint does not match the requested cut or approved contracts")
	}
	return result, nil
}

func (e *RawBundleExtractor) beginBundleSources(ctx context.Context, request RawBundleRequest) error {
	for _, spec := range source.Contracts() {
		if _, err := e.registerRawManifest(ctx, request, spec, spec.QuerySHA); err != nil {
			return err
		}
		if _, _, err := e.prepareRawSourceStep(ctx, request.RunID, rawSourceStepCode(spec.Contract.ID), spec.Contract.ID, spec.QuerySHA); err != nil {
			return err
		}
	}
	return nil
}

func (e *RawBundleExtractor) registerRawStep(ctx context.Context, runID domain.RunID, code, status, component string, details []byte) error {
	writeCtx, cancel := context.WithTimeout(ctx, e.limits.TargetWriteTimeout)
	defer cancel()
	_, err := registerRawStep(writeCtx, e.target.pool, runID, 0, code, status, component, details)
	return err
}

func registerRawStepTx(ctx context.Context, query rawStepQuery, runID domain.RunID, stepID int64, code, status, component string, details []byte) error {
	id, err := registerRawStep(ctx, query, runID, stepID, code, status, component, details)
	if err != nil {
		return err
	}
	if stepID > 0 && id != stepID {
		return errors.New("execution step identity changed")
	}
	return nil
}

type rawStepQuery interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

func registerRawStep(ctx context.Context, query rawStepQuery, runID domain.RunID, expectedID int64, code, status, component string, details []byte) (int64, error) {
	phase := "EXTRACCION"
	order := int16(1)
	if code == rawBundleGateStep {
		phase = "VALIDACION"
		order = 2
	}
	var id int64
	err := query.QueryRow(ctx, `SELECT step.step_id FROM etl_control.register_etl_execution_step(
 $1::uuid,$2::varchar(100),$3::varchar(20),$4::varchar(16),$5::smallint,$6::text,$7::varchar(255),$8::jsonb
) AS step`, uuid.UUID(runID), code, phase, status, order, "loadmanager/raw_bundle", rawBundleVersion+":"+component, string(details)).Scan(&id)
	if err != nil {
		return 0, errors.New("could not persist raw bundle execution step")
	}
	if expectedID > 0 && expectedID != id {
		return 0, errors.New("execution step identity changed")
	}
	return id, nil
}

func (e *RawBundleExtractor) saveBundleCheckpoint(ctx context.Context, runID domain.RunID, stepID int64, checkpoint rawBundleCheckpoint, status string) error {
	encoded, err := json.Marshal(checkpoint)
	if err != nil {
		return err
	}
	writeCtx, cancel := context.WithTimeout(ctx, e.limits.TargetWriteTimeout)
	defer cancel()
	return registerRawStepTx(writeCtx, e.target.pool, runID, stepID, rawBundleStepCode, status, "bundle", encoded)
}

func (e *RawBundleExtractor) finalizeBundle(ctx context.Context, request RawBundleRequest, bundle rawBundleStep) (RawBundleResult, error) {
	if !bundle.Details.SourceComplete || len(bundle.Details.Sources) != len(source.Contracts()) {
		return RawBundleResult{}, errors.New("completed source marker does not cover all approved contracts")
	}
	result := RawBundleResult{RunID: request.RunID.String(), SourceCount: len(bundle.Details.Sources), CompletedAt: time.Now().UTC()}
	for _, sourceCheckpoint := range bundle.Details.Sources {
		spec, ok := source.ContractByID(sourceCheckpoint.ContractID)
		if !ok {
			return RawBundleResult{}, errors.New("bundle checkpoint includes an unapproved source")
		}
		manifestID, err := e.readManifestID(ctx, request.RunID, spec.Contract.ID)
		if err != nil {
			return RawBundleResult{}, err
		}
		artifacts, err := e.verifyManifestArtifacts(ctx, manifestID, sourceCheckpoint)
		if err != nil {
			return RawBundleResult{}, err
		}
		writeCtx, cancel := context.WithTimeout(ctx, e.limits.TargetWriteTimeout)
		tx, err := e.target.pool.BeginTx(writeCtx, pgx.TxOptions{})
		if err != nil {
			cancel()
			return RawBundleResult{}, errors.New("could not begin manifest finalization")
		}
		if err := completeRawManifestTx(writeCtx, tx, request, spec, sourceCheckpoint); err != nil {
			_ = tx.Rollback(writeCtx)
			cancel()
			return RawBundleResult{}, err
		}
		encoded, _ := json.Marshal(sourceCheckpoint)
		stepCode := rawSourceStepCode(spec.Contract.ID)
		var stepID int64
		if err := tx.QueryRow(writeCtx, `SELECT step_id FROM etl_control.etl_execution_step WHERE run_id=$1 AND step_code=$2`, uuid.UUID(request.RunID), stepCode).Scan(&stepID); err != nil {
			_ = tx.Rollback(writeCtx)
			cancel()
			return RawBundleResult{}, err
		}
		if err := registerRawStepTx(writeCtx, tx, request.RunID, stepID, stepCode, "EXITOSO", spec.Contract.ID, encoded); err != nil {
			_ = tx.Rollback(writeCtx)
			cancel()
			return RawBundleResult{}, err
		}
		if err := tx.Commit(writeCtx); err != nil {
			cancel()
			return RawBundleResult{}, errors.New("could not commit source manifest completion")
		}
		cancel()
		result.ArtifactCount += int64(len(artifacts))
		result.RecordCount += sourceCheckpoint.RecordCount
		result.ByteCount += sourceCheckpoint.ByteCount
	}
	gate, _ := json.Marshal(map[string]any{"run_id": request.RunID.String(), "required_sources": len(source.Contracts()),
		"completed_sources": len(bundle.Details.Sources), "artifact_count": result.ArtifactCount, "record_count": result.RecordCount})
	if err := e.registerRawStep(ctx, request.RunID, rawBundleGateStep, "EXITOSO", "bundle", gate); err != nil {
		return RawBundleResult{}, err
	}
	if err := e.saveBundleCheckpoint(ctx, request.RunID, bundle.StepID, bundle.Details, "EXITOSO"); err != nil {
		return RawBundleResult{}, err
	}
	return e.verifyCompletedBundle(ctx, request.RunID.String())
}

func completeRawManifestTx(ctx context.Context, tx pgx.Tx, request RawBundleRequest, spec source.ContractSpec, checkpoint rawSourceCheckpoint) error {
	var cut any
	if request.RequestedCutAt != nil {
		cut = request.RequestedCutAt.UTC()
	}
	details, err := json.Marshal(map[string]any{"format": "JSONL", "compression": "GZIP", "serializer_version": 1,
		"part_count": checkpoint.PartCount, "byte_count": checkpoint.ByteCount, "fields": spec.Contract.Columns, "readiness": "all_parts_verified"})
	if err != nil {
		return err
	}
	var id int64
	err = tx.QueryRow(ctx, `SELECT manifest.manifest_id FROM etl_control.register_etl_source_manifest(
 $1::uuid,$2::varchar(150),$3::varchar(64),$4::varchar(63),$5::varchar(63),$6::char(64),$7::text,'COMPLETO'::varchar(16),
 $8::char(64),$9::smallint,$10::smallint,$11::timestamptz,$12::bigint,$13::jsonb) AS manifest`, uuid.UUID(request.RunID),
		spec.Contract.ID, spec.Contract.Version, spec.Contract.Schema, spec.Contract.Object, spec.QuerySHA, stableOrderString(spec.Contract),
		checkpoint.SchemaSHA256, request.Period.Year, request.Period.Period, cut, checkpoint.RecordCount, string(details)).Scan(&id)
	if err != nil {
		return errors.New("could not mark source manifest complete")
	}
	return nil
}

type rawArtifactRow struct {
	URI         string
	SHA256      string
	ByteCount   int64
	RecordCount pgtype.Int8
}

func (e *RawBundleExtractor) verifyManifestArtifacts(ctx context.Context, manifestID int64, checkpoint rawSourceCheckpoint) ([]rawArtifactRow, error) {
	rows, err := e.target.pool.Query(ctx, `SELECT artifact_uri,artifact_sha256,byte_count,record_count FROM etl_control.etl_source_manifest_artifact
WHERE manifest_id=$1 AND artifact_kind='RAW_EXTRACT' ORDER BY artifact_id`, manifestID)
	if err != nil {
		return nil, errors.New("could not read raw artifact manifest")
	}
	defer rows.Close()
	artifacts := make([]rawArtifactRow, 0, checkpoint.PartCount)
	var recordCount, byteCount int64
	for rows.Next() {
		var artifact rawArtifactRow
		if err := rows.Scan(&artifact.URI, &artifact.SHA256, &artifact.ByteCount, &artifact.RecordCount); err != nil {
			return nil, err
		}
		path, err := filePathFromArtifactURI(artifact.URI)
		if err != nil || e.validateArtifactRoot(path) != nil {
			return nil, errors.New("artifact path is outside the configured RAW root")
		}
		if !artifact.RecordCount.Valid {
			return nil, errors.New("RAW part is missing its record count")
		}
		if err := staging.VerifyArtifact(ctx, path, strings.TrimSpace(artifact.SHA256), artifact.ByteCount, artifact.RecordCount.Int64); err != nil {
			return nil, err
		}
		recordCount += artifact.RecordCount.Int64
		byteCount += artifact.ByteCount
		artifacts = append(artifacts, artifact)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if int64(len(artifacts)) != checkpoint.PartCount || recordCount != checkpoint.RecordCount || byteCount != checkpoint.ByteCount {
		return nil, errors.New("RAW artifacts do not reconcile with source checkpoint")
	}
	return artifacts, nil
}

func (e *RawBundleExtractor) readManifestID(ctx context.Context, runID domain.RunID, contractID string) (int64, error) {
	var id int64
	err := e.target.pool.QueryRow(ctx, `SELECT manifest_id FROM etl_control.etl_source_manifest WHERE run_id=$1 AND source_contract_id=$2`, uuid.UUID(runID), contractID).Scan(&id)
	if err != nil {
		return 0, errors.New("source manifest is missing")
	}
	return id, nil
}

func (e *RawBundleExtractor) verifyCompletedBundle(ctx context.Context, runID string) (RawBundleResult, error) {
	parsed, err := uuid.Parse(runID)
	if err != nil {
		return RawBundleResult{}, errors.New("invalid run_id")
	}
	var gateStatus string
	err = e.target.pool.QueryRow(ctx, `SELECT status FROM etl_control.etl_execution_step WHERE run_id=$1 AND step_code=$2`, parsed, rawBundleGateStep).Scan(&gateStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return RawBundleResult{}, fmt.Errorf("RAW completeness gate %q is missing for run_id %s", rawBundleGateStep, parsed)
	}
	if err != nil {
		return RawBundleResult{}, errors.New("could not read RAW completeness gate; check dw_raw_verifier privileges and DW database settings")
	}
	if gateStatus != "EXITOSO" {
		return RawBundleResult{}, fmt.Errorf("RAW completeness gate for run_id %s has status %q, expected EXITOSO", parsed, gateStatus)
	}
	var bundleStatus string
	if err := e.target.pool.QueryRow(ctx, `SELECT status FROM etl_control.etl_execution_step WHERE run_id=$1 AND step_code=$2`, parsed, rawBundleStepCode).Scan(&bundleStatus); err != nil || bundleStatus != "EXITOSO" {
		return RawBundleResult{}, errors.New("raw bundle extraction step is not complete")
	}
	result := RawBundleResult{RunID: runID, CompletedAt: time.Now().UTC()}
	for _, spec := range source.Contracts() {
		var status string
		var contractVersion, queryHash, schemaHash string
		var manifestID int64
		var count int64
		if err := e.target.pool.QueryRow(ctx, `SELECT manifest_id,status,record_count,source_contract_version,source_query_sha256,source_schema_sha256
FROM etl_control.etl_source_manifest WHERE run_id=$1 AND source_contract_id=$2`, parsed, spec.Contract.ID).
			Scan(&manifestID, &status, &count, &contractVersion, &queryHash, &schemaHash); err != nil || status != "COMPLETO" {
			return RawBundleResult{}, errors.New("one or more source manifests are incomplete")
		}
		if contractVersion != spec.Contract.Version || strings.TrimSpace(queryHash) != spec.QuerySHA {
			return RawBundleResult{}, errors.New("source manifest differs from the approved contract or query version")
		}
		var checkpoint rawSourceCheckpoint
		var stepStatus string
		var details []byte
		if err := e.target.pool.QueryRow(ctx, `SELECT status,details FROM etl_control.etl_execution_step WHERE run_id=$1 AND step_code=$2`, parsed, rawSourceStepCode(spec.Contract.ID)).Scan(&stepStatus, &details); err != nil || stepStatus != "EXITOSO" || json.Unmarshal(details, &checkpoint) != nil {
			return RawBundleResult{}, errors.New("source checkpoint is missing or malformed")
		}
		if checkpoint.ContractID != spec.Contract.ID || checkpoint.QuerySHA256 != spec.QuerySHA || checkpoint.SchemaSHA256 != strings.TrimSpace(schemaHash) {
			return RawBundleResult{}, errors.New("source checkpoint differs from its completed manifest")
		}
		artifacts, err := e.verifyManifestArtifacts(ctx, manifestID, checkpoint)
		if err != nil {
			return RawBundleResult{}, err
		}
		if count != checkpoint.RecordCount {
			return RawBundleResult{}, errors.New("manifest record count differs from source checkpoint")
		}
		result.SourceCount++
		result.ArtifactCount += int64(len(artifacts))
		result.RecordCount += count
		result.ByteCount += checkpoint.ByteCount
	}
	if result.SourceCount != len(source.Contracts()) {
		return RawBundleResult{}, errors.New("bundle does not contain all required source contracts")
	}
	return result, nil
}

// VerifyRawBundle is the read-only eligibility check intended for the Hop
// preflight action. It verifies the database gate plus every file checksum,
// byte size, gzip stream, JSONL record and manifest count before returning.
func VerifyRawBundle(ctx context.Context, target *Pool, rawRoot, runID string) (RawBundleResult, error) {
	if target == nil || target.pool == nil {
		return RawBundleResult{}, errors.New("target database is required for RAW verification")
	}
	archive, err := staging.NewArchive(rawRoot)
	if err != nil {
		return RawBundleResult{}, err
	}
	extractor := &RawBundleExtractor{target: target, archive: archive}
	return extractor.verifyCompletedBundle(ctx, runID)
}

func (e *RawBundleExtractor) failBundle(ctx context.Context, request RawBundleRequest, step rawBundleStep, reason string, causes ...error) error {
	cleanupCtx, cancel := context.WithTimeout(context.Background(), e.limits.TargetWriteTimeout)
	defer cancel()
	var failures []error
	if cause := errors.Join(causes...); cause != nil {
		failures = append(failures, cause)
	}
	for _, spec := range source.Contracts() {
		var manifestID int64
		var status string
		err := e.target.pool.QueryRow(cleanupCtx, `SELECT manifest_id,status FROM etl_control.etl_source_manifest WHERE run_id=$1 AND source_contract_id=$2`, uuid.UUID(request.RunID), spec.Contract.ID).Scan(&manifestID, &status)
		if err != nil || status != "PENDIENTE" {
			continue
		}
		var schema, object, version, queryHash, order string
		var schemaHash pgtype.Text
		var gestion, periodo pgtype.Int2
		var cut pgtype.Timestamptz
		if err := e.target.pool.QueryRow(cleanupCtx, `SELECT source_contract_version,source_schema,source_object,source_query_sha256,stable_order_key,source_schema_sha256,snapshot_gestion,snapshot_periodo,snapshot_cut_at FROM etl_control.etl_source_manifest WHERE manifest_id=$1`, manifestID).Scan(&version, &schema, &object, &queryHash, &order, &schemaHash, &gestion, &periodo, &cut); err != nil {
			failures = append(failures, errors.New("could not inspect failed source manifest"))
			continue
		}
		var g, p, c, sh any
		if gestion.Valid {
			g = gestion.Int16
		}
		if periodo.Valid {
			p = periodo.Int16
		}
		if cut.Valid {
			c = cut.Time
		}
		if schemaHash.Valid {
			sh = schemaHash.String
		}
		failureDetails, _ := json.Marshal(map[string]string{"failure": reason})
		_, err = e.target.pool.Exec(cleanupCtx, `SELECT etl_control.register_etl_source_manifest($1,$2,$3,$4,$5,$6,$7,'FALLIDO',$8,$9,$10,$11,NULL,$12::jsonb)`,
			uuid.UUID(request.RunID), spec.Contract.ID, version, schema, object, queryHash, order, sh, g, p, c, string(failureDetails))
		if err != nil {
			failures = append(failures, errors.New("could not mark failed source manifest"))
		}
	}
	if step.StepID > 0 {
		data, _ := json.Marshal(map[string]string{"failure": reason})
		if err := registerRawStepTx(cleanupCtx, e.target.pool, request.RunID, step.StepID, rawBundleStepCode, "FALLIDO", "bundle", data); err != nil {
			failures = append(failures, errors.New("could not mark failed bundle step"))
		}
	}
	errorDetails, _ := json.Marshal(map[string]string{"component": "loadmanager/raw_bundle", "phase": "source_extraction"})
	var failedStepID any
	if step.StepID > 0 {
		failedStepID = step.StepID
	}
	if _, err := e.target.pool.Exec(cleanupCtx, `SELECT etl_control.record_etl_execution_error(
 $1::uuid,'ERROR'::varchar(12),'DW012_SOURCE_SNAPSHOT_FAILED'::varchar(100),$2::text,$2::text,
 TRUE,$3::bigint,$4::jsonb)`, uuid.UUID(request.RunID), reason, failedStepID, string(errorDetails)); err != nil {
		failures = append(failures, errors.New("could not persist sanitized extraction error"))
	}
	if _, err := e.target.pool.Exec(cleanupCtx, `SELECT etl_control.fail_etl_execution($1::uuid,$2::varchar(255),$3::text)`, uuid.UUID(request.RunID), request.Actor, reason); err != nil {
		failures = append(failures, errors.New("could not persist failed execution audit"))
	}
	return errors.Join(failures...)
}

func filePathFromArtifactURI(value string) (string, error) {
	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme != "file" || parsed.Host != "" || parsed.Path == "" {
		return "", errors.New("artifact URI is not a shared local file")
	}
	return filepath.FromSlash(parsed.Path), nil
}

func (e *RawBundleExtractor) validateArtifactRoot(path string) error {
	root, err := filepath.EvalSymlinks(e.archive.Root())
	if err != nil {
		return err
	}
	absolute, err := filepath.EvalSymlinks(path)
	if err != nil {
		return err
	}
	relative, err := filepath.Rel(root, absolute)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return errors.New("artifact path escapes configured RAW root")
	}
	return nil
}

func decodeRawArtifactURI(value string) (string, error) {
	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme != "file" || parsed.Host != "" {
		return "", errors.New("invalid RAW artifact URI")
	}
	return filepath.FromSlash(parsed.Path), nil
}
