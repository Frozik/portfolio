// Package metrics exposes the gateway's counters in the Prometheus format.
package metrics

import (
	"net/http"
	"strconv"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Metrics are the gateway's counters; safe for concurrent use.
type Metrics struct {
	registry        *prometheus.Registry
	sessions        prometheus.Gauge
	sessionsRefused *prometheus.CounterVec
	streams         prometheus.Counter
	bytes           *prometheus.CounterVec
}

// New registers every metric on a registry of its own.
func New() *Metrics {
	registry := prometheus.NewRegistry()
	metrics := &Metrics{
		registry: registry,
		sessions: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "gateway_sessions", Help: "WebTransport sessions bridged right now.",
		}),
		sessionsRefused: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "gateway_sessions_refused_total", Help: "Sessions refused, by the status answered.",
		}, []string{"status"}),
		streams: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "gateway_streams_total", Help: "Streams bridged.",
		}),
		bytes: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "gateway_bytes_total", Help: "Bytes bridged, by direction.",
		}, []string{"direction"}),
	}
	registry.MustRegister(metrics.sessions, metrics.sessionsRefused, metrics.streams, metrics.bytes)
	return metrics
}

// Handler serves /metrics.
func (m *Metrics) Handler() http.Handler {
	return promhttp.HandlerFor(m.registry, promhttp.HandlerOpts{})
}

func (m *Metrics) SessionStarted() { m.sessions.Inc() }
func (m *Metrics) SessionEnded()   { m.sessions.Dec() }
func (m *Metrics) SessionRefused(status int) {
	m.sessionsRefused.WithLabelValues(strconv.Itoa(status)).Inc()
}
func (m *Metrics) StreamOpened()         { m.streams.Inc() }
func (m *Metrics) BytesUp(bytes int64)   { m.bytes.WithLabelValues("up").Add(float64(bytes)) }
func (m *Metrics) BytesDown(bytes int64) { m.bytes.WithLabelValues("down").Add(float64(bytes)) }
