import {
  AUTH_TOKEN_EXPIRED,
  AUTH_TOKEN_EXPIRING,
  COMMAND_EXECUTE,
  COMMAND_RESPONSE,
  ROOM_PRESENCE,
  SERVER_DRAINING,
  SIGNAL_EVENT,
  TURN_CREDENTIALS_RENEWED,
} from '@frozik/communication-protocol/events';
import type {
  IExecuteAck,
  IExecuteEvent,
  IResponseEvent,
  IRoomPresenceEvent,
  ISignalEventOutbound,
  ITokenExpiringEvent,
} from '@frozik/communication-protocol/messages';
import type { Server as SocketIOServer } from 'socket.io';
import type {
  BroadcastRequestOptions,
  ICommandTransport,
  TransportAckResult,
} from '../application/ports/ICommandTransport';
import type { ILifecycleTransport } from '../application/ports/ILifecycleTransport';
import type { IPresenceTransport } from '../application/ports/IPresenceTransport';
import type { ISignalTransport } from '../application/ports/ISignalTransport';
import type { RoomId, SocketId } from '../domain/types';

// Single class implements all four transport ports — they share the
// underlying `SocketIOServer` reference and have no overlapping concerns
// that would justify the indirection of separate adapters.
export class SocketIORoomTransport
  implements ICommandTransport, IPresenceTransport, ISignalTransport, ILifecycleTransport
{
  constructor(private readonly io: SocketIOServer) {}

  // ICommandTransport ---------------------------------------------------------

  // Yields one TransportAckResult per responder as their ack/timeout/disconnect
  // settles. Uses a queue + notify pattern instead of Promise.race so we don't
  // need promise-identity tracking.
  async *broadcastRequest(
    roomId: RoomId,
    initiatorSocketId: SocketId,
    request: IExecuteEvent,
    options: BroadcastRequestOptions
  ): AsyncIterable<TransportAckResult> {
    const allSockets = await this.io.in(roomId).fetchSockets();
    const responders = allSockets.filter(socket => socket.id !== initiatorSocketId);
    if (responders.length === 0) {
      return;
    }

    const queue: TransportAckResult[] = [];
    let pending = responders.length;
    let resolveNext: (() => void) | null = null;

    const notify = (): void => {
      if (resolveNext !== null) {
        const resolver = resolveNext;
        resolveNext = null;
        resolver();
      }
    };

    for (const remoteSocket of responders) {
      let settled = false;
      // Long-lived sockets answer many dispatches — the disconnect/abort
      // listeners must not outlive this dispatch, or they accumulate on the
      // socket until MaxListenersExceededWarning (and leak until disconnect).
      let removeListeners: VoidFunction = () => {};
      const settle = (result: TransportAckResult): void => {
        if (settled) {
          return;
        }
        settled = true;
        removeListeners();
        queue.push(result);
        pending -= 1;
        notify();
      };

      // Disconnect path. RemoteSocket doesn't expose `.once()` (it's a thin
      // proxy for the cluster-aware adapter), so reach into the local
      // namespace's socket map for the underlying Socket instance. If the
      // socket already disconnected between fetchSockets() and now, settle
      // immediately.
      const localSocket = this.io.sockets.sockets.get(remoteSocket.id);
      if (localSocket === undefined) {
        settle({ kind: 'responder-disconnected', responderSocketId: remoteSocket.id });
        continue;
      }
      const onDisconnect = (): void => {
        settle({ kind: 'responder-disconnected', responderSocketId: remoteSocket.id });
      };

      // Caller-driven abort path
      const abortHandler = (): void => {
        settle({ kind: 'responder-disconnected', responderSocketId: remoteSocket.id });
      };

      removeListeners = (): void => {
        localSocket.off('disconnect', onDisconnect);
        options.signal.removeEventListener('abort', abortHandler);
      };

      localSocket.once('disconnect', onDisconnect);
      if (options.signal.aborted) {
        abortHandler();
      } else {
        options.signal.addEventListener('abort', abortHandler, { once: true });
      }

      // Ack / timeout path
      void (async () => {
        try {
          const ack = (await remoteSocket
            .timeout(options.timeoutMs)
            .emitWithAck(COMMAND_EXECUTE, request)) as IExecuteAck;
          settle({ kind: 'success', responderSocketId: remoteSocket.id, payload: ack.payload });
        } catch {
          settle({ kind: 'timeout', responderSocketId: remoteSocket.id });
        }
      })();
    }

    while (pending > 0 || queue.length > 0) {
      if (queue.length === 0) {
        if (options.signal.aborted) {
          return;
        }
        await new Promise<void>(resolve => {
          resolveNext = resolve;
        });
        continue;
      }
      const next = queue.shift();
      if (next !== undefined) {
        yield next;
      }
      if (options.signal.aborted) {
        return;
      }
    }
  }

  emitResponse(initiatorSocketId: SocketId, response: IResponseEvent): void {
    const socket = this.io.sockets.sockets.get(initiatorSocketId);
    if (socket === undefined) {
      return;
    }
    socket.emit(COMMAND_RESPONSE, response);
  }

  // IPresenceTransport --------------------------------------------------------

  emitPresence(roomId: RoomId, event: IRoomPresenceEvent): void {
    this.io.to(roomId).emit(ROOM_PRESENCE, event);
  }

  // ISignalTransport ----------------------------------------------------------

  async broadcastSignalEvent(
    roomId: RoomId,
    fromSocketId: SocketId,
    event: ISignalEventOutbound
  ): Promise<{ recipientCount: number }> {
    const allSockets = await this.io.in(roomId).fetchSockets();
    const recipients = allSockets.filter(socket => socket.id !== fromSocketId);
    for (const recipient of recipients) {
      recipient.emit(SIGNAL_EVENT, event);
    }
    return { recipientCount: recipients.length };
  }

  // ILifecycleTransport -------------------------------------------------------

  emitTokenExpiring(socketId: SocketId, payload: ITokenExpiringEvent): void {
    this.io.sockets.sockets.get(socketId)?.emit(AUTH_TOKEN_EXPIRING, payload);
  }

  emitTokenExpired(socketId: SocketId): void {
    this.io.sockets.sockets.get(socketId)?.emit(AUTH_TOKEN_EXPIRED, {});
  }

  emitDraining(roomId: RoomId): void {
    this.io.to(roomId).emit(SERVER_DRAINING, {});
  }

  emitTurnCredentialsRenewed(socketId: SocketId): void {
    this.io.sockets.sockets.get(socketId)?.emit(TURN_CREDENTIALS_RENEWED, {});
  }

  disconnect(socketId: SocketId, reason: string): void {
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket === undefined) {
      return;
    }
    // Emit a structured close payload for observability before tearing down.
    socket.emit('server:disconnect', { reason });
    socket.disconnect(true);
  }
}
