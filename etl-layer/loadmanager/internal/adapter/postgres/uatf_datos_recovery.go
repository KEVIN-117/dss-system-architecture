package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

// RecoverInterruptedRun only reconciles DW control state. It never opens an
// OLTP transaction. The caller must provide the original request and actor.
// A partial run is failed and its replacement must have a new run_id.
func (e *UATFDatosExtractor) RecoverInterruptedRun(ctx context.Context, request SnapshotRequest) (ExtractedSnapshot, error) {
	if err := validateSnapshotRequest(&request); err != nil {
		return ExtractedSnapshot{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, e.limits.MaxDuration)
	defer cancel()
	select {
	case e.slot <- struct{}{}:
		defer func() { <-e.slot }()
	case <-ctx.Done():
		return ExtractedSnapshot{}, errors.New("reconciliation slot wait exceeded its deadline")
	}
	runID := uuid.UUID(request.RunID)
	release, err := e.acquireRunLock(ctx, runID)
	if err != nil {
		return ExtractedSnapshot{}, err
	}
	defer release()
	var exists bool
	if err := e.target.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM etl_control.etl_execution WHERE run_id = $1)`, runID).Scan(&exists); err != nil || !exists {
		return ExtractedSnapshot{}, errors.New("execution is missing or unavailable for reconciliation")
	}
	if _, err := e.prepareExecution(ctx, request); err != nil {
		return ExtractedSnapshot{}, err
	}
	fingerprint, err := snapshotRequestFingerprint(request)
	if err != nil {
		return ExtractedSnapshot{}, errors.New("could not identify snapshot request")
	}
	stepID, checkpoint, err := e.prepareCheckpoint(ctx, request, fingerprint)
	if err != nil {
		return ExtractedSnapshot{}, err
	}
	completed, result, err := e.completedSnapshot(ctx, runID, request.RunID.String(), stepID, checkpoint)
	if err != nil || completed {
		return result, err
	}
	if checkpoint.SourceComplete {
		if err := e.finalizeCompletedSource(ctx, runID, stepID, checkpoint, time.Duration(0)); err != nil {
			return ExtractedSnapshot{}, errors.New("source is complete but manifest finalization is not confirmed")
		}
		return snapshotFromCheckpoint(request.RunID.String(), checkpoint), nil
	}
	return ExtractedSnapshot{}, errors.Join(ErrRestartRequired, e.fail(runID, request.Actor, stepID, "abandoned partial snapshot", nil))
}
