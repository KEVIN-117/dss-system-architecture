package postgres

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (e *UATFDatosExtractor) commitPage(ctx context.Context, runID uuid.UUID, stepID int64, page []stagedUATFDatosRow, checkpoint extractionCheckpoint, pageStarted time.Time) error {
	ctx, cancel := context.WithTimeout(ctx, e.limits.TargetWriteTimeout)
	defer cancel()
	tx, err := e.target.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	records := make([][]any, 0, len(page))
	ordinal := checkpoint.RecordCount - int64(len(page))
	for _, row := range page {
		ordinal++
		rowHash := sha256.Sum256(row.bytes)
		values := row.values
		records = append(records, []any{
			runID, ordinal, values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], fmt.Sprintf("%x", rowHash),
		})
	}
	_, err = tx.CopyFrom(ctx, pgx.Identifier{"staging", "raw_uatf_datos"},
		[]string{"run_id", "row_ordinal", "id_ra", "id_sexo", "estado_civil", "nac_pais", "id_colegio", "id_loc", "egr_gestion", "_modificado", "row_sha256"},
		pgx.CopyFromRows(records))
	if err != nil {
		return err
	}
	checkpointJSON, err := json.Marshal(checkpoint)
	if err != nil {
		return err
	}
	var savedStepID int64
	err = tx.QueryRow(ctx, `SELECT step.step_id FROM etl_control.register_etl_execution_step(
 $1::uuid, $2::varchar(100), 'EXTRACCION'::varchar(20), 'EN_EJECUCION'::varchar(16), 1::smallint,
 'loadmanager/uatf_datos'::text, $3::varchar(255), $4::jsonb
) AS step`, runID, uatfStepCode, uatfComponentVersion, string(checkpointJSON)).Scan(&savedStepID)
	if err != nil || savedStepID != stepID {
		return errors.New("could not commit extraction checkpoint")
	}
	if err := recordMetricTx(ctx, tx, runID, stepID, "source_rows_batch", float64(len(page)), "ROWS", checkpoint.BatchCount); err != nil {
		return err
	}
	if err := recordMetricTx(ctx, tx, runID, stepID, "extract_batch_duration_ms", float64(time.Since(pageStarted).Milliseconds()), "MILLISECONDS", checkpoint.BatchCount); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type stagedUATFDatosRow struct {
	values []any
	bytes  []byte
}

func recordMetricTx(ctx context.Context, tx pgx.Tx, runID uuid.UUID, stepID int64, name string, value float64, unit string, batch int64) error {
	var metricID int64
	dimensions := []byte(`{}`)
	if batch > 0 {
		dimensions, _ = json.Marshal(map[string]int64{"batch": batch})
	}
	return tx.QueryRow(ctx, `SELECT metric.metric_id FROM etl_control.record_etl_execution_metric(
 $1::uuid, $2::varchar(100), $3::numeric, $4::varchar(32), $5::bigint, $6::jsonb
) AS metric`, runID, name, value, unit, stepID, string(dimensions)).Scan(&metricID)
}
