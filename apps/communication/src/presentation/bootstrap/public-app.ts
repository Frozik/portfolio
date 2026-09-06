import { readFileSync } from 'node:fs';
import type { Server as HttpServer, IncomingMessage, ServerResponse } from 'node:http';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import fastifyRateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import type { IServerConfig } from '../../application/config/server-config-schema';

const HTTP_NO_CONTENT = 204;
const HTTP_NOT_FOUND = 404;
const PREFLIGHT_MAX_AGE_SECONDS = '86400';

export type PublicApp = {
  publicApp: FastifyInstance;
  /** Bound to BOTH Fastify (HTTP routes) and Socket.IO (WebSocket upgrades). */
  httpServer: HttpServer;
};

function buildHttpServer(
  tls: IServerConfig['server']['tls'],
  handler: (req: IncomingMessage, res: ServerResponse) => void
): HttpServer {
  if (tls.enabled) {
    const cert = readFileSync(tls.cert_path);
    const key = readFileSync(tls.key_path);
    return createHttpsServer({ cert, key }, handler) as unknown as HttpServer;
  }
  return createHttpServer(handler);
}

/**
 * CORS for the HTTP routes (`/health/*`, `/metrics`). Socket.IO has its own
 * CORS config; this only covers the Fastify surface. Hand-rolled to avoid a
 * dependency for two headers.
 */
function registerCors(app: FastifyInstance, allowedOrigins: ReadonlySet<string>): void {
  app.addHook('onSend', async (request, reply) => {
    const origin = request.headers.origin;
    if (typeof origin === 'string' && allowedOrigins.has(origin)) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Vary', 'Origin');
      reply.header('Access-Control-Allow-Credentials', 'true');
    }
  });
  app.options('/*', async (request, reply) => {
    const origin = request.headers.origin;
    if (typeof origin === 'string' && allowedOrigins.has(origin)) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      reply.header('Access-Control-Max-Age', PREFLIGHT_MAX_AGE_SECONDS);
      reply.header('Vary', 'Origin');
      return reply.status(HTTP_NO_CONTENT).send();
    }
    return reply.status(HTTP_NOT_FOUND).send();
  });
}

/**
 * The public Fastify app over its own http(s) server. Fastify's `serverFactory`
 * is invoked once with a request handler; the server it returns is captured so
 * Socket.IO can be mounted on the very same one.
 */
export async function createPublicApp(config: IServerConfig): Promise<PublicApp> {
  let capturedHttpServer: HttpServer | null = null;
  const publicApp = Fastify({
    serverFactory: (handler: (req: IncomingMessage, res: ServerResponse) => void) => {
      const server = buildHttpServer(config.server.tls, handler);
      capturedHttpServer = server;
      return server;
    },
    logger: false,
  });
  await publicApp.register(fastifyRateLimit, {
    max: config.security.handshake_rate_per_ip_per_minute,
    timeWindow: '1 minute',
  });
  registerCors(publicApp, new Set(config.server.cors_allowed_origins));

  // Touching `server` forces the factory to run synchronously, so the captured
  // server is populated before Socket.IO attaches.
  const httpServer: HttpServer = publicApp.server;
  if (capturedHttpServer === null) {
    throw new Error('http server factory did not run');
  }
  return { publicApp, httpServer };
}
