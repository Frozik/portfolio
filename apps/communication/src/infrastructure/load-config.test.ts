import { describe, expect, it } from 'vitest';
import { ConfigValidationError, loadConfigFromObject } from './load-config';

const VALID_CONFIG = {
  server: {
    port: 4445,
    host: '0.0.0.0',
    cors_allowed_origins: ['http://localhost:5173'],
    shutdown_grace_ms: 11000,
    tls: {
      enabled: false,
      cert_path: '',
      key_path: '',
    },
  },
  auth: {
    google_oauth_client_id: 'client-id-1',
    token_expiry_warning_seconds: 60,
    clock_tolerance_seconds: 5,
    jwks: {
      fetch_max_attempts: 3,
      fetch_timeout_ms: 5000,
    },
  },
  room: {
    max_listeners: 50,
    response_gather_timeout_ms: 10000,
    max_http_buffer_bytes: 1048576,
    max_tabs_per_user: 5,
    max_inflight_dispatches_per_socket: 32,
    allowlist: [],
  },
  signal: {
    max_publish_per_second_per_socket: 100,
    max_publish_burst: 200,
    max_payload_bytes: 16384,
  },
  turn: {
    enabled: false,
    shared_secret: '',
    realm: '',
    ttl_seconds: 43200,
    urls: [],
    credential_requests_per_minute_per_socket: 5,
  },
  edge: {
    haproxy_enabled: false,
  },
  security: {
    handshake_rate_per_ip_per_minute: 60,
    failed_handshake_block_threshold: 10,
    failed_handshake_block_seconds: 30,
  },
  admin: {
    token: 'admin-token',
    port: 4446,
  },
  logging: {
    level: 'info' as const,
    pretty: false,
  },
  build: {
    id: 'build-1',
    commit: 'commit-1',
    version: '1.0.0',
  },
  redis: {
    enabled: false,
    url: 'redis://127.0.0.1:6379',
    key_prefix: 'comm:',
  },
};

function cloneConfig(): typeof VALID_CONFIG {
  return JSON.parse(JSON.stringify(VALID_CONFIG)) as typeof VALID_CONFIG;
}

describe('loadConfigFromObject', () => {
  it('returns typed config when input is valid', () => {
    const result = loadConfigFromObject(VALID_CONFIG);
    expect(result.server.port).toBe(4445);
    expect(result.logging.level).toBe('info');
  });

  it('throws ConfigValidationError when a required key is missing', () => {
    const broken = cloneConfig() as unknown as Record<string, unknown>;
    delete (broken.server as Record<string, unknown>).port;
    expect(() => loadConfigFromObject(broken)).toThrowError(ConfigValidationError);
  });

  it('throws when a value has the wrong type', () => {
    const broken = cloneConfig() as unknown as Record<string, unknown>;
    (broken.server as Record<string, unknown>).port = 'not-a-number';
    let captured: unknown;
    try {
      loadConfigFromObject(broken);
    } catch (caught) {
      captured = caught;
    }
    expect(captured).toBeInstanceOf(ConfigValidationError);
    const issues = (captured as ConfigValidationError).issues;
    expect(issues.some(issue => issue.path === 'server.port')).toBe(true);
  });

  it('rejects empty CORS allow-list under production refinements', () => {
    const broken = cloneConfig();
    broken.server.cors_allowed_origins = [];
    expect(() => loadConfigFromObject(broken, { isProduction: true })).toThrowError(
      ConfigValidationError
    );
  });

  it('rejects wildcard "*" in CORS allow-list under production refinements', () => {
    const broken = cloneConfig();
    broken.server.cors_allowed_origins = ['*'];
    expect(() => loadConfigFromObject(broken, { isProduction: true })).toThrowError(
      ConfigValidationError
    );
  });

  it('requires non-empty google_oauth_client_id in production', () => {
    const broken = cloneConfig();
    broken.auth.google_oauth_client_id = '';
    expect(() => loadConfigFromObject(broken, { isProduction: true })).toThrow(
      /google_oauth_client_id/
    );
  });

  it('requires turn.shared_secret when turn is enabled in production', () => {
    const broken = cloneConfig();
    broken.turn.enabled = true;
    broken.turn.shared_secret = '';
    expect(() => loadConfigFromObject(broken, { isProduction: true })).toThrow(/shared_secret/);
  });

  it('passes happy dev path without production refinements (empty CORS allowed)', () => {
    const dev = cloneConfig();
    dev.server.cors_allowed_origins = [];
    expect(() => loadConfigFromObject(dev)).not.toThrow();
  });

  it('passes valid production config', () => {
    const prod = cloneConfig();
    prod.server.cors_allowed_origins = ['https://example.com'];
    prod.auth.google_oauth_client_id = 'prod-client-id';
    prod.turn.enabled = true;
    prod.turn.shared_secret = 'prod-secret';
    expect(() => loadConfigFromObject(prod, { isProduction: true })).not.toThrow();
  });

  it('rejects empty turn.shared_secret separately from CORS issue (multi-issue list)', () => {
    const broken = cloneConfig();
    broken.server.cors_allowed_origins = [];
    broken.turn.enabled = true;
    broken.turn.shared_secret = '';
    let captured: unknown;
    try {
      loadConfigFromObject(broken, { isProduction: true });
    } catch (caught) {
      captured = caught;
    }
    expect(captured).toBeInstanceOf(ConfigValidationError);
    const paths = (captured as ConfigValidationError).issues.map(issue => issue.path);
    expect(paths).toContain('server.cors_allowed_origins');
    expect(paths).toContain('turn.shared_secret');
  });
});
