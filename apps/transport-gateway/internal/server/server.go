// Package server accepts WebTransport sessions over HTTP/3 and bridges each
// to its own upstream session. Admission is Node's: the upstream dial carries
// the browser's address and Origin, and a refusal is answered before any
// WebTransport session exists.
package server

import (
	"context"
	"crypto/tls"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"time"

	"github.com/quic-go/quic-go"
	"github.com/quic-go/quic-go/http3"
	"github.com/quic-go/webtransport-go"

	"github.com/frozik/portfolio/apps/transport-gateway/internal/bridge"
	"github.com/frozik/portfolio/apps/transport-gateway/internal/metrics"
	"github.com/frozik/portfolio/apps/transport-gateway/internal/mux"
	"github.com/frozik/portfolio/apps/transport-gateway/internal/upstream"
)

const (
	upstreamDialTimeout = 5 * time.Second
)

// webTransportProtocols are the :protocol values of an extended CONNECT that
// asks for a WebTransport session — draft-15 on, and the earlier name — as
// webtransport-go's Upgrade accepts them.
var webTransportProtocols = map[string]bool{"webtransport-h3": true, "webtransport": true}

// Options shape the server.
type Options struct {
	Path string
	// MaxStreamsPerSession matches what Node serves per session.
	MaxStreamsPerSession int
	// StreamWindowBytes bounds what a browser may send on one stream ahead of the bridge.
	StreamWindowBytes uint64
	// SessionWindowBytes bounds the same across one connection.
	SessionWindowBytes uint64
	// IdleTimeout ends a connection nothing has crossed for this long — a
	// browser that vanished without closing — and frees its upstream session.
	IdleTimeout    time.Duration
	GetCertificate func(*tls.ClientHelloInfo) (*tls.Certificate, error)
	Upstream       upstream.Dialer
	Metrics        *metrics.Metrics
	Logger         *slog.Logger
}

// Server is the HTTP/3 side of the gateway.
type Server struct {
	transport *webtransport.Server
	sessions  *liveSessions
	options   Options
}

// New builds the server. Safari opens no stream unless the WT_INITIAL_MAX_*
// settings are sent, which only a non-nil Config does.
func New(options Options) *Server {
	routes := http.NewServeMux()
	gateway := &Server{options: options, sessions: newLiveSessions()}
	gateway.transport = &webtransport.Server{
		H3: &http3.Server{
			TLSConfig: http3.ConfigureTLSConfig(&tls.Config{
				GetCertificate: options.GetCertificate,
				MinVersion:     tls.VersionTLS13,
			}),
			QUICConfig: &quic.Config{
				InitialStreamReceiveWindow:     options.StreamWindowBytes,
				MaxStreamReceiveWindow:         options.StreamWindowBytes,
				InitialConnectionReceiveWindow: options.SessionWindowBytes,
				MaxConnectionReceiveWindow:     options.SessionWindowBytes,
				MaxIdleTimeout:                 options.IdleTimeout,
			},
			Handler: routes,
		},
		Config: &webtransport.Config{
			MaxIncomingStreams:    int64(options.MaxStreamsPerSession),
			MaxIncomingUniStreams: -1,
			MaxIncomingData:       int64(options.SessionWindowBytes),
		},
		// Node checks the Origin against its allow-list when the upstream is dialled.
		CheckOrigin: func(*http.Request) bool { return true },
	}
	webtransport.ConfigureHTTP3Server(gateway.transport.H3)
	routes.HandleFunc(options.Path, gateway.serve)
	return gateway
}

// Serve accepts on conn until Close.
func (s *Server) Serve(conn net.PacketConn) error { return s.transport.Serve(conn) }

// Drain stops new sessions (GOAWAY), waits for the live ones until ctx ends, then closes everything.
func (s *Server) Drain(ctx context.Context) error {
	drained := s.sessions.drain()
	shutdown := s.transport.H3.Shutdown(ctx)
	select {
	case <-drained:
	case <-ctx.Done():
	}
	return errors.Join(shutdown, s.transport.Close())
}

func (s *Server) serve(response http.ResponseWriter, request *http.Request) {
	// Only a WebTransport CONNECT may spend one of the client's upstream sessions.
	if request.Method != http.MethodConnect || !webTransportProtocols[request.Proto] {
		response.WriteHeader(http.StatusBadRequest)
		return
	}
	if !s.sessions.enter() {
		response.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	defer s.sessions.leave()
	clientAddress, _, err := net.SplitHostPort(request.RemoteAddr)
	if err != nil {
		clientAddress = request.RemoteAddr
	}
	dialCtx, cancel := context.WithTimeout(request.Context(), upstreamDialTimeout)
	upstreamSession, err := s.options.Upstream.Dial(dialCtx, clientAddress, request.Header.Get("Origin"))
	cancel()
	if err != nil {
		status := http.StatusBadGateway
		var refused *upstream.RefusedError
		if errors.As(err, &refused) {
			status = refused.Status
		}
		s.options.Metrics.SessionRefused(status)
		s.options.Logger.Info("session refused", "client", clientAddress, "status", status, "err", err)
		response.WriteHeader(status)
		return
	}
	browserSession, err := s.transport.Upgrade(response, request)
	if err != nil {
		upstreamSession.Close(mux.CloseNormal, "browser upgrade failed")
		s.options.Logger.Debug("upgrade failed", "client", clientAddress, "err", err)
		return
	}
	startedAt := time.Now()
	s.options.Logger.Info("session opened", "client", clientAddress,
		"origin", request.Header.Get("Origin"), "agent", request.Header.Get("User-Agent"))
	s.options.Metrics.SessionStarted()
	defer s.options.Metrics.SessionEnded()
	bridge.Run(browserSession, upstreamSession, s.options.MaxStreamsPerSession, s.options.Metrics, s.options.Logger)
	s.options.Logger.Info("session closed", "client", clientAddress,
		"duration", time.Since(startedAt).Round(time.Second).String(),
		"browser", context.Cause(browserSession.Context()), "upstream", upstreamSession.Err())
}
