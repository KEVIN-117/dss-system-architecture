package postgres

import (
	"context"
	"errors"
	"net"
	"net/url"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/kevin-117/dss-system-architecture/etl-layer/loadmanager/internal/config"
)

// Pool wraps a single PostgreSQL dependency without exposing its connection
// string or driver-specific errors to callers.
type Pool struct {
	name string
	pool *pgxpool.Pool
}

func NewPool(ctx context.Context, name string, db config.Database, readOnly bool, maxConns int32, connectTimeout time.Duration) (*Pool, error) {
	if ctx == nil || name == "" || maxConns < 1 || connectTimeout <= 0 {
		return nil, errors.New("database pool context, name, positive max connections and connect timeout are required")
	}
	cfg, err := BuildPoolConfig(db, name, readOnly, maxConns, connectTimeout)
	if err != nil {
		return nil, err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, errors.New("could not initialize database pool")
	}
	return &Pool{name: name, pool: pool}, nil
}

// BuildPoolConfig creates a safely escaped pgx configuration. It is exported
// to support deterministic configuration tests without requiring a database.
func BuildPoolConfig(db config.Database, applicationName string, readOnly bool, maxConns int32, connectTimeout time.Duration) (*pgxpool.Config, error) {
	if applicationName == "" || maxConns < 1 || db.Host == "" || db.Port == 0 || db.Name == "" ||
		db.User == "" || db.Password == "" || connectTimeout <= 0 {
		return nil, errors.New("database pool configuration is incomplete")
	}
	u := &url.URL{
		Scheme: "postgres",
		Host:   net.JoinHostPort(db.Host, strconv.Itoa(int(db.Port))),
		Path:   "/" + db.Name,
		User:   url.UserPassword(db.User, db.Password),
	}
	query := url.Values{}
	query.Set("sslmode", db.SSLMode)
	u.RawQuery = query.Encode()
	cfg, err := pgxpool.ParseConfig(u.String())
	if err != nil {
		return nil, errors.New("invalid database pool configuration")
	}
	cfg.ConnConfig.ConnectTimeout = connectTimeout
	cfg.MaxConns = maxConns
	cfg.ConnConfig.RuntimeParams["application_name"] = applicationName
	if readOnly {
		cfg.ConnConfig.RuntimeParams["default_transaction_read_only"] = "on"
	}
	return cfg, nil
}

func (p *Pool) Name() string { return p.name }

func (p *Pool) Ping(ctx context.Context) error {
	if err := p.pool.Ping(ctx); err != nil {
		return errors.New("database dependency unavailable")
	}
	return nil
}

func (p *Pool) Close() { p.pool.Close() }
