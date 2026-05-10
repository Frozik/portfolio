// @vitest-environment node
import type { Socket as ClientSocket } from 'socket.io-client';
import { io as ioClient } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { IServerConfig } from '../application/config/server-config-schema';
import type { IVerifierHealth } from '../application/ports/IVerifierHealth';
import type { Result } from '../application/Result';
import { err, ok } from '../application/Result';
import type { AuthErrorCode, TokenClaims } from '../domain/Identity';
import type { IIdentityVerifier } from '../domain/IIdentityVerifier';
import type {
  IExecuteAck,
  IExecuteEvent,
  IInitiateAck,
  IRefreshTokenAck,
  IResponseEvent,
  IRoomPresenceEvent,
  ISignalAck,
  ISignalEventOutbound,
  ITurnCredentialsAck,
} from '../domain/protocol';
import {
  AUTH_REFRESH_TOKEN,
  AUTH_TOKEN_EXPIRING,
  COMMAND_EXECUTE,
  COMMAND_INITIATE,
  COMMAND_RESPONSE,
  ROOM_PRESENCE,
  SERVER_DRAINING,
  SIGNAL_EVENT,
  SIGNAL_PUBLISH,
  TURN_CREDENTIALS_RENEWED,
  TURN_REQUEST_CREDENTIALS,
} from '../domain/protocol';
import type { Milliseconds, UserId } from '../domain/types';
import type { BootstrapResult } from './bootstrap';
import { bootstrap } from './bootstrap';

const ROOM_ID = '550e8400-e29b-41d4-a716-446655440000';
const ALT_ROOM_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_AUDIENCE = 'test-client';
const ONE_SECOND_MS = 1_000;
const HANDSHAKE_TIMEOUT_MS = 1_500;
const TEST_TIMEOUT_MS = 15_000;

function buildConfig(overrides: Partial<IServerConfig> = {}): IServerConfig {
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
      allowlist: [],
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
  };
  return { ...base, ...overrides };
}

type StubIssuedToken = {
  token: string;
  claims: TokenClaims;
};

class StubIdentityVerifier implements IIdentityVerifier, IVerifierHealth {
  private readonly issuedTokens = new Map<string, TokenClaims>();
  public lastFailureAtMs: number | null = null;
  public lastSuccessAtMs: number | null = null;
  public consecutiveFailures = 0;

  issue(
    sub: string,
    name: string,
    options: { ttlSec?: number; iat?: number; sid?: string } = {}
  ): StubIssuedToken {
    const ttlSec = options.ttlSec ?? 3_600;
    const nowSec = Math.floor(Date.now() / ONE_SECOND_MS);
    const iat = options.iat ?? nowSec;
    const claims: TokenClaims = {
      sub: sub as UserId,
      iat: (iat * ONE_SECOND_MS) as Milliseconds,
      exp: ((iat + ttlSec) * ONE_SECOND_MS) as Milliseconds,
      provider: 'google',
      name,
      sid: options.sid,
    };
    const token = `tok-${this.issuedTokens.size + 1}-${sub}`;
    this.issuedTokens.set(token, claims);
    return { token, claims };
  }

  async verify(token: string): Promise<Result<TokenClaims, AuthErrorCode>> {
    const claims = this.issuedTokens.get(token);
    if (claims === undefined) {
      this.lastFailureAtMs = Date.now();
      this.consecutiveFailures += 1;
      return err('auth/invalid-token');
    }
    if (claims.exp <= (Date.now() as Milliseconds)) {
      this.lastFailureAtMs = Date.now();
      this.consecutiveFailures += 1;
      return err('auth/expired-token');
    }
    this.lastSuccessAtMs = Date.now();
    this.consecutiveFailures = 0;
    return ok(claims);
  }

  getJwksFetchHealth(): {
    lastSuccessAtMs: number | null;
    lastFailureAtMs: number | null;
    consecutiveFailures: number;
  } {
    return {
      lastSuccessAtMs: this.lastSuccessAtMs,
      lastFailureAtMs: this.lastFailureAtMs,
      consecutiveFailures: this.consecutiveFailures,
    };
  }
}

type RunningServer = {
  bootstrap: BootstrapResult;
  publicPort: number;
  adminPort: number;
  verifier: StubIdentityVerifier;
};

async function startServer(): Promise<RunningServer> {
  const verifier = new StubIdentityVerifier();
  const config = buildConfig();
  const result = await bootstrap(config, { identityVerifiers: { google: verifier } });
  const ports = await result.start();
  return {
    bootstrap: result,
    publicPort: ports.publicPort,
    adminPort: ports.adminPort,
    verifier,
  };
}

async function stopServer(server: RunningServer): Promise<void> {
  try {
    await server.bootstrap.drain(500);
  } catch {
    // ignore — repeated drain in error paths is fine
  }
}

type ConnectedClient = {
  client: ClientSocket;
  presenceEvents: IRoomPresenceEvent[];
  drainingEvents: Array<Record<string, never>>;
  expiringEvents: Array<{ secondsRemaining: number; expiresAt: string }>;
};

function connectClient(
  port: number,
  auth: { roomId: string; provider: 'google' | 'yandex'; token: string }
): Promise<ConnectedClient> {
  return new Promise((resolve, reject) => {
    const client = ioClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      auth,
    });
    // Buffer protocol events PRIOR to connect resolution so tests don't race
    // the early-broadcast room:presence emitted by the connection handler.
    const presenceEvents: IRoomPresenceEvent[] = [];
    const drainingEvents: Array<Record<string, never>> = [];
    const expiringEvents: Array<{ secondsRemaining: number; expiresAt: string }> = [];
    client.on(ROOM_PRESENCE, (event: IRoomPresenceEvent) => {
      presenceEvents.push(event);
    });
    client.on(SERVER_DRAINING, (event: Record<string, never>) => {
      drainingEvents.push(event);
    });
    client.on(AUTH_TOKEN_EXPIRING, (event: { secondsRemaining: number; expiresAt: string }) => {
      expiringEvents.push(event);
    });

    const timeout = setTimeout(() => {
      client.disconnect();
      reject(new Error('client connect timeout'));
    }, HANDSHAKE_TIMEOUT_MS);
    client.on('connect', () => {
      clearTimeout(timeout);
      resolve({ client, presenceEvents, drainingEvents, expiringEvents });
    });
    client.on('connect_error', error => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function waitFor<T>(
  predicate: () => T | undefined,
  timeoutMs = HANDSHAKE_TIMEOUT_MS
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = predicate();
    if (value !== undefined) {
      return value;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('waitFor: predicate never satisfied');
}

function awaitEvent<T>(
  client: ClientSocket,
  event: string,
  timeoutMs = HANDSHAKE_TIMEOUT_MS
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off(event);
      reject(new Error(`timeout waiting for ${event}`));
    }, timeoutMs);
    client.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function fetchJson(port: number, path: string): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`http://127.0.0.1:${port}${path}`);
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

describe('bootstrap (integration)', () => {
  let server: RunningServer;

  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await stopServer(server);
  });

  it(
    'GET /health/live returns 200 with uptime',
    async () => {
      const result = await fetchJson(server.publicPort, '/health/live');
      expect(result.status).toBe(200);
      const body = result.body as { status: string; uptimeSeconds: number };
      expect(body.status).toBe('ok');
      expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'GET /health/ready returns 200 once started',
    async () => {
      const result = await fetchJson(server.publicPort, '/health/ready');
      expect(result.status).toBe(200);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'GET /health/ready returns 503 while draining',
    async () => {
      const before = await fetchJson(server.publicPort, '/health/ready');
      expect(before.status).toBe(200);

      // Connect a client so drain has a socket to wait on. This keeps the
      // http server open long enough for the /health/ready fetch below.
      const issued = server.verifier.issue('drain-probe', 'Probe');
      const connected = await connectClient(server.publicPort, {
        roomId: ROOM_ID,
        provider: 'google' as const,
        token: issued.token,
      });
      await waitFor(() => connected.presenceEvents[0]);

      // Drain with a longer window so we can query /health/ready while it
      // is mid-drain.
      const drainPromise = server.bootstrap.drain(2_000);
      // Short delay lets isDraining flip + the engine.io 503 middleware
      // install before we hit the route.
      await new Promise(resolve => setTimeout(resolve, 50));
      const draining = await fetchJson(server.publicPort, '/health/ready');
      expect(draining.status).toBe(503);
      const drainBody = draining.body as { status: string };
      expect(drainBody.status).toBe('draining');
      connected.client.disconnect();
      await drainPromise;
    },
    TEST_TIMEOUT_MS
  );

  it(
    'Socket.IO client connects with valid handshake and receives room:presence',
    async () => {
      const issued = server.verifier.issue('user-1', 'Alice');
      const connected = await connectClient(server.publicPort, {
        roomId: ROOM_ID,
        provider: 'google' as const,
        token: issued.token,
      });
      const presence = await waitFor(() => connected.presenceEvents[0]);
      expect(presence.socketCount).toBeGreaterThanOrEqual(1);
      expect(presence.users.find(member => member.userId === 'user-1')).toBeDefined();
      connected.client.disconnect();
    },
    TEST_TIMEOUT_MS
  );

  it(
    'handshake with invalid token surfaces auth/invalid-token via connect_error',
    async () => {
      const failure = await new Promise<{ message: string; data?: unknown }>(resolve => {
        const client = ioClient(`http://127.0.0.1:${server.publicPort}`, {
          transports: ['websocket'],
          forceNew: true,
          reconnection: false,
          auth: { roomId: ROOM_ID, provider: 'google' as const, token: 'bogus' },
        });
        client.on('connect_error', error => {
          const augmented = error as Error & { data?: { code: string } };
          resolve({ message: augmented.message, data: augmented.data });
          client.disconnect();
        });
      });
      expect(failure.message).toBe('auth/invalid-token');
      const data = failure.data as { code: string } | undefined;
      expect(data?.code).toBe('auth/invalid-token');
    },
    TEST_TIMEOUT_MS
  );

  it(
    'two clients in a room: A initiates command, B acks, A receives command:response success',
    async () => {
      const tokenA = server.verifier.issue('user-A', 'Alice');
      const tokenB = server.verifier.issue('user-B', 'Bob');
      const connectedA = await connectClient(server.publicPort, {
        roomId: ROOM_ID,
        provider: 'google' as const,
        token: tokenA.token,
      });
      const connectedB = await connectClient(server.publicPort, {
        roomId: ROOM_ID,
        provider: 'google' as const,
        token: tokenB.token,
      });
      const clientA = connectedA.client;
      const clientB = connectedB.client;

      // Wait for the room to settle to two members.
      await waitFor(() => {
        const latest = connectedA.presenceEvents.at(-1);
        return latest !== undefined && latest.socketCount >= 2 ? latest : undefined;
      });

      clientB.on(COMMAND_EXECUTE, (event: IExecuteEvent, ack: (payload: IExecuteAck) => void) => {
        ack({ payload: { echoed: event.payload }, correlationId: event.correlationId });
      });

      const responsePromise = awaitEvent<IResponseEvent>(clientA, COMMAND_RESPONSE);
      const ackResult = await new Promise<IInitiateAck>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('initiate ack timeout')),
          HANDSHAKE_TIMEOUT_MS
        );
        clientA.emit(
          COMMAND_INITIATE,
          { command: 'echo', payload: { value: 1 }, correlationId: 'corr-1' },
          (response: IInitiateAck) => {
            clearTimeout(timer);
            resolve(response);
          }
        );
      });
      expect(ackResult.correlationId).toBe('corr-1');
      const response = await responsePromise;
      expect(response.kind).toBe('success');
      expect(response.correlationId).toBe('corr-1');

      clientA.disconnect();
      clientB.disconnect();
    },
    TEST_TIMEOUT_MS
  );

  it(
    'signal:publish from A is received by B with recipientCount === 1',
    async () => {
      const tokenA = server.verifier.issue('signal-A', 'SigA');
      const tokenB = server.verifier.issue('signal-B', 'SigB');
      const connectedA = await connectClient(server.publicPort, {
        roomId: ALT_ROOM_ID,
        provider: 'google' as const,
        token: tokenA.token,
      });
      const connectedB = await connectClient(server.publicPort, {
        roomId: ALT_ROOM_ID,
        provider: 'google' as const,
        token: tokenB.token,
      });
      const clientA = connectedA.client;
      const clientB = connectedB.client;
      await waitFor(() => {
        const latest = connectedA.presenceEvents.at(-1);
        return latest !== undefined && latest.socketCount >= 2 ? latest : undefined;
      });

      const receivedPromise = awaitEvent<ISignalEventOutbound>(clientB, SIGNAL_EVENT);
      const ackResult = await new Promise<ISignalAck>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('signal ack timeout')),
          HANDSHAKE_TIMEOUT_MS
        );
        clientA.emit(
          SIGNAL_PUBLISH,
          { payload: { sdp: 'offer' }, correlationId: 'sig-1' },
          (response: ISignalAck) => {
            clearTimeout(timer);
            resolve(response);
          }
        );
      });
      expect(ackResult.ok).toBe(true);
      if (ackResult.ok) {
        expect(ackResult.recipientCount).toBe(1);
      }
      const event = await receivedPromise;
      expect(event.payload).toEqual({ sdp: 'offer' });

      clientA.disconnect();
      clientB.disconnect();
    },
    TEST_TIMEOUT_MS
  );

  it(
    'auth:refresh-token returns ok with new expiresAt',
    async () => {
      const tokenA = server.verifier.issue('refresh-A', 'Alice', { ttlSec: 3 });
      const connected = await connectClient(server.publicPort, {
        roomId: ROOM_ID,
        provider: 'google' as const,
        token: tokenA.token,
      });
      const client = connected.client;
      await waitFor(() => connected.presenceEvents[0]);

      const newToken = server.verifier.issue('refresh-A', 'Alice', {
        ttlSec: 3_600,
        iat: Math.floor(Date.now() / ONE_SECOND_MS) + 5,
      });

      const ack = await new Promise<IRefreshTokenAck>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('refresh ack timeout')),
          HANDSHAKE_TIMEOUT_MS
        );
        client.emit(AUTH_REFRESH_TOKEN, { token: newToken.token }, (response: IRefreshTokenAck) => {
          clearTimeout(timer);
          resolve(response);
        });
      });
      expect(ack.ok).toBe(true);
      if (ack.ok) {
        expect(ack.expiresAt).toBeTruthy();
      }

      client.disconnect();
    },
    TEST_TIMEOUT_MS
  );

  it(
    'auth:refresh-token success emits turn:credentials-renewed (v2 mid-call ICE restart hint)',
    async () => {
      const tokenA = server.verifier.issue('renew-A', 'Alice', { ttlSec: 3 });
      const connected = await connectClient(server.publicPort, {
        roomId: ROOM_ID,
        provider: 'google' as const,
        token: tokenA.token,
      });
      const client = connected.client;
      await waitFor(() => connected.presenceEvents[0]);

      const renewedPromise = awaitEvent<Record<string, never>>(client, TURN_CREDENTIALS_RENEWED);

      const newToken = server.verifier.issue('renew-A', 'Alice', {
        ttlSec: 3_600,
        iat: Math.floor(Date.now() / ONE_SECOND_MS) + 5,
      });
      const ack = await new Promise<IRefreshTokenAck>(resolve => {
        client.emit(AUTH_REFRESH_TOKEN, { token: newToken.token }, (r: IRefreshTokenAck) =>
          resolve(r)
        );
      });
      expect(ack.ok).toBe(true);

      const renewedPayload = await renewedPromise;
      expect(renewedPayload).toEqual({});

      client.disconnect();
    },
    TEST_TIMEOUT_MS
  );

  it(
    'token-expiring fires before refresh and refresh prevents disconnect',
    async () => {
      // Token expires in 3s; warning offset is 1s — warning fires after ~2s.
      const tokenA = server.verifier.issue('exp-A', 'Alice', { ttlSec: 3 });
      const connected = await connectClient(server.publicPort, {
        roomId: ROOM_ID,
        provider: 'google' as const,
        token: tokenA.token,
      });
      const client = connected.client;
      await waitFor(() => connected.presenceEvents[0]);

      const warning = await waitFor(() => connected.expiringEvents[0], 5_000);
      expect(warning.secondsRemaining).toBeGreaterThan(0);

      const newToken = server.verifier.issue('exp-A', 'Alice', {
        ttlSec: 3_600,
        iat: Math.floor(Date.now() / ONE_SECOND_MS) + 5,
      });
      const ack = await new Promise<IRefreshTokenAck>(resolve => {
        client.emit(AUTH_REFRESH_TOKEN, { token: newToken.token }, (r: IRefreshTokenAck) =>
          resolve(r)
        );
      });
      expect(ack.ok).toBe(true);

      client.disconnect();
    },
    TEST_TIMEOUT_MS
  );

  it(
    'turn:request-credentials returns valid credential shape',
    async () => {
      const tokenA = server.verifier.issue('turn-A', 'Alice');
      const connected = await connectClient(server.publicPort, {
        roomId: ROOM_ID,
        provider: 'google' as const,
        token: tokenA.token,
      });
      const client = connected.client;
      await waitFor(() => connected.presenceEvents[0]);

      const ack = await new Promise<ITurnCredentialsAck | { ok: false; error: string }>(
        (resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error('turn ack timeout')),
            HANDSHAKE_TIMEOUT_MS
          );
          client.emit(TURN_REQUEST_CREDENTIALS, {}, (response: ITurnCredentialsAck) => {
            clearTimeout(timer);
            resolve(response);
          });
        }
      );
      expect('username' in ack).toBe(true);
      if ('username' in ack) {
        expect(ack.username).toMatch(/^\d+:[a-f0-9]+$/);
        expect(ack.credential.length).toBeGreaterThan(0);
        expect(ack.urls).toEqual(['turn:turn.example.com:3478']);
        expect(ack.ttl).toBe(3_600);
      }

      client.disconnect();
    },
    TEST_TIMEOUT_MS
  );

  it(
    'drain broadcasts server:draining to connected clients before disconnecting',
    async () => {
      const tokenA = server.verifier.issue('drain-A', 'Alice');
      const connected = await connectClient(server.publicPort, {
        roomId: ROOM_ID,
        provider: 'google' as const,
        token: tokenA.token,
      });
      const client = connected.client;
      await waitFor(() => connected.presenceEvents[0]);

      const drainPromise = server.bootstrap.drain(2_000);
      await waitFor(() => connected.drainingEvents[0], 5_000);
      await drainPromise;
      // After drain, the client should be disconnected.
      expect(client.connected).toBe(false);
    },
    TEST_TIMEOUT_MS
  );
});
