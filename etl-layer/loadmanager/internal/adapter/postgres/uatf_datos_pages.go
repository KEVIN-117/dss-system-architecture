package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"hash"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/source"
)

func (e *UATFDatosExtractor) extractPages(ctx context.Context, request SnapshotRequest, runID uuid.UUID, stepID int64, checkpoint *extractionCheckpoint, hasher hash.Hash) (ExtractedSnapshot, error) {
	sourceTx, err := e.source.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return ExtractedSnapshot{}, errors.New("could not begin read-only source snapshot")
	}
	defer sourceTx.Rollback(ctx)
	if _, err := sourceTx.Exec(ctx, `SELECT set_config('statement_timeout', $1, true), set_config('idle_in_transaction_session_timeout', $2, true)`,
		fmt.Sprintf("%dms", e.limits.SourceStatementTimeout.Milliseconds()), fmt.Sprintf("%dms", e.limits.SourceIdleTimeout.Milliseconds())); err != nil {
		return ExtractedSnapshot{}, errors.New("could not set source query deadlines")
	}
	metadataHash, err := inspectUATFSource(ctx, sourceTx)
	if err != nil {
		return ExtractedSnapshot{}, err
	}
	checkpoint.SchemaSHA256 = metadataHash
	if err := e.saveCheckpoint(ctx, runID, checkpoint); err != nil {
		return ExtractedSnapshot{}, errors.New("could not persist source schema checkpoint")
	}

	var lastKey any
	if checkpoint.LastIDRA != nil {
		lastKey = *checkpoint.LastIDRA
	}
	for {
		pageStarted := time.Now()
		rows, err := sourceTx.Query(ctx, e.query, lastKey, request.BatchSize+1)
		if err != nil {
			return ExtractedSnapshot{}, errors.New("approved source page query failed")
		}
		fields := rows.FieldDescriptions()
		fieldNames := make([]string, len(fields))
		fieldOIDs := make([]uint32, len(fields))
		for i, field := range fields {
			fieldNames[i], fieldOIDs[i] = field.Name, field.DataTypeOID
		}
		if err := source.ValidateUATFDatosSchema(fieldNames, fieldOIDs); err != nil {
			rows.Close()
			return ExtractedSnapshot{}, err
		}

		page := make([]stagedUATFDatosRow, 0, request.BatchSize+1)
		previousKey := checkpoint.LastIDRA
		for rows.Next() {
			values, err := rows.Values()
			if err != nil {
				rows.Close()
				return ExtractedSnapshot{}, errors.New("could not decode source row")
			}
			key, err := validateUATFRow(values, previousKey)
			if err != nil {
				rows.Close()
				return ExtractedSnapshot{}, err
			}
			rowBytes, err := json.Marshal(values)
			if err != nil {
				rows.Close()
				return ExtractedSnapshot{}, errors.New("source row cannot be represented as JSON")
			}
			page = append(page, stagedUATFDatosRow{values: values, bytes: rowBytes})
			previousKey = &key
		}
		rowsErr := rows.Err()
		rows.Close()
		if rowsErr != nil {
			return ExtractedSnapshot{}, errors.New("source page stream failed")
		}
		if len(page) > request.BatchSize {
			// The look-ahead row detects a duplicate key exactly at a page edge.
			if page[request.BatchSize].values[0] == page[request.BatchSize-1].values[0] {
				return ExtractedSnapshot{}, errors.New("source natural key is duplicated at a batch boundary")
			}
			page = page[:request.BatchSize]
		}
		if len(page) == 0 {
			break
		}

		newCheckpoint := *checkpoint
		for _, row := range page {
			_, _ = hasher.Write(row.bytes)
			_, _ = hasher.Write([]byte{'\n'})
			newCheckpoint.RecordCount++
			newCheckpoint.ByteCount += int64(len(row.bytes))
		}
		last := page[len(page)-1].values[0].(string)
		newCheckpoint.LastIDRA = &last
		newCheckpoint.BatchCount++
		if e.beforePageCommit != nil {
			if err := e.beforePageCommit(ctx, newCheckpoint.BatchCount); err != nil {
				return ExtractedSnapshot{}, err
			}
		}
		if err := e.commitPage(ctx, runID, stepID, page, newCheckpoint, pageStarted); err != nil {
			return ExtractedSnapshot{}, errors.New("could not commit staging page and checkpoint")
		}
		*checkpoint = newCheckpoint
		e.logger.Info("snapshot batch committed", "run_id", runID.String(), "phase", "staging", "batch", checkpoint.BatchCount, "rows", len(page), "duration_ms", time.Since(pageStarted).Milliseconds())
		if e.afterPage != nil {
			if err := e.afterPage(ctx, checkpoint.BatchCount); err != nil {
				return ExtractedSnapshot{}, err
			}
		}
		lastKey = last
	}
	if err := sourceTx.Commit(ctx); err != nil {
		return ExtractedSnapshot{}, errors.New("source snapshot could not be completed")
	}
	return ExtractedSnapshot{
		RecordCount: checkpoint.RecordCount, ByteCount: checkpoint.ByteCount, BatchCount: checkpoint.BatchCount,
		RowSHA256: fmt.Sprintf("%x", hasher.Sum(nil)), SchemaSHA256: checkpoint.SchemaSHA256,
	}, nil
}
