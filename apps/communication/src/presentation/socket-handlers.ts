import {
  AUTH_REFRESH_TOKEN,
  COMMAND_INITIATE,
  SIGNAL_PUBLISH,
  TURN_REQUEST_CREDENTIALS,
} from '@frozik/communication-protocol/events';
import type {
  IInitiateAck,
  IRefreshTokenAck,
  SignalAck as ISignalAck,
  ITurnCredentialsAck,
} from '@frozik/communication-protocol/messages';
import { assert } from '@frozik/utils/assert/assert';
import type { Socket, Server as SocketIOServer } from 'socket.io';
import { Temporal } from 'temporal-polyfill';
import type { CommandRouter } from '../application/CommandRouter';
import type { IServerConfig } from '../application/config/server-config-schema';
import type { ConnectionLifecycle } from '../application/ConnectionLifecycle';
import { hashUserId } from '../application/hashUserId';
import { issueTurnCredentials } from '../application/IssueTurnCredentialsUseCase';
import type { IAuditLogger } from '../application/ports/IAuditLogger';
import type { ILifecycleTransport } from '../application/ports/ILifecycleTransport';
import type { IServerLogger } from '../application/ports/IServerLogger';
import type { PresenceBroadcaster } from '../application/PresenceBroadcaster';
import type { SignalRelay } from '../application/SignalRelay';
import { TokenLifecycle } from '../application/TokenLifecycle';
import { InvalidPayloadError } from '../domain/errors';
import type { AuthErrorCode, Identity, TokenClaims } from '../domain/Identity';
import type { IRoomRegistry } from '../domain/IRoomRegistry';
import { parseInitiatePayload, parseRefreshTokenPayload } from '../domain/protocol-validators';
import type { RoomId } from '../domain/types';
import { assertDisplayName, assertRoomId } from '../domain/types';
import type { CommunicationMetrics } from './metrics';

const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const HANDSHAKE_BLOCK_PRUNE_FACTOR = 2;

type RateLimitWindow = {
  failures: number;
  blockedUntilMs: number;
  windowStartMs: number;
};

type AttemptWindow = {
  attempts: number;
  windowStartMs: number;
};

const ATTEMPT_WINDOW_MS = SECONDS_PER_MINUTE * MS_PER_SECOND;

type SocketContextData = {
  identity: Identity;
  /** `null` for anonymous handshakes — no token lifecycle, no refresh. */
  claims: TokenClaims | null;
  roomId: RoomId;
  /** `null` for anonymous handshakes — there is no token to expire. */
  tokenLifecycle: TokenLifecycle | null;
  turnCredsBucket: { count: number; windowStartMs: number };
  inflightControllers: Set<AbortController>;
};

// The context lives as ONE object under `socket.data.ctx` and is always read
// and mutated by reference. Copying fields out (the previous shape) made
// refresh-handler mutations invisible to the token-lifecycle callbacks, which
// re-read the context later and saw stale claims.
type SocketWithData = Socket & { data: { ctx?: SocketContextData } };

export type SocketHandlersDeps = {
  connectionLifecycle: ConnectionLifecycle;
  commandRouter: CommandRouter;
  signalRelay: SignalRelay;
  presenceBroadcaster: PresenceBroadcaster;
  transport: ILifecycleTransport;
  roomRegistry: IRoomRegistry;
  audit: IAuditLogger;
  logger: IServerLogger;
  config: IServerConfig;
  metrics: CommunicationMetrics;
};

export function registerSocketHandlers(io: SocketIOServer, deps: SocketHandlersDeps): void {
  const failedHandshakeWindows = new Map<string, RateLimitWindow>();
  const handshakeAttemptWindows = new Map<string, AttemptWindow>();
  const handshakeBlockWindowMs =
    deps.config.security.failed_handshake_block_seconds * MS_PER_SECOND;

  // Behind HAProxy (TCP/SNI passthrough) every connection arrives from the
  // loopback — per-IP accounting here would throttle ALL users as one client
  // (one attacker's failures block everyone). In that mode the per-source
  // protection is delegated to the edge (per-src stick-table in haproxy.cfg)
  // and disabled in-process.
  const perIpAccountingEnabled = !deps.config.edge.haproxy_enabled;

  io.use(async (socket: Socket, next: (err?: Error) => void) => {
    const nowMs = Temporal.Now.instant().epochMilliseconds;

    if (perIpAccountingEnabled) {
      const remoteIp = extractRemoteIp(socket);
      const window = failedHandshakeWindows.get(remoteIp);

      if (window !== undefined && window.blockedUntilMs > nowMs) {
        deps.metrics.counters.handshakeRateLimitedTotal.inc();
        next(buildHandshakeError('auth/rate-limited'));
        return;
      }

      // Socket.IO handshakes never reach the fastify rate-limit plugin
      // (engine.io intercepts the request before routing), so the total
      // attempt rate is limited here as well — not only failed attempts.
      if (
        !consumeHandshakeAttempt(
          handshakeAttemptWindows,
          remoteIp,
          nowMs,
          deps.config.security.handshake_rate_per_ip_per_minute
        )
      ) {
        deps.metrics.counters.handshakeRateLimitedTotal.inc();
        next(buildHandshakeError('auth/rate-limited'));
        return;
      }

      pruneStaleHandshakeWindows(failedHandshakeWindows, nowMs, handshakeBlockWindowMs);
      pruneStaleAttemptWindows(handshakeAttemptWindows, nowMs);
    }

    const handshakeStart = Temporal.Now.instant().epochMilliseconds;
    // socket.handshake.auth is typed as `{ [key: string]: any }` by socket.io
    // — narrowed to `unknown` here so the application validator can run.
    const handshakeAuth = socket.handshake.auth as unknown as Parameters<
      typeof deps.connectionLifecycle.onHandshake
    >[0];
    const result = await deps.connectionLifecycle.onHandshake(handshakeAuth);
    deps.metrics.histograms.authHandshakeDurationSeconds.observe(
      (Temporal.Now.instant().epochMilliseconds - handshakeStart) / MS_PER_SECOND
    );

    if (!result.ok) {
      deps.metrics.counters.authHandshakeFailureTotal.inc({ code: result.error });
      if (perIpAccountingEnabled) {
        registerHandshakeFailure(failedHandshakeWindows, extractRemoteIp(socket), nowMs, deps);
      }
      next(buildHandshakeError(result.error));
      return;
    }

    let roomId: RoomId;
    try {
      const rawRoomId = (socket.handshake.auth as { roomId?: unknown }).roomId;
      if (typeof rawRoomId !== 'string') {
        throw new Error('roomId missing');
      }
      roomId = assertRoomId(rawRoomId);
    } catch (_caught) {
      next(buildHandshakeError('auth/missing-fields'));
      return;
    }

    const room = deps.roomRegistry.ensure(roomId, {
      maxListeners: deps.config.room.max_listeners,
      maxTabsPerUser: deps.config.room.max_tabs_per_user,
    });
    const adopted: Identity = { ...result.value.identity, socketId: socket.id };
    const addResult = room.addMember(socket.id, adopted);
    if (!addResult.ok) {
      next(buildHandshakeError(addResult.error.code));
      return;
    }

    const data: SocketContextData = {
      identity: adopted,
      claims: result.value.claims,
      roomId,
      tokenLifecycle:
        result.value.claims === null
          ? null
          : new TokenLifecycle({
              warningSeconds: deps.config.auth.token_expiry_warning_seconds,
            }),
      turnCredsBucket: { count: 0, windowStartMs: nowMs },
      inflightControllers: new Set<AbortController>(),
    };
    (socket as SocketWithData).data.ctx = data;

    await socket.join(roomId);
    next();
  });

  io.on('connection', (socket: Socket) => {
    const ctx = readContext(socket);
    if (ctx === null) {
      // Should never happen — middleware refused without populating data.
      socket.disconnect(true);
      return;
    }

    deps.metrics.gauges.activeSockets.inc();
    deps.metrics.gauges.activeRooms.set(deps.roomRegistry.count());

    const room = deps.roomRegistry.ensure(ctx.roomId, {
      maxListeners: deps.config.room.max_listeners,
      maxTabsPerUser: deps.config.room.max_tabs_per_user,
    });
    deps.presenceBroadcaster.onJoin(ctx.roomId, room);

    armTokenLifecycle(socket, deps);

    registerAckHandler<IInitiateAck>(socket, COMMAND_INITIATE, deps, async (raw, ack) => {
      const payload = parseInitiatePayload(raw);
      const controller = new AbortController();
      ctx.inflightControllers.add(controller);
      deps.metrics.gauges.pendingCorrelations.inc();

      try {
        const fanoutSize = Math.max(0, room.count() - 1);
        deps.metrics.histograms.broadcastFanoutListeners.observe(fanoutSize);

        const dispatchStart = Temporal.Now.instant().epochMilliseconds;
        const result = await deps.commandRouter.routeInitiate({
          initiatorSocketId: socket.id,
          initiatorIdentity: ctx.identity,
          room,
          roomId: ctx.roomId,
          payload,
          signal: controller.signal,
        });
        ack(result.ack);
        if (result.rejectionReason !== undefined) {
          deps.metrics.counters.dispatchRejectedTotal.inc({ reason: result.rejectionReason });
        }
        deps.metrics.histograms.dispatchDurationSeconds.observe(
          (Temporal.Now.instant().epochMilliseconds - dispatchStart) / MS_PER_SECOND
        );

        // The ack goes out before the fanout finishes (ack-before-fanout), but
        // the gauge and the abort controller must live until the fanout
        // settles: drain() waits on pendingCorrelations, and disconnect aborts
        // in-flight fanouts through the controller.
        await result.fanoutDone;
      } finally {
        ctx.inflightControllers.delete(controller);
        deps.metrics.gauges.pendingCorrelations.dec();
      }
    });

    registerAckHandler<ISignalAck>(socket, SIGNAL_PUBLISH, deps, async (raw, ack) => {
      const start = Temporal.Now.instant().epochMilliseconds;
      const result = await deps.signalRelay.relay(socket.id, ctx.identity, ctx.roomId, raw);
      deps.metrics.histograms.signalPublishHandlerDurationMs.observe(
        Temporal.Now.instant().epochMilliseconds - start
      );
      if (result.ok) {
        deps.metrics.counters.signalPublishTotal.inc({ outcome: 'ok' });
        deps.metrics.histograms.signalPublishRecipients.observe(result.recipientCount);
      } else {
        deps.metrics.counters.signalPublishTotal.inc({ outcome: result.error });
      }
      ack(result);
    });

    registerAckHandler<IRefreshTokenAck>(socket, AUTH_REFRESH_TOKEN, deps, async (raw, ack) => {
      try {
        if (ctx.claims === null || ctx.tokenLifecycle === null) {
          // Anonymous handshakes never present a token in the first
          // place — there's nothing to refresh.
          ack({ ok: false, error: 'auth/invalid-token' });
          return;
        }
        const payload = parseRefreshTokenPayload(raw);
        const result = await deps.connectionLifecycle.onRefresh(ctx.claims, payload.token);
        if (!result.ok) {
          deps.metrics.counters.tokenRefreshTotal.inc({ outcome: result.error });
          ack({ ok: false, error: result.error });
          return;
        }
        const newClaims = result.value;
        const previousName = ctx.identity.displayName;
        ctx.claims = newClaims;
        // Re-arm timers against the new exp
        ctx.tokenLifecycle.replaceClaims(newClaims, buildTokenLifecycleCallbacks(socket, deps));

        // Per M14: if the displayName claim changed, re-broadcast presence
        // with the updated identity.
        const newName = newClaims.name;
        if (
          typeof newName === 'string' &&
          newName.trim() !== '' &&
          newName.trim() !== previousName
        ) {
          try {
            const validatedDisplayName = assertDisplayName(newName.trim());
            const updated: Identity = {
              userId: ctx.identity.userId,
              displayName: validatedDisplayName,
              socketId: socket.id,
            };
            // Mutate via re-add (Room stores immutable Identity). Best-effort
            // preserving order — domain layer dedupes by userId.
            room.removeMember(socket.id);
            room.addMember(socket.id, updated);
            ctx.identity = updated;
            deps.presenceBroadcaster.onJoin(ctx.roomId, room);
          } catch (caught) {
            if (caught instanceof InvalidPayloadError) {
              // Token is valid; only the name claim fails the displayName
              // contract. Keep the existing Identity and ack success — the
              // refresh itself succeeded.
              deps.logger.warn('socket-handlers.refresh-name-invalid', {
                message: 'refresh-token name claim invalid as displayName, keeping old',
              });
            } else {
              throw caught;
            }
          }
        }
        deps.metrics.counters.tokenRefreshTotal.inc({ outcome: 'ok' });
        // v2: hint to the client that it should refresh TURN credentials and
        // (when a peer connection is live) restart ICE so the new creds take
        // effect mid-call. Cheap heuristic: token refresh implies session
        // continuation; the client may want fresh TURN creds to extend
        // WebRTC session lifetime beyond the TURN ttl.
        deps.transport.emitTurnCredentialsRenewed(socket.id);
        ack({
          ok: true,
          expiresAt: Temporal.Instant.fromEpochMilliseconds(newClaims.exp).toString(),
        });
      } catch (caught) {
        deps.logger.warn('socket-handlers.refresh-failed', {
          message: caught instanceof Error ? caught.message : String(caught),
        });
        ack({ ok: false, error: 'auth/invalid-token' });
      }
    });

    registerAckHandler<ITurnCredentialsAck | { ok: false; error: string }>(
      socket,
      TURN_REQUEST_CREDENTIALS,
      deps,
      (_raw, ack) => {
        const nowMs = Temporal.Now.instant().epochMilliseconds;
        const windowMs = SECONDS_PER_MINUTE * MS_PER_SECOND;
        if (nowMs - ctx.turnCredsBucket.windowStartMs > windowMs) {
          ctx.turnCredsBucket = { count: 0, windowStartMs: nowMs };
        }
        const limit = deps.config.turn.credential_requests_per_minute_per_socket;
        if (ctx.turnCredsBucket.count >= limit) {
          ack({ ok: false, error: 'rate-limited' });
          return;
        }
        ctx.turnCredsBucket.count += 1;

        // Anonymous sessions get a shorter relay window: relay traffic is the
        // costliest resource and an anonymous identity is free to mint, so the
        // abuse window stays narrow while optional-auth calls can still
        // traverse symmetric NATs.
        const ttlSec =
          ctx.claims === null
            ? deps.config.turn.anonymous_ttl_seconds
            : deps.config.turn.ttl_seconds;

        const creds = issueTurnCredentials({
          userIdHash: hashUserId(ctx.identity.userId),
          sharedSecret: deps.config.turn.shared_secret,
          ttlSec,
          urls: deps.config.turn.urls,
          nowMs,
        });
        deps.metrics.counters.turnCredentialsIssuedTotal.inc();
        ack(creds);
      }
    );

    socket.on('disconnect', () => {
      ctx.tokenLifecycle?.dispose();
      for (const controller of ctx.inflightControllers) {
        controller.abort();
      }
      ctx.inflightControllers.clear();

      deps.signalRelay.releaseSocket(socket.id);
      deps.roomRegistry.release(ctx.roomId, socket.id);
      const stillThere = deps.roomRegistry.getRoom(ctx.roomId);
      if (stillThere !== null) {
        deps.presenceBroadcaster.onLeave(ctx.roomId, stillThere);
      }
      deps.metrics.gauges.activeSockets.dec();
      deps.metrics.gauges.activeRooms.set(deps.roomRegistry.count());
    });
  });
}

export function readContext(socket: Socket): SocketContextData | null {
  return (socket as SocketWithData).data.ctx ?? null;
}

/**
 * Registers a socket event handler whose protocol requires an ack callback.
 *
 * Socket.IO passes through whatever the client sent — a malicious emit
 * without an ack leaves `ack` undefined, and calling it would throw inside
 * the listener. For async handlers that surfaces as an unhandled rejection,
 * which kills the whole process (trivial remote DoS). The wrapper validates
 * the callback and contains both sync and async handler failures.
 */
function registerAckHandler<TAck>(
  socket: Socket,
  event: string,
  deps: SocketHandlersDeps,
  handler: (raw: unknown, ack: (response: TAck) => void) => void | Promise<void>
): void {
  socket.on(event, (raw: unknown, ack: unknown) => {
    if (typeof ack !== 'function') {
      deps.logger.warn('socket-handlers.missing-ack', { event });
      return;
    }
    void Promise.resolve()
      .then(() => handler(raw, ack as (response: TAck) => void))
      .catch((caught: unknown) => {
        deps.logger.warn('socket-handlers.handler-failed', {
          event,
          message: caught instanceof Error ? caught.message : String(caught),
        });
      });
  });
}

function armTokenLifecycle(socket: Socket, deps: SocketHandlersDeps): void {
  const ctx = readContext(socket);
  assert(ctx !== null, 'socket context must be populated before arming token lifecycle');
  // Anonymous handshakes have no token to expire — there's nothing to arm.
  if (ctx.claims === null || ctx.tokenLifecycle === null) {
    return;
  }
  ctx.tokenLifecycle.arm(ctx.claims, buildTokenLifecycleCallbacks(socket, deps));
}

function buildTokenLifecycleCallbacks(
  socket: Socket,
  deps: SocketHandlersDeps
): { onWarning: (secs: number) => void; onExpired: () => void } {
  return {
    onWarning(secondsRemaining: number): void {
      const ctx = readContext(socket);
      if (ctx === null || ctx.claims === null) {
        // ctx.claims === null means anonymous handshake — TokenLifecycle
        // was never armed for it, so this callback should not fire. Guard
        // defensively in case of races.
        return;
      }
      deps.transport.emitTokenExpiring(socket.id, {
        expiresAt: Temporal.Instant.fromEpochMilliseconds(ctx.claims.exp).toString(),
        secondsRemaining,
      });
    },
    onExpired(): void {
      deps.transport.emitTokenExpired(socket.id);
      deps.transport.disconnect(socket.id, 'auth/expired');
    },
  };
}

/** Socket.IO connect_error carries machine-readable codes via `error.data.code` */
function buildHandshakeError(code: AuthErrorCode | string): Error {
  const error = new Error(code);
  (error as Error & { data?: { code: string } }).data = { code };
  return error;
}

/**
 * Sliding-window counter for TOTAL handshake attempts per IP. Returns false
 * when the per-minute budget is exhausted.
 */
function consumeHandshakeAttempt(
  windows: Map<string, AttemptWindow>,
  remoteIp: string,
  nowMs: number,
  limitPerMinute: number
): boolean {
  const window = windows.get(remoteIp) ?? { attempts: 0, windowStartMs: nowMs };
  if (nowMs - window.windowStartMs > ATTEMPT_WINDOW_MS) {
    window.attempts = 0;
    window.windowStartMs = nowMs;
  }
  window.attempts += 1;
  windows.set(remoteIp, window);
  return window.attempts <= limitPerMinute;
}

function pruneStaleAttemptWindows(windows: Map<string, AttemptWindow>, nowMs: number): void {
  for (const [ip, window] of windows) {
    if (nowMs - window.windowStartMs > ATTEMPT_WINDOW_MS) {
      windows.delete(ip);
    }
  }
}

function extractRemoteIp(socket: Socket): string {
  // socket.handshake.address is the raw TCP source address. NOTE: behind
  // HAProxy (TCP/SNI passthrough) this is always the loopback — per-IP
  // accounting is disabled in that mode (edge.haproxy_enabled = true) and
  // enforced by HAProxy's per-src stick-table at the edge instead.
  const fromHandshake = socket.handshake.address;
  if (typeof fromHandshake === 'string' && fromHandshake.length > 0) {
    return fromHandshake;
  }
  return 'unknown';
}

function registerHandshakeFailure(
  windows: Map<string, RateLimitWindow>,
  remoteIp: string,
  nowMs: number,
  deps: SocketHandlersDeps
): void {
  const blockWindowMs = deps.config.security.failed_handshake_block_seconds * MS_PER_SECOND;
  const window = windows.get(remoteIp) ?? {
    failures: 0,
    blockedUntilMs: 0,
    windowStartMs: nowMs,
  };
  if (nowMs - window.windowStartMs > blockWindowMs) {
    window.failures = 0;
    window.windowStartMs = nowMs;
  }
  window.failures += 1;
  if (window.failures >= deps.config.security.failed_handshake_block_threshold) {
    window.blockedUntilMs = nowMs + blockWindowMs;
  }
  windows.set(remoteIp, window);
}

function pruneStaleHandshakeWindows(
  windows: Map<string, RateLimitWindow>,
  nowMs: number,
  blockWindowMs: number
): void {
  // Keep memory bounded — drop windows whose block has fully elapsed and
  // whose rolling window is also expired.
  const expiry = blockWindowMs * HANDSHAKE_BLOCK_PRUNE_FACTOR;
  for (const [ip, window] of windows) {
    if (window.blockedUntilMs < nowMs && nowMs - window.windowStartMs > expiry) {
      windows.delete(ip);
    }
  }
}
