package app

import "context"

type Dependency interface {
	Name() string
	Ping(context.Context) error
}

type DependencyStatus struct {
	Name  string
	Ready bool
}

type Readiness struct {
	Ready        bool
	Dependencies []DependencyStatus
}
