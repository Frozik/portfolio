import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Registry } from 'prom-client';
import { Temporal } from 'temporal-polyfill';
import { z } from 'zod';
import type { IServerLogger } from '../application/ports/IServerLogger';
import type { IVerifierHealth } from '../application/ports/IVerifierHealth';

const MS_PER_SECOND = 1_000;

// /health/ready turns 503 once the JWKS verifier has racked up at least this
// many failures AND the most recent failure is more than `JWKS_DEGRADATION_WINDOW_MS`
// after the last success — per M16 m5.
const JWKS_DEGRADATION_FAILURE_THRESHOLD = 5;
const JWKS_DEGRADATION_WINDOW_MS = 60_000;

const STATUS_OK = 200;
const STATUS_SERVICE_UNAVAILABLE = 503;
const STATUS_UNAUTHORIZED = 401;
const STATUS_BAD_REQUEST = 400;

export type LifecycleState = {
  isReady: boolean;
  isDraining: boolean;
  startedAtMs: number;
  buildInfo: { id: string; commit: string; version: string };
  logger: IServerLogger;
};

export type PublicRoutesDeps = {
  verifierHealth: IVerifierHealth;
  lifecycleState: LifecycleState;
};

export type AdminRoutesDeps = {
  adminToken: string;
  logger: IServerLogger;
  /** Mutable hook so /admin/log-level can re-tune the live pino logger. */
  setLogLevel: (level: 'debug' | 'info' | 'warn' | 'error') => void;
  metricsRegistry: Registry;
};

const LogLevelBodySchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']),
});

export function registerPublicHttpRoutes(app: FastifyInstance, deps: PublicRoutesDeps): void {
  app.get('/health/live', (_request: FastifyRequest, reply: FastifyReply) => {
    const now = Temporal.Now.instant().epochMilliseconds;
    const uptimeSeconds = Math.max(
      0,
      Math.floor((now - deps.lifecycleState.startedAtMs) / MS_PER_SECOND)
    );
    return reply.code(STATUS_OK).send({ status: 'ok', uptimeSeconds });
  });

  app.get('/health/ready', (_request: FastifyRequest, reply: FastifyReply) => {
    const lifecycle = deps.lifecycleState;
    const health = deps.verifierHealth.getJwksFetchHealth();

    if (!lifecycle.isReady) {
      return reply.code(STATUS_SERVICE_UNAVAILABLE).send({
        status: 'starting',
        jwks: health,
        build: lifecycle.buildInfo,
      });
    }
    if (lifecycle.isDraining) {
      return reply.code(STATUS_SERVICE_UNAVAILABLE).send({
        status: 'draining',
        jwks: health,
        build: lifecycle.buildInfo,
      });
    }
    if (isJwksDegraded(health)) {
      return reply.code(STATUS_SERVICE_UNAVAILABLE).send({
        status: 'jwks-degraded',
        jwks: health,
        build: lifecycle.buildInfo,
      });
    }

    return reply.code(STATUS_OK).send({
      status: 'ready',
      jwks: {
        lastSuccessAt:
          health.lastSuccessAtMs === null
            ? null
            : Temporal.Instant.fromEpochMilliseconds(health.lastSuccessAtMs).toString(),
        lastFailureAt:
          health.lastFailureAtMs === null
            ? null
            : Temporal.Instant.fromEpochMilliseconds(health.lastFailureAtMs).toString(),
        consecutiveFailures: health.consecutiveFailures,
      },
      build: lifecycle.buildInfo,
    });
  });
}

export function registerAdminHttpRoutes(adminApp: FastifyInstance, deps: AdminRoutesDeps): void {
  // Prometheus metrics live on the admin app (bound to 127.0.0.1): room and
  // auth-failure counters are reconnaissance data for a public-facing relay.
  // No bearer token — the loopback bind is the access control, and a token
  // would complicate the local Prometheus scrape config for nothing.
  adminApp.get('/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    const body = await deps.metricsRegistry.metrics();
    return reply
      .code(STATUS_OK)
      .header('content-type', deps.metricsRegistry.contentType)
      .send(body);
  });

  adminApp.post('/admin/log-level', async (request: FastifyRequest, reply: FastifyReply) => {
    if (deps.adminToken === '') {
      return reply.code(STATUS_UNAUTHORIZED).send({ ok: false, error: 'admin-disabled' });
    }
    if (!bearerTokenMatches(request.headers.authorization, deps.adminToken)) {
      return reply.code(STATUS_UNAUTHORIZED).send({ ok: false, error: 'unauthorized' });
    }
    const parsed = LogLevelBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(STATUS_BAD_REQUEST).send({ ok: false, error: 'invalid-body' });
    }
    deps.setLogLevel(parsed.data.level);
    deps.logger.info('admin.log-level-changed', { level: parsed.data.level });
    return reply.code(STATUS_OK).send({ ok: true });
  });
}

/** Constant-time bearer comparison — `!==` leaks the match length via timing */
function bearerTokenMatches(header: string | undefined, adminToken: string): boolean {
  if (typeof header !== 'string') {
    return false;
  }
  const expected = Buffer.from(`Bearer ${adminToken}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function isJwksDegraded(health: {
  lastSuccessAtMs: number | null;
  lastFailureAtMs: number | null;
  consecutiveFailures: number;
}): boolean {
  if (health.consecutiveFailures < JWKS_DEGRADATION_FAILURE_THRESHOLD) {
    return false;
  }
  if (health.lastFailureAtMs === null) {
    return false;
  }
  // If we have never succeeded, but we DO have repeated failures past the
  // threshold, we are clearly not healthy.
  if (health.lastSuccessAtMs === null) {
    return true;
  }
  return health.lastFailureAtMs - health.lastSuccessAtMs > JWKS_DEGRADATION_WINDOW_MS;
}
