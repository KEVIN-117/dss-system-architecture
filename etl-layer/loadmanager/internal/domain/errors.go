package domain

import "errors"

var (
	ErrInvalidExecution   = errors.New("invalid execution")
	ErrInvalidTransition  = errors.New("invalid execution status transition")
	ErrInvalidSource      = errors.New("invalid source contract")
	ErrInvalidManifest    = errors.New("invalid source manifest")
	ErrInvalidStep        = errors.New("invalid execution step")
	ErrInvalidMetric      = errors.New("invalid execution metric")
	ErrInvalidExecutionID = errors.New("invalid execution run ID")
)
