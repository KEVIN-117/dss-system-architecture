package app

import (
	"context"
	"errors"
	"testing"
)

type fakeDependency struct {
	name string
	err  error
}

func (f fakeDependency) Name() string               { return f.name }
func (f fakeDependency) Ping(context.Context) error { return f.err }

func TestReadinessRequiresEveryDependency(t *testing.T) {
	service := NewService(fakeDependency{name: "source"}, fakeDependency{name: "target"})
	if result := service.CheckReadiness(context.Background()); !result.Ready || len(result.Dependencies) != 2 {
		t.Fatalf("expected all dependencies ready: %+v", result)
	}

	service = NewService(fakeDependency{name: "source"}, fakeDependency{name: "target", err: errors.New("offline")})
	if result := service.CheckReadiness(context.Background()); result.Ready || result.Dependencies[1].Ready {
		t.Fatalf("expected a failed dependency to make service unready: %+v", result)
	}
}

func TestReadinessWithoutDependenciesIsFalse(t *testing.T) {
	if NewService().CheckReadiness(context.Background()).Ready {
		t.Fatal("service without dependencies must not be ready")
	}
}
