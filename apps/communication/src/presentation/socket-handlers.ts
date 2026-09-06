import { COMMAND_INITIATE, SIGNAL_PUBLISH } from '@frozik/communication-protocol/events';
import type {
  IInitiateAck,
  SignalAck as ISignalAck,
} from '@frozik/communication-protocol/messages';
import { MS_PER_SECOND } from '@frozik/utils/date/constants';
import type { Socket, Server as SocketIOServer } from 'socket.io';
import { Temporal } from 'temporal-polyfill';
import type { CommandRouter } from '../application/CommandRouter';
import type { IServerConfig } from '../application/config/server-config-schema';
import type { ConnectionLifecycle } from '../application/ConnectionLifecycle';
import type { IAuditLogger } from '../application/ports/IAuditLogger';
import type { ILifecycleTransport } from '../application/ports/ILifecycleTransport';
import type { IServerLogger } from '../application/ports/IServerLogger';
import type { PresenceBroadcaster } from '../application/PresenceBroadcaster';
import type { SignalRelay } from '../application/SignalRelay';
import { TokenLifecycle } from '../application/TokenLifecycle';
import type { AuthErrorCode, Identity } from '../domain/Identity';
import type { IRoomRegistry } from '../domain/IRoomRegistry';
import { parseInitiatePayload } from '../domain/protocol-validators';
import type { Room } from '../domain/Room';
import type { RoomId } from '../domain/types';
import { assertRoomId } from '../domain/types';
import { registerAckHandler } from './ack-handler';
import { extractRemoteIp, HandshakeRateLimiter } from './handshake-rate-limit';
import type { CommunicationMetrics } from './metrics';
import type { SocketContextData } from './socket-context';
import { readContext, writeContext } from './socket-context';
import { armTokenLifecycle, registerTokenRefreshHandler } from './token-refresh-handler';
import { registerTurnCredentialsHandler } from './turn-credentials-handler';

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

/** Socket.IO connect_error carries machine-readable codes via `error.data.code` */
function buildHandshakeError(code: AuthErrorCode | string): Error {
  const error = new Error(code);
  (error as Error & { data?: { code: string } }).data = { code };
  return error;
}

function ensureRoom(deps: SocketHandlersDeps, roomId: RoomId): Room {
  return deps.roomRegistry.ensure(roomId, {
    maxListeners: deps.config.room.max_listeners,
    maxTabsPerUser: deps.config.room.max_tabs_per_user,
  });
}

/** The room the handshake names, or nothing when the field is missing or malformed. */
function readRoomId(socket: Socket): RoomId | null {
  const rawRoomId = (socket.handshake.auth as { roomId?: unknown }).roomId;
  if (typeof rawRoomId !== 'string') {
    return null;
  }
  try {
    return assertRoomId(rawRoomId);
  } catch {
    return null;
  }
}

/**
 * The handshake middleware: per-IP rate accounting, identity verification,
 * room admission and the socket context. Behind HAProxy (TCP/SNI passthrough)
 * every connection arrives from the loopback, so per-IP accounting would
 * throttle all users as one client — in that mode the per-source protection
 * is delegated to the edge and disabled in-process.
 */
function registerHandshake(io: SocketIOServer, deps: SocketHandlersDeps): void {
  const rateLimiter = deps.config.edge.haproxy_enabled
    ? null
    : new HandshakeRateLimiter(deps.config.security);

  io.use(async (socket: Socket, next: (err?: Error) => void) => {
    const nowMs = Temporal.Now.instant().epochMilliseconds;
    const remoteIp = extractRemoteIp(socket);

    if (rateLimiter?.admit(remoteIp, nowMs) === 'rate-limited') {
      deps.metrics.counters.handshakeRateLimitedTotal.inc();
      next(buildHandshakeError('auth/rate-limited'));
      return;
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
      rateLimiter?.registerFailure(remoteIp, nowMs);
      next(buildHandshakeError(result.error));
      return;
    }

    const roomId = readRoomId(socket);
    if (roomId === null) {
      next(buildHandshakeError('auth/missing-fields'));
      return;
    }

    const room = ensureRoom(deps, roomId);
    const adopted: Identity = { ...result.value.identity, socketId: socket.id };
    const addResult = room.addMember(socket.id, adopted);
    if (!addResult.ok) {
      next(buildHandshakeError(addResult.error.code));
      return;
    }

    const context: SocketContextData = {
      identity: adopted,
      claims: result.value.claims,
      roomId,
      tokenLifecycle:
        result.value.claims === null
          ? null
          : new TokenLifecycle({ warningSeconds: deps.config.auth.token_expiry_warning_seconds }),
      turnCredsBucket: { count: 0, windowStartMs: nowMs },
      inflightControllers: new Set<AbortController>(),
    };
    writeContext(socket, context);

    await socket.join(roomId);
    next();
  });
}

/** `COMMAND_INITIATE`: one dispatch, acked before its fanout finishes. */
function registerInitiateHandler(
  socket: Socket,
  ctx: SocketContextData,
  room: Room,
  deps: SocketHandlersDeps
): void {
  registerAckHandler<IInitiateAck>(socket, COMMAND_INITIATE, deps.logger, async (raw, ack) => {
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

      // The ack goes out before the fanout finishes, but the gauge and the
      // abort controller must live until the fanout settles: drain() waits on
      // pendingCorrelations, and disconnect aborts in-flight fanouts.
      await result.fanoutDone;
    } finally {
      ctx.inflightControllers.delete(controller);
      deps.metrics.gauges.pendingCorrelations.dec();
    }
  });
}

/** `SIGNAL_PUBLISH`: the WebRTC signalling relay, measured per outcome. */
function registerSignalHandler(
  socket: Socket,
  ctx: SocketContextData,
  deps: SocketHandlersDeps
): void {
  registerAckHandler<ISignalAck>(socket, SIGNAL_PUBLISH, deps.logger, async (raw, ack) => {
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
}

function registerDisconnect(
  socket: Socket,
  ctx: SocketContextData,
  deps: SocketHandlersDeps
): void {
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
}

export function registerSocketHandlers(io: SocketIOServer, deps: SocketHandlersDeps): void {
  registerHandshake(io, deps);

  io.on('connection', (socket: Socket) => {
    const ctx = readContext(socket);
    if (ctx === null) {
      // Should never happen — middleware refused without populating data.
      socket.disconnect(true);
      return;
    }

    deps.metrics.gauges.activeSockets.inc();
    deps.metrics.gauges.activeRooms.set(deps.roomRegistry.count());

    const room = ensureRoom(deps, ctx.roomId);
    deps.presenceBroadcaster.onJoin(ctx.roomId, room);
    armTokenLifecycle(socket, deps.transport);

    registerInitiateHandler(socket, ctx, room, deps);
    registerSignalHandler(socket, ctx, deps);
    registerTokenRefreshHandler(socket, room, deps);
    registerTurnCredentialsHandler(socket, ctx, deps.config.turn, deps.logger, deps.metrics);
    registerDisconnect(socket, ctx, deps);
  });
}
