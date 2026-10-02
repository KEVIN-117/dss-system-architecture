package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	httpadapter "github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/adapter/http"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/adapter/postgres"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/app"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/config"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/observability"
)

const (
	sourcePoolMaxConns = 4
	targetPoolMaxConns = 4
)

func main() {
	logger := observability.NewLogger(os.Stderr)
	if err := run(logger); err != nil {
		logger.Error("load manager stopped", slog.String("error", err.Error()))
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	configPath := os.Getenv("LOADMANAGER_CONFIG")
	if configPath == "" {
		configPath = "configs/loadmanager.example.yaml"
	}
	cfg, err := config.Load(configPath)
	if err != nil {
		return fmt.Errorf("load configuration: %w", err)
	}

	startupCtx, cancelStartup := context.WithTimeout(context.Background(), cfg.ConnectTimeout)
	defer cancelStartup()
	source, err := postgres.NewPool(startupCtx, "jachasun-oltp", cfg.Source, true, sourcePoolMaxConns, cfg.ConnectTimeout)
	if err != nil {
		return fmt.Errorf("initialize source pool: %w", err)
	}
	defer source.Close()
	target, err := postgres.NewPool(startupCtx, "dw-postgresql", cfg.Target, false, targetPoolMaxConns, cfg.ConnectTimeout)
	if err != nil {
		return fmt.Errorf("initialize target pool: %w", err)
	}
	defer target.Close()

	service := app.NewService(source, target)
	handler := httpadapter.NewHandler(func(ctx context.Context) bool {
		return service.CheckReadiness(ctx).Ready
	}, cfg.ReadinessTimeout)
	server := httpadapter.NewServer(cfg.HTTPAddress, handler, cfg.ReadHeaderTimeout)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	serverErr := make(chan error, 1)
	go func() {
		logger.Info("load manager HTTP server starting", slog.String("address", cfg.HTTPAddress))
		serverErr <- server.ListenAndServe()
	}()

	select {
	case err := <-serverErr:
		if !errors.Is(err, http.ErrServerClosed) {
			return fmt.Errorf("HTTP server: %w", err)
		}
		return nil
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("graceful HTTP shutdown: %w", err)
		}
		select {
		case err := <-serverErr:
			if !errors.Is(err, http.ErrServerClosed) {
				return fmt.Errorf("HTTP server: %w", err)
			}
		case <-time.After(cfg.ShutdownTimeout):
			return errors.New("HTTP server did not stop before shutdown timeout")
		}
		logger.Info("load manager stopped gracefully")
		return nil
	}
}
