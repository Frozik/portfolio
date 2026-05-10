import { readFileSync } from 'node:fs';
import type { Server as HttpServer, IncomingMessage, ServerResponse } from 'node:http';
import { createServer as createHttpServer } from 'node:http';
import type { Server as HttpsServer } from 'node:https';
import { createServer as createHttpsServer } from 'node:https';
import fastifyRateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import type { Logger as PinoLogger } from 'pino';
import { Server as SocketIOServer } from 'socket.io';
import { Temporal } from 'temporal-polyfill';
import { CommandRouter } from '../application/CommandRouter';
import { ConnectionLifecycle } from '../application/ConnectionLifecycle';
import type { IServerConfig } from '../application/config/server-config-schema';
import { PresenceBroadcaster } from '../application/PresenceBroadcaster';
import type { IVerifierHealth } from '../application/ports/IVerifierHealth';
import { SignalRelay } from '../application/SignalRelay';
import type { TIdentityProvider } from '../domain/IdentityProvider';
import type { IIdentityVerifier } from '../domain/IIdentityVerifier';
import { InMemoryRoomRegistry } from '../domain/InMemoryRoomRegistry';
import type { IRoomRegistry } from '../domain/IRoomRegistry';
import type { CertWatcher } from '../infrastructure/CertWatcher';
import { startCertWatcher } from '../infrastructure/CertWatcher';
import { createRedisAdapterFactory } from '../infrastructure/createRedisAdapter';
import { PinoAuditLogger } from '../infrastructure/PinoAuditLogger';
import { createPinoLogger, PinoServerLogger } from '../infrastructure/PinoServerLogger';
import { RedisRoomRegistry } from '../infrastructure/RedisRoomRegistry';
import { SocketIORoomTransport } from '../infrastructure/SocketIORoomTransport';
import { VERIFIER_FACTORIES } from '../infrastructure/verifier-registry';
import type { LifecycleState } from './http-routes';
import { registerAdminHttpRoutes, registerPublicHttpRoutes } from './http-routes';
import type { CommunicationMetrics } from './metrics';
import { createCommunicationMetrics } from './metrics';
import { registerSocketHandlers } from './socket-handlers';

const DRAIN_POLL_INTERVAL_MS = 100;
const ADMIN_HOST = '127.0.0.1';

export type BootstrapOverrides = {
  /**
   * Stub one or more verifiers in tests so we don't need the network.
   * Any provider not listed here falls back to its production
   * implementation (Google → JWKS, Yandex → HS256 secret-keyed).
   */
  identityVerifiers?: Partial<
    Record<TIdentityProvider, IIdentityVerifier & Partial<IVerifierHealth>>
  >;
};

export type BootstrapResult = {
  publicApp: FastifyInstance;
  adminApp: FastifyInstance;
  io: SocketIOServer;
  metrics: CommunicationMetrics;
  start: () => Promise<{ publicPort: number; adminPort: number }>;
  drain: (graceMs?: number) => Promise<void>;
  close: () => Promise<void>;
};

export async function bootstrap(
  config: IServerConfig,
  overrides: BootstrapOverrides = {}
): Promise<BootstrapResult> {
  const rootPino: PinoLogger = createPinoLogger(config.logging.level, config.logging.pretty);
  const serverLogger = new PinoServerLogger(rootPino);
  const auditPino = rootPino.child({ audit: true });
  const auditLogger = new PinoAuditLogger(auditPino);

  // Build the provider → verifier map by iterating the registered
  // factory list. Each factory decides whether its provider has the
  // config it needs (Google requires `google_oauth_client_id`; Yandex
  // requires both client_id + client_secret). Test overrides win
  // unconditionally so integration tests can stub a verifier without
  // also satisfying its real config requirements.
  const verifiers = new Map<TIdentityProvider, IIdentityVerifier & Partial<IVerifierHealth>>();
  for (const factory of VERIFIER_FACTORIES) {
    const override = overrides.identityVerifiers?.[factory.id];
    if (override !== undefined) {
      verifiers.set(factory.id, override);
    } else if (factory.isConfigured(config.auth)) {
      verifiers.set(factory.id, factory.build(config.auth));
    }
  }

  // Pick the first registered verifier that exposes JWKS-fetch health
  // for the public `/health` endpoint. In practice that is Google
  // (Yandex is HS256-symmetric — its `IVerifierHealth` impl returns
  // dummy stats, fine to surface). Falls back to a stub when no
  // verifier is registered (development with no providers configured).
  const verifierHealth: IVerifierHealth = pickHealthVerifier(verifiers) ?? {
    getJwksFetchHealth: () => ({
      lastSuccessAtMs: null,
      lastFailureAtMs: null,
      consecutiveFailures: 0,
    }),
  };

  const metrics = createCommunicationMetrics();

  // v2: optional Redis-backed room registry + Socket.IO adapter. When the
  // [redis] section is disabled (default), we keep the single-process
  // in-memory implementation. When enabled, both the registry and the
  // adapter share the same `key_prefix` so a single redis-cli MONITOR
  // shows the full system state under one prefix.
  let roomRegistry: IRoomRegistry;
  let redisAdapterCleanup: (() => Promise<void>) | null = null;
  let redisAdapterFactory:
    | Awaited<ReturnType<typeof createRedisAdapterFactory>>['adapterFactory']
    | null = null;
  if (config.redis.enabled) {
    const { createClient } = await import('redis');
    const redisClient = createClient({ url: config.redis.url });
    await redisClient.connect();
    roomRegistry = new RedisRoomRegistry({
      client: redisClient,
      keyPrefix: config.redis.key_prefix,
    });
    const adapter = await createRedisAdapterFactory({
      url: config.redis.url,
      keyPrefix: config.redis.key_prefix,
    });
    redisAdapterFactory = adapter.adapterFactory;
    redisAdapterCleanup = async (): Promise<void> => {
      await adapter.close();
      try {
        await redisClient.quit();
      } catch {
        // Already-closed clients throw; ignore.
      }
    };
  } else {
    roomRegistry = new InMemoryRoomRegistry();
  }

  // Fastify's `serverFactory` is invoked once with a request handler; the
  // returned http.Server is bound to BOTH Fastify (HTTP routes) and Socket.IO
  // (WebSocket upgrades). Capture it from inside the factory so we can mount
  // Socket.IO on the same server.
  let capturedHttpServer: HttpServer | null = null;
  const publicApp = Fastify({
    serverFactory: (handler: (req: IncomingMessage, res: ServerResponse) => void) => {
      const server = buildHttpServer(config, handler);
      capturedHttpServer = server;
      return server;
    },
    logger: false,
  });
  await publicApp.register(fastifyRateLimit, {
    max: config.security.handshake_rate_per_ip_per_minute,
    timeWindow: '1 minute',
  });

  // CORS for HTTP routes (/health/*, /metrics). Socket.IO has its own
  // CORS config in `new SocketIOServer({ cors })` below — this hook only
  // covers the Fastify HTTP surface. Hand-rolled to avoid a new dep.
  const allowedOrigins = new Set(config.server.cors_allowed_origins);
  publicApp.addHook('onSend', async (request, reply) => {
    const origin = request.headers.origin;
    if (typeof origin === 'string' && allowedOrigins.has(origin)) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Vary', 'Origin');
      reply.header('Access-Control-Allow-Credentials', 'true');
    }
  });
  publicApp.options('/*', async (request, reply) => {
    const origin = request.headers.origin;
    if (typeof origin === 'string' && allowedOrigins.has(origin)) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      reply.header('Access-Control-Max-Age', '86400');
      reply.header('Vary', 'Origin');
      return reply.status(204).send();
    }
    return reply.status(404).send();
  });
  // Touch publicApp.server to force serverFactory to run synchronously so
  // capturedHttpServer is populated before Socket.IO attaches.
  const httpServer: HttpServer = publicApp.server;
  if (capturedHttpServer === null) {
    throw new Error('http server factory did not run');
  }

  const lifecycleState: LifecycleState = {
    isReady: false,
    isDraining: false,
    startedAtMs: 0,
    buildInfo: config.build,
    logger: serverLogger,
  };

  registerPublicHttpRoutes(publicApp, {
    verifierHealth,
    metricsRegistry: metrics.registry,
    lifecycleState,
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.server.cors_allowed_origins,
      credentials: true,
    },
    maxHttpBufferSize: config.room.max_http_buffer_bytes,
    pingInterval: 25_000,
    pingTimeout: 20_000,
    transports: ['websocket', 'polling'],
  });

  if (redisAdapterFactory !== null) {
    // The adapter factory expects to be passed as Socket.IO's adapter — once
    // installed every namespace's broadcasts fan out via Redis pub/sub.
    io.adapter(redisAdapterFactory);
  }

  const transport = new SocketIORoomTransport(io);

  const commandRouter = new CommandRouter({
    commandTransport: transport,
    logger: serverLogger,
    auditLogger,
    maxInflightPerSocket: config.room.max_inflight_dispatches_per_socket,
    responseTimeoutMs: config.room.response_gather_timeout_ms,
  });

  const presenceBroadcaster = new PresenceBroadcaster({ presenceTransport: transport });

  const connectionLifecycle = new ConnectionLifecycle({
    verifiers,
    audit: auditLogger,
    logger: serverLogger,
    roomAllowlist: config.room.allowlist,
  });

  const signalRelay = new SignalRelay({
    signalTransport: transport,
    roomRegistry,
    ratePerSec: config.signal.max_publish_per_second_per_socket,
    burst: config.signal.max_publish_burst,
    payloadMaxBytes: config.signal.max_payload_bytes,
  });

  registerSocketHandlers(io, {
    connectionLifecycle,
    commandRouter,
    signalRelay,
    presenceBroadcaster,
    transport,
    roomRegistry,
    audit: auditLogger,
    logger: serverLogger,
    config,
    metrics,
  });

  // Admin app — separate Fastify on a separate port, bound to localhost.
  const adminApp = Fastify({ logger: false });
  registerAdminHttpRoutes(adminApp, {
    adminToken: config.admin.token,
    logger: serverLogger,
    setLogLevel: (level: 'debug' | 'info' | 'warn' | 'error') => {
      rootPino.level = level;
    },
  });

  // v2: zero-drop TLS context reload. When TLS is on, watch the cert + key
  // and call `httpsServer.setSecureContext` whenever they change — keeps
  // active Socket.IO sessions alive across cert renewals (replaces the M14
  // 2-phase drain). Best-effort: on any error we leave the existing context
  // in place; the next certbot deploy hook will retry.
  let certWatcher: CertWatcher | null = null;
  if (config.server.tls.enabled && isHttpsServer(httpServer)) {
    const httpsServer = httpServer;
    certWatcher = startCertWatcher({
      certPath: config.server.tls.cert_path,
      keyPath: config.server.tls.key_path,
      onReload: ({ cert, key }) => {
        try {
          httpsServer.setSecureContext({ cert, key });
          serverLogger.info('cert-watcher.reloaded', { source: 'fs.watch' });
        } catch (caught) {
          serverLogger.warn('cert-watcher.set-secure-context-failed', {
            message: caught instanceof Error ? caught.message : String(caught),
          });
        }
      },
      onError: caught => {
        serverLogger.warn('cert-watcher.refresh-failed', {
          message: caught instanceof Error ? caught.message : String(caught),
        });
      },
    });
  }

  let publicAddress: { port: number } | null = null;
  let adminAddress: { port: number } | null = null;

  const start = async (): Promise<{ publicPort: number; adminPort: number }> => {
    await publicApp.listen({ port: config.server.port, host: config.server.host });
    await adminApp.listen({ port: config.admin.port, host: ADMIN_HOST });
    const publicAddr = publicApp.server.address();
    const adminAddr = adminApp.server.address();
    if (publicAddr === null || typeof publicAddr === 'string') {
      throw new Error('public app listen address unavailable');
    }
    if (adminAddr === null || typeof adminAddr === 'string') {
      throw new Error('admin app listen address unavailable');
    }
    publicAddress = { port: publicAddr.port };
    adminAddress = { port: adminAddr.port };
    lifecycleState.isReady = true;
    lifecycleState.startedAtMs = Temporal.Now.instant().epochMilliseconds;
    return { publicPort: publicAddress.port, adminPort: adminAddress.port };
  };

  // Guards against re-installing the engine.io drain middleware on repeated
  // drain() calls (e.g. close() invokes drain(); SIGTERM may also). Without
  // this, the middleware stack would grow on every call.
  let drainMiddlewareInstalled = false;

  const drain = async (graceMs?: number): Promise<void> => {
    const window = graceMs ?? config.server.shutdown_grace_ms;
    lifecycleState.isDraining = true;

    // Tell every connected client we're going down so they can plan a
    // reconnect.
    for (const [, socket] of io.sockets.sockets) {
      const data = socket.data as { roomId?: string };
      if (typeof data.roomId === 'string') {
        transport.emitDraining(data.roomId as never);
      }
    }

    // Refuse new upgrades — engine.io middleware short-circuits with 503.
    if (!drainMiddlewareInstalled) {
      io.engine.use(
        (_req: unknown, res: { writeHead: (status: number) => void; end: () => void }) => {
          res.writeHead(503);
          res.end();
        }
      );
      drainMiddlewareInstalled = true;
    }

    const drainStart = Temporal.Now.instant().epochMilliseconds;
    while (Temporal.Now.instant().epochMilliseconds - drainStart < window) {
      const pending = await metrics.gauges.pendingCorrelations.get();
      const value = pending.values[0]?.value ?? 0;
      if (value === 0 && io.sockets.sockets.size === 0) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, DRAIN_POLL_INTERVAL_MS));
    }

    for (const [, socket] of io.sockets.sockets) {
      socket.disconnect(true);
    }

    await new Promise<void>((resolve, reject) => {
      io.close(error => {
        if (error !== undefined) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    await publicApp.close();
    await adminApp.close();

    certWatcher?.stop();
    certWatcher = null;

    if (redisAdapterCleanup !== null) {
      try {
        await redisAdapterCleanup();
      } catch {
        // Cleanup errors during shutdown are non-fatal — Redis sockets may
        // already be closed by the time we reach this point.
      }
    }
  };

  const close = (): Promise<void> => drain(config.server.shutdown_grace_ms);

  return { publicApp, adminApp, io, metrics, start, drain, close };
}

function buildHttpServer(
  config: IServerConfig,
  handler: (req: IncomingMessage, res: ServerResponse) => void
): HttpServer {
  if (config.server.tls.enabled) {
    const cert = readFileSync(config.server.tls.cert_path);
    const key = readFileSync(config.server.tls.key_path);
    return createHttpsServer({ cert, key }, handler) as unknown as HttpServer;
  }
  return createHttpServer(handler);
}

function isVerifierHealth(value: object): value is IVerifierHealth {
  return typeof (value as { getJwksFetchHealth?: unknown }).getJwksFetchHealth === 'function';
}

function pickHealthVerifier(
  verifiers: ReadonlyMap<TIdentityProvider, IIdentityVerifier & Partial<IVerifierHealth>>
): IVerifierHealth | null {
  for (const verifier of verifiers.values()) {
    if (isVerifierHealth(verifier)) {
      return verifier;
    }
  }
  return null;
}

function isHttpsServer(server: HttpServer): server is HttpsServer {
  // `setSecureContext` is the load-bearing method we need — duck-type check
  // is sufficient and avoids adding a runtime import of node:https.
  return typeof (server as { setSecureContext?: unknown }).setSecureContext === 'function';
}
