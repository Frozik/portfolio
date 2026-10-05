import type { Server as HttpServer } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

import type { TransportServer } from '@frozik/transport/server/start-transport-server';
import { startTransportServer } from '@frozik/transport/server/start-transport-server';
import type { PinnedCertificateBody } from '@frozik/transport/shared/pinned-certificate';
import { encodePinnedCertificate } from '@frozik/transport/shared/pinned-certificate';
import { Temporal } from 'temporal-polyfill';

import type { IServerConfig } from '../../application/config/server-config-schema';
import type { IServerLogger } from '../../application/ports/IServerLogger';
import { EchoAdmission } from '../../application/transport/EchoAdmission';
import type { CommunicationMetrics } from '../metrics';
import { createTransportRouter } from '../transport/transport-router';

/** Matches the multiplexer's DATA limit, so one echo chunk is one message on either protocol. */
const ECHO_CHUNK_BYTES = 64 * 1024;

export interface TransportEndpoint {
  /** Serves the fallback on the public server and opens the gateway's listener; resolves to its port (0 when off). */
  start(): Promise<number>;
  close(): Promise<void>;
  /** What the development route answers; undefined with a real certificate. */
  readonly pinnedCertificate: PinnedCertificateBody | undefined;
}

export interface TransportEndpointParams {
  readonly config: IServerConfig;
  readonly httpServer: HttpServer;
  readonly logger: IServerLogger;
  readonly metrics: CommunicationMetrics;
}

/** The plot and file services on `@frozik/transport`; this app only supplies its config, services and metrics. */
export function createTransportEndpoint({
  config,
  httpServer,
  logger,
  metrics,
}: TransportEndpointParams): TransportEndpoint {
  const transport = config.transport;
  const router = createTransportRouter(
    {
      maxLength: transport.expression_max_length,
      maxDepth: transport.expression_max_depth,
      maxPoints: transport.sample_max_points,
      chunkPoints: transport.sample_chunk_points,
    },
    {
      admission: new EchoAdmission(
        {
          concurrentPerIp: transport.echo.concurrent_per_ip,
          concurrentTotal: transport.echo.concurrent_total,
          bytesPerIpPerHour: transport.echo.bytes_per_ip_per_hour,
        },
        () => Temporal.Now.instant().epochMilliseconds
      ),
      limits: {
        maxFileBytes: transport.echo.max_file_bytes,
        bytesPerIpPerHour: transport.echo.bytes_per_ip_per_hour,
        rateBytesPerSecond: transport.echo.rate_bytes_per_second,
        maxChunkBytes: ECHO_CHUNK_BYTES,
      },
      sleeper: {
        nowMs: () => Temporal.Now.instant().epochMilliseconds,
        sleep: (ms, signal) => sleep(ms, undefined, { signal }),
      },
      onEchoed: bytes => metrics.counters.transportEchoBytesTotal.inc(bytes),
      onRejected: reason => metrics.counters.transportEchoRejectedTotal.inc({ reason }),
    }
  );

  let server: TransportServer | undefined;
  let gatewayHttp: HttpServer | undefined;
  let pinnedCertificate: PinnedCertificateBody | undefined;

  return {
    get pinnedCertificate() {
      return pinnedCertificate;
    },
    async start() {
      if (!transport.enabled) {
        return 0;
      }
      if (!config.server.tls.enabled) {
        // Development only, and it pulls in an X.509 library: loaded only here.
        const { ensureDevCertificate } = await import('@frozik/transport/server/dev-certificate');
        const sha256 = await ensureDevCertificate(transport.dev_certificate_dir);
        pinnedCertificate = encodePinnedCertificate({ sha256, http3Port: transport.http3_port });
      }
      gatewayHttp = transport.gateway.enabled
        ? await listen(transport.gateway.host, transport.gateway.port)
        : undefined;
      server = startTransportServer({
        handlers: router.handlers,
        path: transport.path,
        websocket: { server: httpServer },
        gateway:
          gatewayHttp === undefined
            ? undefined
            : { server: gatewayHttp, secret: transport.gateway.secret },
        limits: {
          maxSessions: transport.max_sessions,
          maxStreamsPerSession: transport.max_streams_per_session,
          streamIdleTimeoutMs: transport.stream_idle_timeout_ms,
        },
        admission: {
          allowedOrigins: config.server.cors_allowed_origins,
          maxSessionsPerIp: transport.max_sessions_per_ip,
          attemptsPerIpPerMinute: config.security.handshake_rate_per_ip_per_minute,
          behindProxy: config.edge.haproxy_enabled ? ['websocket'] : [],
        },
        onSessionChange: ({ protocol, delta }) =>
          metrics.gauges.transportSessions.inc({ protocol }, delta),
        onError: error =>
          logger.debug('transport.stream-error', {
            message: error instanceof Error ? error.message : String(error),
          }),
      });
      const gatewayPort =
        gatewayHttp === undefined ? 0 : (gatewayHttp.address() as AddressInfo).port;
      logger.info('transport.listening', { path: transport.path, gatewayPort });
      return gatewayPort;
    },
    async close() {
      server?.close();
      server = undefined;
      if (gatewayHttp !== undefined) {
        const closing = gatewayHttp;
        gatewayHttp = undefined;
        closing.closeAllConnections();
        await new Promise(resolve => closing.close(resolve));
      }
    },
  };
}

const HTTP_UPGRADE_REQUIRED = 426;

/** The gateway's own server: WebSocket upgrades only, anything else is told so at once. */
async function listen(host: string, port: number): Promise<HttpServer> {
  const server = createServer((_, response) => response.writeHead(HTTP_UPGRADE_REQUIRED).end());
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });
  return server;
}
