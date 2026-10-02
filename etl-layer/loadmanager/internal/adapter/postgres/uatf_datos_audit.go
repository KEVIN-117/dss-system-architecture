package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/source"
)

func (e *UATFDatosExtractor) fail(runID uuid.UUID, actor string, stepID int64, reason string, cause error) error {
	cleanupCtx, cancel := context.WithTimeout(context.Background(), e.limits.TargetWriteTimeout)
	defer cancel()
	tx, err := e.target.BeginTx(cleanupCtx, pgx.TxOptions{})
	if err != nil {
		return errors.Join(errors.New(reason), errors.New("failure audit unavailable: could not begin transaction"))
	}
	defer tx.Rollback(cleanupCtx)
	var details []byte
	if stepID > 0 {
		if err := tx.QueryRow(cleanupCtx, `SELECT details FROM etl_control.etl_execution_step WHERE step_id = $1`, stepID).Scan(&details); err != nil {
			return errors.Join(errors.New(reason), errors.New("failure audit unavailable: could not read step"))
		}
		var savedStepID int64
		if err := tx.QueryRow(cleanupCtx, `SELECT step.step_id FROM etl_control.register_etl_execution_step(
 $1::uuid, $2::varchar(100), 'EXTRACCION'::varchar(20), 'FALLIDO'::varchar(16), 1::smallint,
 'loadmanager/uatf_datos'::text, $3::varchar(255), $4::jsonb
) AS step`, runID, uatfStepCode, uatfComponentVersion, string(details)).Scan(&savedStepID); err != nil || savedStepID != stepID {
			return errors.Join(errors.New(reason), errors.New("failure audit unavailable: could not mark step failed"))
		}
	}
	var manifestID int64
	err = tx.QueryRow(cleanupCtx, `SELECT manifest_id FROM etl_control.etl_source_manifest WHERE run_id = $1 AND source_contract_id = $2`, runID, source.UATFDatosContractID).Scan(&manifestID)
	if err == nil {
		var failedID int64
		if err := tx.QueryRow(cleanupCtx, `SELECT failed.manifest_id FROM etl_control.etl_source_manifest existing,
LATERAL etl_control.register_etl_source_manifest(
 $1::uuid, 'public.uatf_datos'::varchar(150), '1'::varchar(64), 'public'::varchar(63),
 'uatf_datos'::varchar(63), $2::char(64), 'id_ra ASC'::text, 'FALLIDO'::varchar(16),
 existing.source_schema_sha256, existing.snapshot_gestion, existing.snapshot_periodo,
 existing.snapshot_cut_at, existing.record_count,
 jsonb_build_object('failure_reason', $3::text)
) AS failed WHERE existing.manifest_id = $4`, runID, e.queryHash, reason, manifestID).Scan(&failedID); err != nil || failedID != manifestID {
			return errors.Join(errors.New(reason), errors.New("failure audit unavailable: could not mark manifest failed"))
		}
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return errors.Join(errors.New(reason), errors.New("failure audit unavailable: could not inspect manifest"))
	}
	var errorID int64
	var optionalStep any
	if stepID > 0 {
		optionalStep = stepID
	}
	if err := tx.QueryRow(cleanupCtx, `SELECT error.error_id FROM etl_control.record_etl_execution_error(
 $1::uuid, 'ERROR'::varchar(12), 'SOURCE_EXTRACTION_FAILED'::varchar(100),
 'source or staging operation failed'::text, $2::text, TRUE, $3::bigint, $4::jsonb
) AS error`, runID, reason, optionalStep, safeCauseDetails(cause)).Scan(&errorID); err != nil {
		return errors.Join(errors.New(reason), errors.New("failure audit unavailable: could not record error"))
	}
	var failed uuid.UUID
	if err := tx.QueryRow(cleanupCtx, `SELECT execution.run_id FROM etl_control.fail_etl_execution($1::uuid, $2::varchar(255), $3::text) AS execution`, runID, actor, reason).Scan(&failed); err != nil {
		return errors.Join(errors.New(reason), errors.New("failure audit unavailable: could not transition execution"))
	}
	if err := tx.Commit(cleanupCtx); err != nil {
		return errors.Join(errors.New(reason), errors.New("failure audit unavailable: commit not confirmed"))
	}
	e.logger.Error("snapshot failed", "run_id", runID.String(), "phase", "extraction", "reason", reason)
	return errors.New(reason)
}

func safeCauseDetails(cause error) string {
	if cause == nil {
		return `{}`
	}
	encoded, err := json.Marshal(map[string]string{"cause_type": fmt.Sprintf("%T", cause)})
	if err != nil {
		return `{}`
	}
	return string(encoded)
}
