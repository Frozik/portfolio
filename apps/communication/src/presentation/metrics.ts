import { Counter, Gauge, Histogram, Registry } from 'prom-client';

// Default histogram buckets (seconds) per M17.
const DEFAULT_HISTOGRAM_BUCKETS_SECONDS = [0.01, 0.05, 0.1, 0.5, 1, 5, 10] as const;
// Bucket set used for millisecond-scale histograms (signal-publish handler
// duration is reported in ms per spec).
const SIGNAL_PUBLISH_HANDLER_DURATION_BUCKETS_MS = [1, 5, 10, 50, 100, 500, 1_000] as const;
// Per-room fanout listener counts are integer-valued — small linear buckets.
const FANOUT_LISTENERS_BUCKETS = [1, 2, 5, 10, 20, 50, 100] as const;
// Recipients per signal publish — same shape as fanout listeners.
const SIGNAL_PUBLISH_RECIPIENTS_BUCKETS = [1, 2, 5, 10, 20, 50, 100] as const;

export type CommunicationMetrics = {
  registry: Registry;
  histograms: {
    dispatchDurationSeconds: Histogram<string>;
    broadcastFanoutListeners: Histogram<string>;
    authHandshakeDurationSeconds: Histogram<string>;
    jwksFetchDurationSeconds: Histogram<string>;
    responderResponseDurationSeconds: Histogram<'kind'>;
    signalPublishHandlerDurationMs: Histogram<string>;
    signalPublishRecipients: Histogram<string>;
  };
  counters: {
    orphanedResponsesTotal: Counter<string>;
    authHandshakeFailureTotal: Counter<'code'>;
    tokenRefreshTotal: Counter<'outcome'>;
    dispatchRejectedTotal: Counter<'reason'>;
    handshakeRateLimitedTotal: Counter<string>;
    signalPublishTotal: Counter<'outcome'>;
    turnCredentialsIssuedTotal: Counter<string>;
    proxyProtocolParseFailureTotal: Counter<string>;
  };
  gauges: {
    activeRooms: Gauge<string>;
    activeSockets: Gauge<string>;
    pendingCorrelations: Gauge<string>;
    jwksConsecutiveFailures: Gauge<string>;
  };
};

export function createCommunicationMetrics(): CommunicationMetrics {
  const registry = new Registry();

  const histograms = {
    dispatchDurationSeconds: new Histogram({
      name: 'communication_dispatch_duration_seconds',
      help: 'End-to-end command:initiate -> last command:response dispatch duration.',
      buckets: [...DEFAULT_HISTOGRAM_BUCKETS_SECONDS],
      registers: [registry],
    }),
    broadcastFanoutListeners: new Histogram({
      name: 'communication_broadcast_fanout_listeners',
      help: 'Number of responders the dispatch fanned out to (excluding initiator).',
      buckets: [...FANOUT_LISTENERS_BUCKETS],
      registers: [registry],
    }),
    authHandshakeDurationSeconds: new Histogram({
      name: 'communication_auth_handshake_duration_seconds',
      help: 'Duration of the auth handshake including JWKS verify.',
      buckets: [...DEFAULT_HISTOGRAM_BUCKETS_SECONDS],
      registers: [registry],
    }),
    jwksFetchDurationSeconds: new Histogram({
      name: 'communication_jwks_fetch_duration_seconds',
      help: 'Duration of remote JWKS fetches.',
      buckets: [...DEFAULT_HISTOGRAM_BUCKETS_SECONDS],
      registers: [registry],
    }),
    responderResponseDurationSeconds: new Histogram({
      name: 'communication_responder_response_duration_seconds',
      help: 'Duration from execute fanout to per-responder ack/timeout/disconnect.',
      labelNames: ['kind'],
      buckets: [...DEFAULT_HISTOGRAM_BUCKETS_SECONDS],
      registers: [registry],
    }),
    signalPublishHandlerDurationMs: new Histogram({
      name: 'communication_signal_publish_handler_duration_ms',
      help: 'Server-side duration of signal:publish handler in milliseconds.',
      buckets: [...SIGNAL_PUBLISH_HANDLER_DURATION_BUCKETS_MS],
      registers: [registry],
    }),
    signalPublishRecipients: new Histogram({
      name: 'communication_signal_publish_recipients',
      help: 'Number of recipients a signal:publish was fanned out to.',
      buckets: [...SIGNAL_PUBLISH_RECIPIENTS_BUCKETS],
      registers: [registry],
    }),
  };

  const counters = {
    orphanedResponsesTotal: new Counter({
      name: 'communication_orphaned_responses_total',
      help: 'Responder acks received for which no in-flight dispatch exists.',
      registers: [registry],
    }),
    authHandshakeFailureTotal: new Counter({
      name: 'communication_auth_handshake_failure_total',
      help: 'Auth handshake failures by error code.',
      labelNames: ['code'],
      registers: [registry],
    }),
    tokenRefreshTotal: new Counter({
      name: 'communication_token_refresh_total',
      help: 'auth:refresh-token results by outcome.',
      labelNames: ['outcome'],
      registers: [registry],
    }),
    dispatchRejectedTotal: new Counter({
      name: 'communication_dispatch_rejected_total',
      help: 'command:initiate rejections by reason.',
      labelNames: ['reason'],
      registers: [registry],
    }),
    handshakeRateLimitedTotal: new Counter({
      name: 'communication_handshake_rate_limited_total',
      help: 'Handshakes blocked by per-IP rate limit.',
      registers: [registry],
    }),
    signalPublishTotal: new Counter({
      name: 'communication_signal_publish_total',
      help: 'signal:publish results by outcome (ok / rate-limited / invalid-payload / ...).',
      labelNames: ['outcome'],
      registers: [registry],
    }),
    turnCredentialsIssuedTotal: new Counter({
      name: 'communication_turn_credentials_issued_total',
      help: 'TURN credential issuance count.',
      registers: [registry],
    }),
    proxyProtocolParseFailureTotal: new Counter({
      name: 'communication_proxy_protocol_parse_failure_total',
      help: 'PROXY protocol v2 parse failures.',
      registers: [registry],
    }),
  };

  const gauges = {
    activeRooms: new Gauge({
      name: 'communication_active_rooms',
      help: 'Currently active rooms.',
      registers: [registry],
    }),
    activeSockets: new Gauge({
      name: 'communication_active_sockets',
      help: 'Currently connected sockets.',
      registers: [registry],
    }),
    pendingCorrelations: new Gauge({
      name: 'communication_pending_correlations',
      help: 'Number of in-flight dispatch correlations server-wide.',
      registers: [registry],
    }),
    jwksConsecutiveFailures: new Gauge({
      name: 'communication_jwks_consecutive_failures',
      help: 'Consecutive JWKS fetch failures since the last success.',
      registers: [registry],
    }),
  };

  return { registry, histograms, counters, gauges };
}
