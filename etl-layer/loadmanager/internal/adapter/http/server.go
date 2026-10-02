package http

import (
	"net/http"
	"time"
)

func NewServer(address string, handler http.Handler, readHeaderTimeout time.Duration) *http.Server {
	return &http.Server{
		Addr: address, Handler: handler,
		ReadHeaderTimeout: readHeaderTimeout,
		IdleTimeout:       60 * time.Second,
	}
}
