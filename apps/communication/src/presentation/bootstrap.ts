import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import { Temporal } from 'temporal-polyfill';
import { CommandRouter } from '../application/CommandRouter';
import type { IServerConfig } from '../application/config/server-config-schema';
import { ConnectionLifecycle } from '../application/ConnectionLifecycle';
import { PresenceBroadcaster } from '../application/PresenceBroadcaster';
import { SignalRelay } from '../application/SignalRelay';
import { PinoAuditLogger } from '../infrastructure/PinoAuditLogger';
import { createPinoLogger, PinoServerLogger } from '../infrastructure/PinoServerLogger';
import { SocketIORoomTransport } from '../infrastructure/SocketIORoomTransport';
import type { IdentityVerifierOverrides } from './bootstrap/identity-verifiers';
import { buildIdentityVerifiers, pickVerifierHealth } from './bootstrap/identity-verifiers';
import { createPublicApp } from './bootstrap/public-app';
import { createRoomBackend } from './bootstrap/room-backend';
import { createDrain } from './bootstrap/server-drain';
import { watchTlsCertificates } from './bootstrap/tls-reload';
import type { LifecycleState } from './http-routes';
import { registerAdminHttpRoutes, registerPublicHttpRoutes } from './http-routes';
import type { CommunicationMetrics } from './metrics';
import { createCommunicationMetrics } from './metrics';
import { registerSocketHandlers } from './socket-handlers';

const ADMIN_HOST = '127.0.0.1';
const SOCKET_PING_INTERVAL_MS = 25_000;
const SOCKET_PING_TIMEOUT_MS = 20_000;

export type BootstrapOverrides = {
  /**
   * Stub one or more verifiers in tests so we don't need the network.
   * Any provider not listed here falls back to its production
   * implementation (Google → JWKS, Yandex → HS256 secret-keyed).
   */
  identityVerifiers?: IdentityVerifierOverrides;
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

function listenedPort(app: FastifyInstance, name: string): number {
  const address = app.server.address();
  if (address === null || typeof address === 'string') {
    throw new Error(`${name} app listen address unavailable`);
  }
  return address.port;
}

/** The composition root: every adapter built and every service wired, nothing listening yet. */
export async function bootstrap(
  config: IServerConfig,
  overrides: BootstrapOverrides = {}
): Promise<BootstrapResult> {
  const rootPino = createPinoLogger(config.logging.level, config.logging.pretty);
  const serverLogger = new PinoServerLogger(rootPino);
  const auditLogger = new PinoAuditLogger(rootPino.child({ audit: true }));
  const verifiers = buildIdentityVerifiers(config.auth, overrides.identityVerifiers ?? {});
  const metrics = createCommunicationMetrics();
  const rooms = await createRoomBackend(config.redis);
  const { publicApp, httpServer } = await createPublicApp(config);

  const lifecycleState: LifecycleState = {
    isReady: false,
    isDraining: false,
    startedAtMs: 0,
    buildInfo: config.build,
    logger: serverLogger,
  };
  registerPublicHttpRoutes(publicApp, {
    verifierHealth: pickVerifierHealth(verifiers),
    lifecycleState,
  });

  const io = new SocketIOServer(httpServer, {
    cors: { origin: config.server.cors_allowed_origins, credentials: true },
    maxHttpBufferSize: config.room.max_http_buffer_bytes,
    pingInterval: SOCKET_PING_INTERVAL_MS,
    pingTimeout: SOCKET_PING_TIMEOUT_MS,
    transports: ['websocket', 'polling'],
  });
  if (rooms.adapterFactory !== null) {
    io.adapter(rooms.adapterFactory);
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
  });
  const signalRelay = new SignalRelay({
    signalTransport: transport,
    roomRegistry: rooms.roomRegistry,
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
    roomRegistry: rooms.roomRegistry,
    audit: auditLogger,
    logger: serverLogger,
    config,
    metrics,
  });

  // A separate Fastify on a separate port, bound to localhost. Hosts /metrics
  // too: counters are reconnaissance data on a public relay.
  const adminApp = Fastify({ logger: false });
  registerAdminHttpRoutes(adminApp, {
    adminToken: config.admin.token,
    logger: serverLogger,
    setLogLevel: level => {
      rootPino.level = level;
    },
    metricsRegistry: metrics.registry,
  });

  let certWatcher = watchTlsCertificates(config.server.tls, httpServer, serverLogger);

  const start = async (): Promise<{ publicPort: number; adminPort: number }> => {
    await publicApp.listen({ port: config.server.port, host: config.server.host });
    await adminApp.listen({ port: config.admin.port, host: ADMIN_HOST });
    lifecycleState.isReady = true;
    lifecycleState.startedAtMs = Temporal.Now.instant().epochMilliseconds;
    return {
      publicPort: listenedPort(publicApp, 'public'),
      adminPort: listenedPort(adminApp, 'admin'),
    };
  };

  const runDrain = createDrain({
    io,
    transport,
    metrics,
    apps: [publicApp, adminApp],
    releaseResources: async () => {
      certWatcher?.stop();
      certWatcher = null;
      await rooms.close();
    },
  });
  const drain = (graceMs?: number): Promise<void> => {
    lifecycleState.isDraining = true;
    return runDrain(graceMs ?? config.server.shutdown_grace_ms);
  };
  const close = (): Promise<void> => drain(config.server.shutdown_grace_ms);

  return { publicApp, adminApp, io, metrics, start, drain, close };
}
