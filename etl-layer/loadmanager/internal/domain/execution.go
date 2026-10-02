package domain

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
)

type RunID uuid.UUID

func NewRunID() RunID { return RunID(uuid.New()) }

func ParseRunID(value string) (RunID, error) {
	id, err := uuid.Parse(strings.TrimSpace(value))
	if err != nil {
		return RunID{}, fmt.Errorf("%w: %v", ErrInvalidExecutionID, err)
	}
	return RunID(id), nil
}

func (id RunID) String() string { return uuid.UUID(id).String() }
func (id RunID) IsZero() bool   { return uuid.UUID(id) == uuid.Nil }

type ExecutionKind string

const (
	ExecutionHistorical ExecutionKind = "HISTORICA"
	ExecutionClosure    ExecutionKind = "CIERRE_ACADEMICO"
	ExecutionReplay     ExecutionKind = "REPROCESO"
)

type ExecutionStatus string

const (
	ExecutionRequested  ExecutionStatus = "SOLICITADA"
	ExecutionRunning    ExecutionStatus = "EN_EJECUCION"
	ExecutionPublishing ExecutionStatus = "PUBLICANDO"
	ExecutionSucceeded  ExecutionStatus = "EXITOSA"
	ExecutionFailed     ExecutionStatus = "FALLIDA"
	ExecutionCancelled  ExecutionStatus = "CANCELADA"
)

func (s ExecutionStatus) Terminal() bool {
	return s == ExecutionSucceeded || s == ExecutionFailed || s == ExecutionCancelled
}

type AcademicPeriod struct {
	Year   int16 `json:"gestion" yaml:"gestion"`
	Period int16 `json:"periodo" yaml:"periodo"`
}

func (p AcademicPeriod) Validate() error {
	if p.Year < 2000 || p.Period <= 0 {
		return fmt.Errorf("%w: academic period must have gestion >= 2000 and periodo > 0", ErrInvalidExecution)
	}
	return nil
}

type Execution struct {
	RunID          RunID           `json:"run_id" yaml:"run_id"`
	Kind           ExecutionKind   `json:"execution_kind" yaml:"execution_kind"`
	Status         ExecutionStatus `json:"status" yaml:"status"`
	RequestedBy    string          `json:"requested_by" yaml:"requested_by"`
	RequestedAt    time.Time       `json:"requested_at" yaml:"requested_at"`
	StartedAt      *time.Time      `json:"started_at,omitempty" yaml:"started_at,omitempty"`
	EndedAt        *time.Time      `json:"ended_at,omitempty" yaml:"ended_at,omitempty"`
	Period         *AcademicPeriod `json:"period,omitempty" yaml:"period,omitempty"`
	ClosureID      *int64          `json:"closure_id,omitempty" yaml:"closure_id,omitempty"`
	RetryOfRunID   *RunID          `json:"retry_of_run_id,omitempty" yaml:"retry_of_run_id,omitempty"`
	RequestedCutAt *time.Time      `json:"requested_cut_at,omitempty" yaml:"requested_cut_at,omitempty"`
}

type NewExecutionInput struct {
	RunID          RunID
	Kind           ExecutionKind
	RequestedBy    string
	RequestedAt    time.Time
	Period         *AcademicPeriod
	ClosureID      *int64
	RetryOfRunID   *RunID
	RequestedCutAt *time.Time
}

func NewExecution(input NewExecutionInput) (Execution, error) {
	if input.RunID.IsZero() || strings.TrimSpace(input.RequestedBy) == "" {
		return Execution{}, fmt.Errorf("%w: run_id and requested_by are required", ErrInvalidExecution)
	}
	if input.RequestedAt.IsZero() {
		input.RequestedAt = time.Now().UTC()
	}
	if input.Period != nil {
		if err := input.Period.Validate(); err != nil {
			return Execution{}, err
		}
	}
	switch input.Kind {
	case ExecutionHistorical:
		if input.ClosureID != nil || input.RetryOfRunID != nil {
			return Execution{}, fmt.Errorf("%w: HISTORICA cannot reference a closure or retry", ErrInvalidExecution)
		}
	case ExecutionClosure:
		if input.ClosureID == nil || *input.ClosureID <= 0 {
			return Execution{}, fmt.Errorf("%w: CIERRE_ACADEMICO requires a positive closure_id", ErrInvalidExecution)
		}
		if input.RetryOfRunID != nil {
			return Execution{}, fmt.Errorf("%w: CIERRE_ACADEMICO cannot reference retry_of_run_id", ErrInvalidExecution)
		}
	case ExecutionReplay:
		if input.RetryOfRunID == nil || input.RetryOfRunID.IsZero() {
			return Execution{}, fmt.Errorf("%w: REPROCESO requires retry_of_run_id", ErrInvalidExecution)
		}
	default:
		return Execution{}, fmt.Errorf("%w: unsupported execution kind %q", ErrInvalidExecution, input.Kind)
	}
	return Execution{
		RunID: input.RunID, Kind: input.Kind, Status: ExecutionRequested,
		RequestedBy: strings.TrimSpace(input.RequestedBy), RequestedAt: input.RequestedAt.UTC(),
		Period: input.Period, ClosureID: input.ClosureID, RetryOfRunID: input.RetryOfRunID,
		RequestedCutAt: input.RequestedCutAt,
	}, nil
}

type ExecutionEvent struct {
	RunID          RunID            `json:"run_id"`
	PreviousStatus *ExecutionStatus `json:"previous_status,omitempty"`
	NewStatus      ExecutionStatus  `json:"new_status"`
	Actor          string           `json:"actor"`
	Reason         string           `json:"reason"`
	OccurredAt     time.Time        `json:"occurred_at"`
}

// Transition applies the DW-004 state machine in memory. Persistence remains
// the responsibility of the etl_control adapter and its audited SQL routines.
func (e *Execution) Transition(next ExecutionStatus, actor, reason string, at time.Time) (ExecutionEvent, error) {
	if e == nil || e.RunID.IsZero() || strings.TrimSpace(actor) == "" || strings.TrimSpace(reason) == "" {
		return ExecutionEvent{}, fmt.Errorf("%w: execution, actor, and reason are required", ErrInvalidTransition)
	}
	allowed := (e.Status == ExecutionRequested && (next == ExecutionRunning || next == ExecutionCancelled)) ||
		(e.Status == ExecutionRunning && (next == ExecutionPublishing || next == ExecutionFailed || next == ExecutionCancelled)) ||
		(e.Status == ExecutionPublishing && (next == ExecutionSucceeded || next == ExecutionFailed))
	if !allowed {
		return ExecutionEvent{}, fmt.Errorf("%w: %s -> %s", ErrInvalidTransition, e.Status, next)
	}
	if at.IsZero() {
		at = time.Now().UTC()
	} else {
		at = at.UTC()
	}
	previous := e.Status
	e.Status = next
	if next == ExecutionRunning {
		e.StartedAt = &at
	}
	if next.Terminal() {
		e.EndedAt = &at
	}
	return ExecutionEvent{
		RunID: e.RunID, PreviousStatus: &previous, NewStatus: next,
		Actor: strings.TrimSpace(actor), Reason: strings.TrimSpace(reason), OccurredAt: at,
	}, nil
}

type StepPhase string

const (
	StepExtraction     StepPhase = "EXTRACCION"
	StepStaging        StepPhase = "STAGING"
	StepTransformation StepPhase = "TRANSFORMACION"
	StepValidation     StepPhase = "VALIDACION"
	StepPublication    StepPhase = "PUBLICACION"
)

type StepStatus string

const (
	StepPending   StepStatus = "PENDIENTE"
	StepRunning   StepStatus = "EN_EJECUCION"
	StepSucceeded StepStatus = "EXITOSO"
	StepFailed    StepStatus = "FALLIDO"
	StepSkipped   StepStatus = "OMITIDO"
)

type ExecutionStep struct {
	RunID            RunID      `json:"run_id"`
	Code             string     `json:"step_code"`
	Phase            StepPhase  `json:"phase"`
	Status           StepStatus `json:"status"`
	Order            int16      `json:"step_order"`
	ComponentRef     string     `json:"component_ref,omitempty"`
	ComponentVersion string     `json:"component_version,omitempty"`
	StartedAt        *time.Time `json:"started_at,omitempty"`
	EndedAt          *time.Time `json:"ended_at,omitempty"`
}

func (s ExecutionStep) Validate() error {
	if s.RunID.IsZero() || strings.TrimSpace(s.Code) == "" || s.Order <= 0 {
		return fmt.Errorf("%w: run ID, code, and positive order are required", ErrInvalidStep)
	}
	switch s.Phase {
	case StepExtraction, StepStaging, StepTransformation, StepValidation, StepPublication:
	default:
		return fmt.Errorf("%w: unsupported phase %q", ErrInvalidStep, s.Phase)
	}
	switch s.Status {
	case StepPending:
		if s.StartedAt != nil || s.EndedAt != nil {
			return fmt.Errorf("%w: pending step cannot have timestamps", ErrInvalidStep)
		}
	case StepRunning:
		if s.StartedAt == nil || s.EndedAt != nil {
			return fmt.Errorf("%w: running step requires only started_at", ErrInvalidStep)
		}
	case StepSucceeded, StepFailed, StepSkipped:
		if s.EndedAt == nil {
			return fmt.Errorf("%w: terminal step requires ended_at", ErrInvalidStep)
		}
	default:
		return fmt.Errorf("%w: unsupported status %q", ErrInvalidStep, s.Status)
	}
	return nil
}

type ExecutionMetric struct {
	RunID  RunID             `json:"run_id"`
	StepID *int64            `json:"step_id,omitempty"`
	Name   string            `json:"metric_name"`
	Value  json.Number       `json:"metric_value"`
	Unit   string            `json:"metric_unit"`
	Labels map[string]string `json:"dimensions,omitempty"`
}

func (m ExecutionMetric) Validate() error {
	if m.RunID.IsZero() || strings.TrimSpace(m.Name) == "" || strings.TrimSpace(m.Unit) == "" ||
		(m.StepID != nil && *m.StepID <= 0) {
		return fmt.Errorf("%w: run ID, name, unit, and a positive optional step ID are required", ErrInvalidMetric)
	}
	value, err := m.Value.Float64()
	if err != nil || math.IsNaN(value) || math.IsInf(value, 0) {
		return fmt.Errorf("%w: metric value must be a finite number", ErrInvalidMetric)
	}
	return nil
}

type ExecutionError struct {
	RunID       RunID          `json:"run_id"`
	StepID      *int64         `json:"step_id,omitempty"`
	Severity    ErrorSeverity  `json:"severity"`
	Code        string         `json:"error_code"`
	Cause       string         `json:"cause"`
	Message     string         `json:"message"`
	Blocking    bool           `json:"is_blocking"`
	SafeDetails map[string]any `json:"details,omitempty"`
	OccurredAt  time.Time      `json:"occurred_at"`
}

type ErrorSeverity string

const (
	SeverityInfo     ErrorSeverity = "INFO"
	SeverityWarning  ErrorSeverity = "WARN"
	SeverityError    ErrorSeverity = "ERROR"
	SeverityCritical ErrorSeverity = "CRITICAL"
)

func (e ExecutionError) Validate() error {
	if e.RunID.IsZero() || strings.TrimSpace(e.Code) == "" || strings.TrimSpace(e.Cause) == "" ||
		strings.TrimSpace(e.Message) == "" || (e.StepID != nil && *e.StepID <= 0) {
		return fmt.Errorf("%w: run ID, code, cause, message, and a positive optional step ID are required", ErrInvalidExecution)
	}
	switch e.Severity {
	case SeverityInfo, SeverityWarning, SeverityError, SeverityCritical:
	default:
		return fmt.Errorf("%w: unsupported error severity %q", ErrInvalidExecution, e.Severity)
	}
	return nil
}
