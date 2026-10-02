package domain

import (
	"encoding/json"
	"errors"
	"testing"
	"time"
)

func TestNewRunIDRoundTrips(t *testing.T) {
	id := NewRunID()
	if id.IsZero() {
		t.Fatal("NewRunID returned the zero UUID")
	}
	parsed, err := ParseRunID(id.String())
	if err != nil {
		t.Fatalf("ParseRunID returned error: %v", err)
	}
	if parsed != id {
		t.Fatalf("round trip changed run ID: got %s, want %s", parsed, id)
	}
}

func TestExecutionStateMachine(t *testing.T) {
	at := time.Date(2026, time.October, 1, 12, 0, 0, 0, time.UTC)
	execution, err := NewExecution(NewExecutionInput{
		RunID: NewRunID(), Kind: ExecutionHistorical, RequestedBy: "test:unit", RequestedAt: at,
	})
	if err != nil {
		t.Fatalf("NewExecution returned error: %v", err)
	}
	for _, status := range []ExecutionStatus{ExecutionRunning, ExecutionPublishing, ExecutionSucceeded} {
		event, err := execution.Transition(status, "test:unit", "valid test transition", at)
		if err != nil {
			t.Fatalf("transition to %s failed: %v", status, err)
		}
		if event.NewStatus != status {
			t.Fatalf("event status = %s, want %s", event.NewStatus, status)
		}
	}
	if execution.StartedAt == nil || execution.EndedAt == nil || execution.Status != ExecutionSucceeded {
		t.Fatalf("terminal timestamps or status incorrect: %+v", execution)
	}
	if _, err := execution.Transition(ExecutionRunning, "test:unit", "must reject", at); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("expected terminal transition rejection, got %v", err)
	}
}

func TestNewExecutionEnforcesControlModel(t *testing.T) {
	valid := NewExecutionInput{
		RunID: NewRunID(), Kind: ExecutionClosure, RequestedBy: "dsa:test",
		ClosureID: int64Pointer(4), Period: &AcademicPeriod{Year: 2026, Period: 99},
	}
	if _, err := NewExecution(valid); err != nil {
		t.Fatalf("valid closure execution rejected: %v", err)
	}
	valid.ClosureID = nil
	if _, err := NewExecution(valid); !errors.Is(err, ErrInvalidExecution) {
		t.Fatalf("expected missing-closure validation error, got %v", err)
	}
	valid.Kind = ExecutionReplay
	valid.RetryOfRunID = nil
	if _, err := NewExecution(valid); !errors.Is(err, ErrInvalidExecution) {
		t.Fatalf("expected missing retry link validation error, got %v", err)
	}
}

func TestAcademicPeriodAllowsNonSemesterCodes(t *testing.T) {
	if err := (AcademicPeriod{Year: 2026, Period: 99}).Validate(); err != nil {
		t.Fatalf("positive non-semester period must be valid: %v", err)
	}
	if err := (AcademicPeriod{Year: 2026, Period: 0}).Validate(); err == nil {
		t.Fatal("zero period must be rejected")
	}
}

func TestExecutionStepAndMetricValidation(t *testing.T) {
	now := time.Now().UTC()
	step := ExecutionStep{RunID: NewRunID(), Code: "extract-source", Phase: StepExtraction, Status: StepRunning, Order: 1, StartedAt: &now}
	if err := step.Validate(); err != nil {
		t.Fatalf("valid running step rejected: %v", err)
	}
	step.EndedAt = &now
	if err := step.Validate(); err == nil {
		t.Fatal("running step with ended_at must be rejected")
	}
	metric := ExecutionMetric{RunID: step.RunID, Name: "source_rows", Value: json.Number("12.5"), Unit: "ROWS"}
	if err := metric.Validate(); err != nil {
		t.Fatalf("valid metric rejected: %v", err)
	}
	metric.Value = json.Number("NaN")
	if err := metric.Validate(); err == nil {
		t.Fatal("non-finite metric must be rejected")
	}
}

func int64Pointer(value int64) *int64 { return &value }
