package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (e *UATFDatosExtractor) prepareCheckpoint(ctx context.Context, request SnapshotRequest, fingerprint string) (int64, *extractionCheckpoint, error) {
	runID := uuid.UUID(request.RunID)
	var stepID int64
	var details []byte
	err := e.target.QueryRow(ctx, `SELECT step_id, details FROM etl_control.etl_execution_step WHERE run_id = $1 AND step_code = $2`, runID, uatfStepCode).Scan(&stepID, &details)
	if errors.Is(err, pgx.ErrNoRows) {
		checkpoint := &extractionCheckpoint{
			Version: 2, RequestFingerprint: fingerprint, QuerySHA256: e.queryHash, BatchSize: request.BatchSize,
		}
		encoded, err := json.Marshal(checkpoint)
		if err != nil {
			return 0, nil, err
		}
		stepID, err = e.registerStep(ctx, runID, "EN_EJECUCION", encoded)
		if err != nil {
			return 0, nil, err
		}
		return stepID, checkpoint, nil
	}
	if err != nil {
		return 0, nil, err
	}
	var checkpoint extractionCheckpoint
	if err := json.Unmarshal(details, &checkpoint); err != nil {
		return 0, nil, errors.New("stored checkpoint is invalid")
	}
	legacyReadOnly := checkpoint.Version == 1
	if (checkpoint.Version != 1 && checkpoint.Version != 2) || checkpoint.RequestFingerprint != fingerprint || checkpoint.BatchSize != request.BatchSize || (checkpoint.QuerySHA256 != e.queryHash && !legacyReadOnly) {
		return 0, nil, errors.New("checkpoint does not match the source query or requested snapshot")
	}
	return stepID, &checkpoint, nil
}

func (e *UATFDatosExtractor) saveCheckpoint(ctx context.Context, runID uuid.UUID, checkpoint *extractionCheckpoint) error {
	encoded, err := json.Marshal(checkpoint)
	if err != nil {
		return err
	}
	_, err = e.registerStep(ctx, runID, "EN_EJECUCION", encoded)
	return err
}

func (e *UATFDatosExtractor) registerStep(ctx context.Context, runID uuid.UUID, status string, details []byte) (int64, error) {
	ctx, cancel := context.WithTimeout(ctx, e.limits.TargetWriteTimeout)
	defer cancel()
	var stepID int64
	err := e.target.QueryRow(ctx, `SELECT step.step_id FROM etl_control.register_etl_execution_step(
 $1::uuid, $2::varchar(100), 'EXTRACCION'::varchar(20), $3::varchar(16), 1::smallint,
 'loadmanager/uatf_datos'::text, $4::varchar(255), $5::jsonb
) AS step`, runID, uatfStepCode, status, uatfComponentVersion, string(details)).Scan(&stepID)
	return stepID, err
}

func (e *UATFDatosExtractor) verifyStagedCheckpoint(ctx context.Context, runID uuid.UUID, checkpoint *extractionCheckpoint) error {
	var stagedCount, maxOrdinal int64
	err := e.target.QueryRow(ctx, `SELECT count(*), coalesce(max(row_ordinal), 0) FROM staging.raw_uatf_datos WHERE run_id = $1`, runID).Scan(&stagedCount, &maxOrdinal)
	if err != nil {
		return err
	}
	if stagedCount != checkpoint.RecordCount || maxOrdinal != checkpoint.RecordCount {
		return errors.New("staged row count and checkpoint diverge")
	}
	return nil
}
