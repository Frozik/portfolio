import { assert } from '@frozik/utils/assert/assert';
import type { Socket, Server as SocketIOServer } from 'socket.io';
import { Temporal } from 'temporal-polyfill';
import type { CommandRouter } from '../application/CommandRouter';
import type { ConnectionLifecycle } from '../application/ConnectionLifecycle';
import type { IServerConfig } from '../application/config/server-config-schema';
import { hashUserId } from '../application/hashUserId';
import { issueTurnCredentials } from '../application/IssueTurnCredentialsUseCase';
import type { PresenceBroadcaster } from '../application/PresenceBroadcaster';
import type { IAuditLogger } from '../application/ports/IAuditLogger';
import type { ILifecycleTransport } from '../application/ports/ILifecycleTransport';
import type { IServerLogger } from '../application/ports/IServerLogger';
import type { SignalRelay } from '../application/SignalRelay';
import { TokenLifecycle } from '../application/TokenLifecycle';
import { InvalidPayloadError } from '../domain/errors';
import type { AuthErrorCode, Identity, TokenClaims } from '../domain/Identity';
import type { IRoomRegistry } from '../domain/IRoomRegistry';
import type {
  IInitiateAck,
  IRefreshTokenAck,
  ISignalAck,
  ITurnCredentialsAck,
} from '../domain/protocol';
import {
  AUTH_REFRESH_TOKEN,
  COMMAND_INITIATE,
  SIGNAL_PUBLISH,
  TURN_REQUEST_CREDENTIALS,
} from '../domain/protocol';
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

type SocketContextData = {
  identity: Identity;
  /** `null` for anonymous handshakes — no token lifecycle, no refresh. */
  claims: TokenClaims | null;
  roomId: RoomId;
  /** `null` for anonymous handshakes — there is no token to expire. */
  tokenLifecycle: TokenLifecycle | null;
  signalRateBucket: { tokens: number; lastRefillMs: number };
  turnCredsBucket: { count: number; windowStartMs: number };
  inflightControllers: Set<AbortController>;
};

type SocketWithData = Socket & { data: Partial<SocketContextData> & Record<string, unknown> };

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
  const handshakeBlockWindowMs =
    deps.config.security.failed_handshake_block_seconds * MS_PER_SECOND;

  io.use(async (socket: Socket, next: (err?: Error) => void) => {
    const remoteIp = extractRemoteIp(socket);
    const nowMs = Temporal.Now.instant().epochMilliseconds;
    const window = failedHandshakeWindows.get(remoteIp);

    if (window !== undefined && window.blockedUntilMs > nowMs) {
      deps.metrics.counters.handshakeRateLimitedTotal.inc();
      const error = new Error('auth/rate-limited');
      (error as Error & { data?: { code: AuthErrorCode } }).data = { code: 'auth/rate-limited' };
      next(error);
      return;
    }

    pruneStaleHandshakeWindows(failedHandshakeWindows, nowMs, handshakeBlockWindowMs);

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
      registerHandshakeFailure(failedHandshakeWindows, remoteIp, nowMs, deps);
      const error = new Error(result.error);
      (error as Error & { data?: { code: AuthErrorCode } }).data = { code: result.error };
      next(error);
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
      const error = new Error('auth/missing-fields');
      (error as Error & { data?: { code: AuthErrorCode } }).data = { code: 'auth/missing-fields' };
      next(error);
      return;
    }

    const room = deps.roomRegistry.ensure(roomId, {
      maxListeners: deps.config.room.max_listeners,
      maxTabsPerUser: deps.config.room.max_tabs_per_user,
    });
    const adopted: Identity = { ...result.value.identity, socketId: socket.id };
    const addResult = room.addMember(socket.id, adopted);
    if (!addResult.ok) {
      const code = addResult.error.code;
      const error = new Error(code);
      (error as Error & { data?: { code: string } }).data = { code };
      next(error);
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
      signalRateBucket: {
        tokens: deps.config.signal.max_publish_burst,
        lastRefillMs: nowMs,
      },
      turnCredsBucket: { count: 0, windowStartMs: nowMs },
      inflightControllers: new Set<AbortController>(),
    };
    Object.assign(socket.data, data);

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

    socket.on(COMMAND_INITIATE, async (raw, ack: (response: IInitiateAck) => void) => {
      try {
        const payload = parseInitiatePayload(raw);
        const controller = new AbortController();
        ctx.inflightControllers.add(controller);
        deps.metrics.gauges.pendingCorrelations.inc();

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

        // Continue tracking — fanout completes asynchronously inside CommandRouter
        // but we can already release our own bookkeeping once the ack is out.
        ctx.inflightControllers.delete(controller);
        deps.metrics.gauges.pendingCorrelations.dec();
        deps.metrics.histograms.dispatchDurationSeconds.observe(
          (Temporal.Now.instant().epochMilliseconds - dispatchStart) / MS_PER_SECOND
        );
      } catch (caught) {
        deps.logger.warn('socket-handlers.initiate-failed', {
          message: caught instanceof Error ? caught.message : String(caught),
        });
      }
    });

    socket.on(SIGNAL_PUBLISH, async (raw, ack: (response: ISignalAck) => void) => {
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

    socket.on(AUTH_REFRESH_TOKEN, async (raw, ack: (response: IRefreshTokenAck) => void) => {
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

    socket.on(
      TURN_REQUEST_CREDENTIALS,
      (_raw, ack: (response: ITurnCredentialsAck | { ok: false; error: string }) => void) => {
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

        const creds = issueTurnCredentials({
          userIdHash: hashUserId(ctx.identity.userId),
          sharedSecret: deps.config.turn.shared_secret,
          ttlSec: deps.config.turn.ttl_seconds,
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

function readContext(socket: Socket): SocketContextData | null {
  const partial = (socket as SocketWithData).data;
  if (
    partial.identity === undefined ||
    partial.claims === undefined ||
    partial.roomId === undefined ||
    partial.tokenLifecycle === undefined ||
    partial.signalRateBucket === undefined ||
    partial.turnCredsBucket === undefined ||
    partial.inflightControllers === undefined
  ) {
    return null;
  }
  return {
    identity: partial.identity,
    claims: partial.claims,
    roomId: partial.roomId,
    tokenLifecycle: partial.tokenLifecycle,
    signalRateBucket: partial.signalRateBucket,
    turnCredsBucket: partial.turnCredsBucket,
    inflightControllers: partial.inflightControllers,
  };
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

function extractRemoteIp(socket: Socket): string {
  // socket.handshake.address is populated by the engine using the TCP source
  // address; the proxy-protocol wrapper rewrites this to the original client
  // IP when haproxy_enabled is true.
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

export type { SocketWithData };
