import { readFile } from 'node:fs/promises';
import type { Server as HttpServer } from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';

import type { TransportCertificate } from '@frozik/transport/server/http3-listener';
import type { TransportServer } from '@frozik/transport/server/start-transport-server';
import { startTransportServer } from '@frozik/transport/server/start-transport-server';
import type { PinnedCertificateBody } from '@frozik/transport/shared/pinned-certificate';
import { Temporal } from 'temporal-polyfill';

import type { IServerConfig } from '../../application/config/server-config-schema';
import type { IServerLogger } from '../../application/ports/IServerLogger';
import { EchoAdmission } from '../../application/transport/EchoAdmission';
import type { CertWatcher } from '../../infrastructure/CertWatcher';
import { startCertWatcher } from '../../infrastructure/CertWatcher';
import type { CommunicationMetrics } from '../metrics';
import { createTransportRouter } from '../transport/transport-router';

/** Matches the multiplexer's DATA limit, so one echo chunk is one message on either protocol. */
const ECHO_CHUNK_BYTES = 64 * 1024;

export interface TransportEndpoint {
  /** Listens for HTTP/3 and attaches the WebSocket fallback; resolves to the UDP port. */
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
  let certWatcher: CertWatcher | undefined;

  return {
    get pinnedCertificate() {
      return server?.pinnedCertificate;
    },
    async start() {
      if (!transport.enabled) {
        return 0;
      }
      server = await startTransportServer({
        handlers: router.handlers,
        path: transport.path,
        http3: { host: transport.http3_host, port: transport.http3_port },
        certificate: await certificateOf(config),
        websocket: { server: httpServer },
        limits: {
          maxSessions: transport.max_sessions,
          maxStreamsPerSession: transport.max_streams_per_session,
          streamIdleTimeoutMs: transport.stream_idle_timeout_ms,
          streamWindowBytes: transport.stream_window_bytes,
          sessionWindowBytes: transport.session_window_bytes,
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
      certWatcher = watchCertificate(config, server, logger);
      logger.info('transport.listening', { http3Port: server.http3Port, path: transport.path });
      return server.http3Port;
    },
    async close() {
      certWatcher?.stop();
      certWatcher = undefined;
      await server?.close();
      server = undefined;
    },
  };
}

/** Without TLS (development) the transport makes its own certificate for browsers to pin. */
async function certificateOf(config: IServerConfig): Promise<TransportCertificate | 'self-signed'> {
  const tls = config.server.tls;
  if (!tls.enabled) {
    return 'self-signed';
  }
  const [cert, key] = await Promise.all([
    readFile(tls.cert_path, 'utf8'),
    readFile(tls.key_path, 'utf8'),
  ]);
  return { cert, key };
}

/** The same files the HTTPS server watches; a renewal restarts the HTTP/3 listener. */
function watchCertificate(
  config: IServerConfig,
  server: TransportServer,
  logger: IServerLogger
): CertWatcher | undefined {
  const tls = config.server.tls;
  if (!tls.enabled) {
    return undefined;
  }
  return startCertWatcher({
    certPath: tls.cert_path,
    keyPath: tls.key_path,
    onReload: ({ cert, key }) => {
      server.reloadCertificate({ cert: cert.toString('utf8'), key: key.toString('utf8') }).then(
        () => logger.info('transport.certificate-reloaded'),
        (error: unknown) =>
          logger.warn('transport.certificate-reload-failed', {
            message: error instanceof Error ? error.message : String(error),
          })
      );
    },
    onError: error =>
      logger.warn('transport.certificate-watch-failed', {
        message: error instanceof Error ? error.message : String(error),
      }),
  });
}
