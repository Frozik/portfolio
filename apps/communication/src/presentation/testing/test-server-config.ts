import type { IServerConfig } from '../../application/config/server-config-schema';

const TEST_AUDIENCE = 'test-client';

/** A complete server config on ephemeral ports for integration tests; sections are replaced whole. */
export function buildTestConfig(overrides: Partial<IServerConfig> = {}): IServerConfig {
  const base: IServerConfig = {
    server: {
      port: 0,
      host: '127.0.0.1',
      cors_allowed_origins: ['http://localhost:5173'],
      shutdown_grace_ms: 1_000,
      tls: { enabled: false, cert_path: '', key_path: '' },
    },
    auth: {
      google_oauth_client_id: TEST_AUDIENCE,
      yandex_oauth_client_id: '',
      yandex_oauth_client_secret: '',
      token_expiry_warning_seconds: 1,
      clock_tolerance_seconds: 0,
      jwks: { fetch_max_attempts: 1, fetch_timeout_ms: 100 },
    },
    room: {
      max_listeners: 50,
      response_gather_timeout_ms: 500,
      max_http_buffer_bytes: 1_048_576,
      max_tabs_per_user: 5,
      max_inflight_dispatches_per_socket: 32,
    },
    signal: {
      max_publish_per_second_per_socket: 100,
      max_publish_burst: 200,
      max_payload_bytes: 16_384,
    },
    turn: {
      enabled: true,
      shared_secret: 'test-secret',
      realm: 'test-realm',
      ttl_seconds: 3_600,
      anonymous_ttl_seconds: 600,
      urls: ['turn:turn.example.com:3478'],
      credential_requests_per_minute_per_socket: 5,
    },
    edge: { haproxy_enabled: false },
    security: {
      handshake_rate_per_ip_per_minute: 1_000,
      failed_handshake_block_threshold: 100,
      failed_handshake_block_seconds: 30,
    },
    admin: { token: 'admin-secret', port: 0 },
    logging: { level: 'error', pretty: false },
    build: { id: 'test', commit: 'abc', version: '0.0.0' },
    redis: { enabled: false, url: 'redis://127.0.0.1:6379', key_prefix: 'comm:' },
    transport: {
      enabled: false,
      path: '/transport',
      http3_host: '127.0.0.1',
      http3_port: 0,
      max_sessions: 8,
      max_sessions_per_ip: 8,
      max_streams_per_session: 8,
      stream_idle_timeout_ms: 1_000,
      stream_window_bytes: 262_144,
      session_window_bytes: 1_048_576,
      expression_max_length: 200,
      expression_max_depth: 48,
      sample_max_points: 20_000,
      sample_chunk_points: 1_000,
      echo: {
        max_file_bytes: 1_048_576,
        bytes_per_ip_per_hour: 4_194_304,
        concurrent_per_ip: 2,
        concurrent_total: 4,
        rate_bytes_per_second: 100_000_000,
      },
    },
  };
  return { ...base, ...overrides };
}
