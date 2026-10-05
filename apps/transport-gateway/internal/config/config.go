// Package config reads the gateway's settings from the environment once, at start.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config is everything the gateway needs.
type Config struct {
	// ListenAddr is the UDP address for HTTP/3.
	ListenAddr string
	// UpstreamURL is Node's gateway listener, e.g. ws://communication:4448/transport.
	UpstreamURL string
	// Secret proves the gateway to Node (TRANSPORT_GATEWAY_SECRET, shared with Node).
	Secret               string
	Path                 string
	CertFile             string
	KeyFile              string
	CertReloadInterval   time.Duration
	MaxStreamsPerSession int
	StreamWindowBytes    uint64
	SessionWindowBytes   uint64
	// IdleTimeout ends a connection that went silent — a browser that vanished without closing.
	IdleTimeout time.Duration
	// AdminAddr serves /metrics and /healthz; never published.
	AdminAddr    string
	DrainTimeout time.Duration
}

const minSecretLength = 16

// FromEnv reads and validates the environment.
func FromEnv() (Config, error) {
	var problems []error
	text := func(name, fallback string) string {
		if value, set := os.LookupEnv(name); set && value != "" {
			return value
		}
		if fallback == "" {
			problems = append(problems, fmt.Errorf("%s is required", name))
		}
		return fallback
	}
	number := func(name string, fallback int) int {
		value, set := os.LookupEnv(name)
		if !set || value == "" {
			return fallback
		}
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed <= 0 {
			problems = append(problems, fmt.Errorf("%s must be a positive integer", name))
		}
		return parsed
	}
	duration := func(name string, fallback time.Duration) time.Duration {
		value, set := os.LookupEnv(name)
		if !set || value == "" {
			return fallback
		}
		parsed, err := time.ParseDuration(value)
		if err != nil || parsed <= 0 {
			problems = append(problems, fmt.Errorf("%s must be a positive duration", name))
		}
		return parsed
	}
	config := Config{
		ListenAddr:           text("GATEWAY_LISTEN_ADDR", ":4447"),
		UpstreamURL:          text("GATEWAY_UPSTREAM_URL", ""),
		Secret:               text("TRANSPORT_GATEWAY_SECRET", ""),
		Path:                 text("GATEWAY_PATH", "/transport"),
		CertFile:             text("GATEWAY_CERT_FILE", ""),
		KeyFile:              text("GATEWAY_KEY_FILE", ""),
		CertReloadInterval:   duration("GATEWAY_CERT_RELOAD_INTERVAL", 30*time.Second),
		MaxStreamsPerSession: number("GATEWAY_MAX_STREAMS_PER_SESSION", 16),
		StreamWindowBytes:    uint64(number("GATEWAY_STREAM_WINDOW_BYTES", 256*1024)),
		SessionWindowBytes:   uint64(number("GATEWAY_SESSION_WINDOW_BYTES", 1024*1024)),
		IdleTimeout:          duration("GATEWAY_IDLE_TIMEOUT", 30*time.Second),
		AdminAddr:            text("GATEWAY_ADMIN_ADDR", "127.0.0.1:9447"),
		DrainTimeout:         duration("GATEWAY_DRAIN_TIMEOUT", 15*time.Second),
	}
	if config.Secret != "" && len(config.Secret) < minSecretLength {
		problems = append(problems, fmt.Errorf("TRANSPORT_GATEWAY_SECRET must be at least %d characters", minSecretLength))
	}
	return config, errors.Join(problems...)
}
