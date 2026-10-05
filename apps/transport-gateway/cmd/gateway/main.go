// Command gateway terminates HTTP/3 WebTransport for the transport demo and
// bridges every session to the Node server's multiplexed WebSocket listener.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/frozik/portfolio/apps/transport-gateway/internal/certs"
	"github.com/frozik/portfolio/apps/transport-gateway/internal/config"
	"github.com/frozik/portfolio/apps/transport-gateway/internal/metrics"
	"github.com/frozik/portfolio/apps/transport-gateway/internal/server"
	"github.com/frozik/portfolio/apps/transport-gateway/internal/upstream"
)

const healthcheckTimeout = 3 * time.Second

func main() {
	healthcheck := flag.Bool("healthcheck", false, "probe the running gateway's /healthz and exit")
	flag.Parse()
	var level slog.Level
	if err := level.UnmarshalText([]byte(os.Getenv("GATEWAY_LOG_LEVEL"))); err != nil {
		level = slog.LevelInfo
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level}))
	settings, err := config.FromEnv()
	if err == nil && *healthcheck {
		err = probe(settings.AdminAddr)
	} else if err == nil {
		err = run(settings, logger)
	}
	if err != nil {
		logger.Error("gateway stopped", "err", err)
		os.Exit(1)
	}
}

func run(settings config.Config, logger *slog.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	certificate, err := waitForCertificate(ctx, settings, logger)
	if err != nil {
		return err
	}
	go certificate.Watch(ctx, settings.CertReloadInterval, func(err error) {
		if err != nil {
			logger.Warn("certificate reload failed", "err", err)
			return
		}
		logger.Info("certificate reloaded")
	})

	counters := metrics.New()
	gateway := server.New(server.Options{
		Path:                 settings.Path,
		MaxStreamsPerSession: settings.MaxStreamsPerSession,
		StreamWindowBytes:    settings.StreamWindowBytes,
		SessionWindowBytes:   settings.SessionWindowBytes,
		IdleTimeout:          settings.IdleTimeout,
		GetCertificate:       certificate.GetCertificate,
		Upstream:             upstream.Dialer{URL: settings.UpstreamURL, Secret: settings.Secret},
		Metrics:              counters,
		Logger:               logger,
	})

	admin := &http.Server{Addr: settings.AdminAddr, Handler: adminRoutes(counters), ReadHeaderTimeout: 5 * time.Second}
	go func() {
		if err := admin.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("admin listener failed", "err", err)
		}
	}()

	udp, err := net.ListenPacket("udp", settings.ListenAddr)
	if err != nil {
		return fmt.Errorf("listen %s: %w", settings.ListenAddr, err)
	}
	serving := make(chan error, 1)
	go func() { serving <- gateway.Serve(udp) }()
	logger.Info("gateway listening", "http3", settings.ListenAddr, "upstream", settings.UpstreamURL, "admin", settings.AdminAddr)

	select {
	case err := <-serving:
		return err
	case <-ctx.Done():
	}
	logger.Info("draining")
	drainCtx, cancel := context.WithTimeout(context.Background(), settings.DrainTimeout)
	defer cancel()
	return errors.Join(gateway.Drain(drainCtx), admin.Shutdown(drainCtx))
}

// waitForCertificate retries until the pair exists: in development Node writes
// it on its first start, which may come after the gateway's.
func waitForCertificate(ctx context.Context, settings config.Config, logger *slog.Logger) (*certs.Source, error) {
	for {
		certificate, err := certs.Load(settings.CertFile, settings.KeyFile)
		if err == nil {
			return certificate, nil
		}
		logger.Warn("waiting for the certificate", "err", err)
		select {
		case <-ctx.Done():
			return nil, fmt.Errorf("certificate: %w", err)
		case <-time.After(settings.CertReloadInterval):
		}
	}
}

func adminRoutes(counters *metrics.Metrics) http.Handler {
	routes := http.NewServeMux()
	routes.Handle("/metrics", counters.Handler())
	routes.HandleFunc("/healthz", func(response http.ResponseWriter, _ *http.Request) {
		response.WriteHeader(http.StatusNoContent)
	})
	return routes
}

func probe(adminAddr string) error {
	client := http.Client{Timeout: healthcheckTimeout}
	response, err := client.Get("http://" + adminAddr + "/healthz")
	if err != nil {
		return err
	}
	response.Body.Close()
	if response.StatusCode != http.StatusNoContent {
		return fmt.Errorf("healthz answered %d", response.StatusCode)
	}
	return nil
}
