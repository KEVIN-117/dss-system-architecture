package postgres

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/domain"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/source"
)

type UATFDatosExtractor struct {
	source    *pgxpool.Pool
	target    *pgxpool.Pool
	query     string
	queryHash string
}

type ExtractedSnapshot struct {
	RunID        string
	RecordCount  int64
	ByteCount    int64
	RowSHA256    string
	SchemaSHA256 string
}

func NewUATFDatosExtractor(sourcePool, targetPool *Pool, query []byte) (*UATFDatosExtractor, error) {
	if sourcePool == nil || targetPool == nil || sourcePool.pool == nil || targetPool.pool == nil || len(query) == 0 {
		return nil, errors.New("source pool, target pool and approved query are required")
	}
	validatedQuery, err := source.ValidateUATFDatosQuery(query)
	if err != nil {
		return nil, err
	}
	return &UATFDatosExtractor{
		source: sourcePool.pool, target: targetPool.pool, query: string(validatedQuery), queryHash: source.QuerySHA256(validatedQuery),
	}, nil
}

// Extract writes one full source-observed snapshot. The execution remains
// EN_EJECUCION after this extraction step; transformation/publication own its
// eventual terminal state.
func (e *UATFDatosExtractor) Extract(ctx context.Context, runID domain.RunID, actor string) (ExtractedSnapshot, error) {
	if runID.IsZero() || strings.TrimSpace(actor) == "" {
		return ExtractedSnapshot{}, errors.New("run id and actor are required")
	}
	id := uuid.UUID(runID)
	var createdRunID uuid.UUID
	if err := e.target.QueryRow(ctx, `SELECT execution.run_id FROM etl_control.create_etl_execution(
 $1::uuid, 'HISTORICA'::varchar(24), $2::varchar(255)
) AS execution`, id, actor).Scan(&createdRunID); err != nil {
		return ExtractedSnapshot{}, errors.New("could not create ETL execution")
	}
	if err := e.target.QueryRow(ctx, `SELECT execution.run_id FROM etl_control.start_etl_execution(
 $1::uuid, $2::varchar(255), 'Starting approved uatf_datos snapshot'::text
) AS execution`, id, actor).Scan(&createdRunID); err != nil {
		return ExtractedSnapshot{}, errors.New("could not start ETL execution")
	}
	stepID, err := e.registerStep(ctx, id, "EN_EJECUCION")
	if err != nil {
		return ExtractedSnapshot{}, e.fail(ctx, id, actor, "could not register extraction step", err)
	}
	manifestID, err := e.registerPendingManifest(ctx, id)
	if err != nil {
		return ExtractedSnapshot{}, e.fail(ctx, id, actor, "could not register source manifest", err)
	}

	result, err := e.extractRows(ctx, id)
	if err != nil {
		return ExtractedSnapshot{}, e.failWithStep(ctx, id, stepID, actor, "source snapshot failed", err)
	}
	artifactURI := "postgresql://" + "dw/staging.raw_uatf_datos/" + runID.String()
	var artifactID int64
	if err = e.target.QueryRow(ctx, `SELECT artifact.artifact_id FROM etl_control.register_etl_source_manifest_artifact(
 $1::bigint, 'RAW_EXTRACT'::varchar(32), $2::text, $3::char(64), $4::bigint, $5::bigint
) AS artifact`, manifestID, artifactURI, result.RowSHA256, result.ByteCount, result.RecordCount).Scan(&artifactID); err != nil {
		return ExtractedSnapshot{}, e.failWithStep(ctx, id, stepID, actor, "could not register raw manifest artifact", err)
	}
	var completedManifestID int64
	if err = e.target.QueryRow(ctx, `SELECT manifest.manifest_id FROM etl_control.register_etl_source_manifest(
 $1::uuid, 'public.uatf_datos'::varchar(150), '1'::varchar(64), 'public'::varchar(63),
 'uatf_datos'::varchar(63), $2::char(64), 'id_ra ASC'::text, 'COMPLETO'::varchar(16),
 $3::char(64), NULL::smallint, NULL::smallint, NULL::timestamptz, $4::bigint,
 jsonb_build_object('load_target', 'staging.raw_uatf_datos')
 ) AS manifest`, id, e.queryHash, result.SchemaSHA256, result.RecordCount).Scan(&completedManifestID); err != nil {
		return ExtractedSnapshot{}, e.failWithStep(ctx, id, stepID, actor, "could not complete source manifest", err)
	}
	if completedManifestID != manifestID {
		return ExtractedSnapshot{}, e.failWithStep(ctx, id, stepID, actor, "source manifest identity changed during completion", errors.New("manifest id mismatch"))
	}
	if _, err = e.registerStep(ctx, id, "EXITOSO"); err != nil {
		return ExtractedSnapshot{}, e.fail(ctx, id, actor, "could not complete extraction step", err)
	}
	var metricID int64
	if err = e.target.QueryRow(ctx, `SELECT metric.metric_id FROM etl_control.record_etl_execution_metric(
 $1::uuid, 'source_rows_staged'::varchar(100), $2::numeric, 'ROWS'::varchar(32), NULL::bigint, '{}'::jsonb
 ) AS metric`, id, result.RecordCount).Scan(&metricID); err != nil {
		return ExtractedSnapshot{}, e.fail(ctx, id, actor, "could not record extraction metric", err)
	}
	result.RunID = runID.String()
	return result, nil
}

func (e *UATFDatosExtractor) extractRows(ctx context.Context, runID uuid.UUID) (ExtractedSnapshot, error) {
	sourceTx, err := e.source.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return ExtractedSnapshot{}, errors.New("could not begin read-only source snapshot")
	}
	defer sourceTx.Rollback(ctx)
	rows, err := sourceTx.Query(ctx, e.query)
	if err != nil {
		return ExtractedSnapshot{}, errors.New("approved source query failed")
	}
	defer rows.Close()
	fields := rows.FieldDescriptions()
	schemaDescriptor := make([]map[string]any, len(fields))
	fieldNames := make([]string, len(fields))
	fieldOIDs := make([]uint32, len(fields))
	for i, field := range fields {
		fieldNames[i], fieldOIDs[i] = field.Name, field.DataTypeOID
		schemaDescriptor[i] = map[string]any{"name": field.Name, "type_oid": field.DataTypeOID}
	}
	if err := source.ValidateUATFDatosSchema(fieldNames, fieldOIDs); err != nil {
		return ExtractedSnapshot{}, err
	}
	schemaBytes, _ := json.Marshal(schemaDescriptor)
	schemaHash := fmt.Sprintf("%x", sha256.Sum256(schemaBytes))

	targetTx, err := e.target.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return ExtractedSnapshot{}, errors.New("could not begin staging transaction")
	}
	defer targetTx.Rollback(ctx)
	if _, err := targetTx.Exec(ctx, `DELETE FROM staging.raw_uatf_datos WHERE run_id = $1`, runID); err != nil {
		return ExtractedSnapshot{}, errors.New("could not prepare staging snapshot")
	}

	aggregate := sha256.New()
	var byteCount, rowCount int64
	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return ExtractedSnapshot{}, errors.New("could not decode source row")
		}
		rowBytes, err := json.Marshal(values)
		if err != nil {
			return ExtractedSnapshot{}, errors.New("source row cannot be represented as JSON")
		}
		rowHash := sha256.Sum256(rowBytes)
		rowCount++
		byteCount += int64(len(rowBytes))
		_, _ = aggregate.Write(rowBytes)
		_, _ = aggregate.Write([]byte{'\n'})
		if _, err := targetTx.Exec(ctx, `
INSERT INTO staging.raw_uatf_datos (
 run_id, row_ordinal, id_ra, id_sexo, estado_civil, nac_pais, id_colegio, id_loc,
 egr_gestion, _modificado, row_sha256
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
			runID, rowCount, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], fmt.Sprintf("%x", rowHash)); err != nil {
			return ExtractedSnapshot{}, errors.New("staging row insert failed")
		}
	}
	if err := rows.Err(); err != nil {
		return ExtractedSnapshot{}, errors.New("source row stream failed")
	}
	rows.Close()
	if err := sourceTx.Commit(ctx); err != nil {
		return ExtractedSnapshot{}, errors.New("source snapshot could not be completed")
	}
	if err := targetTx.Commit(ctx); err != nil {
		return ExtractedSnapshot{}, errors.New("staging snapshot transaction failed")
	}
	return ExtractedSnapshot{
		RecordCount: rowCount, ByteCount: byteCount,
		RowSHA256: fmt.Sprintf("%x", aggregate.Sum(nil)), SchemaSHA256: schemaHash,
	}, nil
}

func (e *UATFDatosExtractor) registerStep(ctx context.Context, id uuid.UUID, status string) (int64, error) {
	var stepID int64
	err := e.target.QueryRow(ctx, `SELECT step_id FROM etl_control.register_etl_execution_step(
 $1::uuid, 'extract_uatf_datos'::varchar(100), 'EXTRACCION'::varchar(20), $2::varchar(16), 1::smallint,
 'loadmanager/uatf_datos'::text, 'v1'::varchar(255), '{}'::jsonb
)`, id, status).Scan(&stepID)
	return stepID, err
}

func (e *UATFDatosExtractor) registerPendingManifest(ctx context.Context, id uuid.UUID) (int64, error) {
	var manifestID int64
	err := e.target.QueryRow(ctx, `SELECT manifest_id FROM etl_control.register_etl_source_manifest(
 $1::uuid, 'public.uatf_datos'::varchar(150), '1'::varchar(64), 'public'::varchar(63),
 'uatf_datos'::varchar(63), $2::char(64), 'id_ra ASC'::text, 'PENDIENTE'::varchar(16), NULL::char(64),
 NULL::smallint, NULL::smallint, NULL::timestamptz, NULL::bigint, '{}'::jsonb
)`, id, e.queryHash).Scan(&manifestID)
	return manifestID, err
}

func (e *UATFDatosExtractor) fail(ctx context.Context, id uuid.UUID, actor, reason string, cause error) error {
	_, _ = e.target.Exec(ctx, `SELECT etl_control.fail_etl_execution($1::uuid, $2::varchar(255), $3::text)`, id, actor, reason)
	return errors.New(reason)
}

func (e *UATFDatosExtractor) failWithStep(ctx context.Context, id uuid.UUID, stepID int64, actor, reason string, cause error) error {
	_, _ = e.target.Exec(ctx, `SELECT etl_control.register_etl_execution_step(
 $1, 'extract_uatf_datos', 'EXTRACCION', 'FALLIDO', 1, 'loadmanager/uatf_datos', 'v1', '{}'::jsonb
)`, id)
	_, _ = e.target.Exec(ctx, `SELECT etl_control.record_etl_execution_error(
	 $1::uuid, 'ERROR'::varchar(12), 'SOURCE_EXTRACTION_FAILED'::varchar(100),
	 'source or staging operation failed'::text, $2::text, TRUE, $3::bigint, '{}'::jsonb
	)`, id, reason, stepID)
	return e.fail(ctx, id, actor, reason, cause)
}
