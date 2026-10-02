package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/source"
)

func snapshotFromCheckpoint(runID string, checkpoint *extractionCheckpoint) ExtractedSnapshot {
	return ExtractedSnapshot{RunID: runID, RecordCount: checkpoint.RecordCount, ByteCount: checkpoint.ByteCount,
		BatchCount: checkpoint.BatchCount, RowSHA256: checkpoint.RowSHA256, SchemaSHA256: checkpoint.SchemaSHA256}
}

func (e *UATFDatosExtractor) completedSnapshot(ctx context.Context, runID uuid.UUID, runIDText string, stepID int64, checkpoint *extractionCheckpoint) (bool, ExtractedSnapshot, error) {
	var stepStatus, manifestStatus, manifestQueryHash, manifestSchemaHash string
	var manifestCount int64
	if err := e.target.QueryRow(ctx, `SELECT status FROM etl_control.etl_execution_step WHERE step_id = $1`, stepID).Scan(&stepStatus); err != nil {
		return false, ExtractedSnapshot{}, errors.New("could not inspect extraction step")
	}
	if stepStatus != "EXITOSO" {
		return false, ExtractedSnapshot{}, nil
	}
	if err := e.target.QueryRow(ctx, `SELECT status, source_query_sha256,
coalesce(source_schema_sha256, ''), coalesce(record_count, -1) FROM etl_control.etl_source_manifest
WHERE run_id = $1 AND source_contract_id = $2`, runID, source.UATFDatosContractID).Scan(&manifestStatus, &manifestQueryHash, &manifestSchemaHash, &manifestCount); err != nil {
		return false, ExtractedSnapshot{}, errors.New("completed extraction has no source manifest")
	}
	if manifestStatus != "COMPLETO" || manifestQueryHash != checkpoint.QuerySHA256 || manifestSchemaHash != checkpoint.SchemaSHA256 || manifestCount != checkpoint.RecordCount {
		return false, ExtractedSnapshot{}, errors.New("extraction step and manifest have inconsistent completion states")
	}
	if err := e.verifyStagedCheckpoint(ctx, runID, checkpoint); err != nil {
		return false, ExtractedSnapshot{}, errors.New("completed staging snapshot does not match its checkpoint")
	}
	var artifactHash string
	if err := e.target.QueryRow(ctx, `SELECT artifact_sha256 FROM etl_control.etl_source_manifest_artifact
WHERE manifest_id = (SELECT manifest_id FROM etl_control.etl_source_manifest WHERE run_id = $1 AND source_contract_id = $2)
	AND artifact_kind = 'RAW_EXTRACT'`, runID, source.UATFDatosContractID).Scan(&artifactHash); err != nil {
		return false, ExtractedSnapshot{}, errors.New("completed snapshot artifact is missing")
	}
	if checkpoint.RowSHA256 != "" && checkpoint.RowSHA256 != artifactHash {
		return false, ExtractedSnapshot{}, errors.New("completed snapshot checksum does not match artifact")
	}
	checkpoint.RowSHA256 = artifactHash
	return true, snapshotFromCheckpoint(runIDText, checkpoint), nil
}

func (e *UATFDatosExtractor) finalizeCompletedSource(ctx context.Context, runID uuid.UUID, stepID int64, checkpoint *extractionCheckpoint, elapsed time.Duration) error {
	if err := e.verifyStagedCheckpoint(ctx, runID, checkpoint); err != nil {
		return err
	}
	var manifestID int64
	if err := e.target.QueryRow(ctx, `SELECT manifest_id FROM etl_control.etl_source_manifest WHERE run_id = $1 AND source_contract_id = $2`,
		runID, source.UATFDatosContractID).Scan(&manifestID); err != nil {
		return err
	}
	return e.completeSnapshot(ctx, runID, stepID, manifestID, snapshotFromCheckpoint(runID.String(), checkpoint), checkpoint, elapsed)
}

func (e *UATFDatosExtractor) registerPendingManifest(ctx context.Context, runID uuid.UUID) (int64, error) {
	ctx, cancel := context.WithTimeout(ctx, e.limits.TargetWriteTimeout)
	defer cancel()
	var gestion, periodo pgtype.Int2
	var cutAt pgtype.Timestamptz
	if err := e.target.QueryRow(ctx, `SELECT requested_gestion, requested_periodo, requested_cut_at
FROM etl_control.etl_execution WHERE run_id = $1`, runID).Scan(&gestion, &periodo, &cutAt); err != nil {
		return 0, err
	}
	var gestionValue, periodoValue, cutValue any
	if gestion.Valid {
		gestionValue = gestion.Int16
	}
	if periodo.Valid {
		periodoValue = periodo.Int16
	}
	if cutAt.Valid {
		cutValue = cutAt.Time
	}
	var manifestID int64
	err := e.target.QueryRow(ctx, `SELECT manifest.manifest_id FROM etl_control.register_etl_source_manifest(
 $1::uuid, 'public.uatf_datos'::varchar(150), '1'::varchar(64), 'public'::varchar(63),
 'uatf_datos'::varchar(63), $2::char(64), 'id_ra ASC'::text, 'PENDIENTE'::varchar(16), NULL::char(64),
 $3::smallint, $4::smallint, $5::timestamptz, NULL::bigint, '{}'::jsonb
) AS manifest`, runID, e.queryHash, gestionValue, periodoValue, cutValue).Scan(&manifestID)
	return manifestID, err
}

func (e *UATFDatosExtractor) completeSnapshot(ctx context.Context, runID uuid.UUID, stepID, manifestID int64, result ExtractedSnapshot, checkpoint *extractionCheckpoint, elapsed time.Duration) error {
	ctx, cancel := context.WithTimeout(ctx, e.limits.TargetWriteTimeout)
	defer cancel()
	tx, err := e.target.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var gestion, periodo pgtype.Int2
	var cutAt pgtype.Timestamptz
	if err := tx.QueryRow(ctx, `SELECT requested_gestion, requested_periodo, requested_cut_at
FROM etl_control.etl_execution WHERE run_id = $1`, runID).Scan(&gestion, &periodo, &cutAt); err != nil {
		return err
	}
	var gestionValue, periodoValue, cutValue any
	if gestion.Valid {
		gestionValue = gestion.Int16
	}
	if periodo.Valid {
		periodoValue = periodo.Int16
	}
	if cutAt.Valid {
		cutValue = cutAt.Time
	}
	artifactURI := "postgresql://dw/staging.raw_uatf_datos/" + runID.String()
	var artifactID int64
	if err := tx.QueryRow(ctx, `SELECT artifact.artifact_id FROM etl_control.register_etl_source_manifest_artifact(
 $1::bigint, 'RAW_EXTRACT'::varchar(32), $2::text, $3::char(64), $4::bigint, $5::bigint
) AS artifact`, manifestID, artifactURI, result.RowSHA256, result.ByteCount, result.RecordCount).Scan(&artifactID); err != nil {
		return err
	}
	var completedID int64
	err = tx.QueryRow(ctx, `SELECT manifest.manifest_id FROM etl_control.register_etl_source_manifest(
 $1::uuid, 'public.uatf_datos'::varchar(150), '1'::varchar(64), 'public'::varchar(63),
 'uatf_datos'::varchar(63), $2::char(64), 'id_ra ASC'::text, 'COMPLETO'::varchar(16),
 $3::char(64), $4::smallint, $5::smallint, $6::timestamptz, $7::bigint,
 jsonb_build_object('load_target', 'staging.raw_uatf_datos', 'batch_count', $8::bigint)
) AS manifest`, runID, e.queryHash, result.SchemaSHA256, gestionValue,
		periodoValue, cutValue, result.RecordCount, result.BatchCount).Scan(&completedID)
	if err != nil {
		return err
	}
	if completedID != manifestID {
		return errors.New("manifest identity mismatch")
	}
	checkpointJSON, err := json.Marshal(checkpoint)
	if err != nil {
		return err
	}
	var savedStepID int64
	err = tx.QueryRow(ctx, `SELECT step.step_id FROM etl_control.register_etl_execution_step(
 $1::uuid, $2::varchar(100), 'EXTRACCION'::varchar(20), 'EXITOSO'::varchar(16), 1::smallint,
 'loadmanager/uatf_datos'::text, $3::varchar(255), $4::jsonb
) AS step`, runID, uatfStepCode, uatfComponentVersion, string(checkpointJSON)).Scan(&savedStepID)
	if err != nil || savedStepID != stepID {
		return errors.New("could not complete extraction step")
	}
	for _, metric := range []struct {
		name  string
		value float64
		unit  string
	}{{"source_rows_total", float64(result.RecordCount), "ROWS"},
		{"extract_batches_total", float64(result.BatchCount), "BATCHES"},
		{"extract_duration_ms", float64(elapsed.Milliseconds()), "MILLISECONDS"}} {
		if err := recordMetricTx(ctx, tx, runID, stepID, metric.name, metric.value, metric.unit, 0); err != nil {
			return err
		}
	}
	if e.beforeFinalizationCommit != nil {
		if err := e.beforeFinalizationCommit(ctx); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
