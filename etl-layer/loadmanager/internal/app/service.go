package app

import "context"

type Service struct {
	dependencies []Dependency
}

func NewService(dependencies ...Dependency) *Service {
	return &Service{dependencies: append([]Dependency(nil), dependencies...)}
}

func (s *Service) CheckReadiness(ctx context.Context) Readiness {
	result := Readiness{Ready: len(s.dependencies) > 0}
	for _, dependency := range s.dependencies {
		status := DependencyStatus{Name: dependency.Name()}
		status.Ready = dependency.Ping(ctx) == nil
		result.Dependencies = append(result.Dependencies, status)
		result.Ready = result.Ready && status.Ready
	}
	return result
}
