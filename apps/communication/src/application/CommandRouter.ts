import { uniqBy } from 'lodash-es';
import type { Identity } from '../domain/Identity';
import type {
  IExecuteEvent,
  IInitiateAck,
  IInitiatePayload,
  IResponseEvent,
} from '../domain/protocol';
import type { Room } from '../domain/Room';
import type { CorrelationId, RoomId, SocketId } from '../domain/types';
import type { IAuditLogger } from './ports/IAuditLogger';
import type {
  BroadcastRequestOptions,
  ICommandTransport,
  TransportAckResult,
} from './ports/ICommandTransport';
import type { IServerLogger } from './ports/IServerLogger';

// Per-(socket, dispatch-instance) pending entry. The wire-level
// `correlationId` is preserved across the flow; `dispatchInstanceId` is the
// monotonic per-socket counter we use to disambiguate two `command:initiate`
// events with the SAME `correlationId` (per plan M3).
type PendingDispatch = {
  correlationId: CorrelationId;
  dispatchInstanceId: number;
};

type CommandRouterDeps = {
  commandTransport: ICommandTransport;
  logger: IServerLogger;
  auditLogger: IAuditLogger;
  maxInflightPerSocket: number;
  responseTimeoutMs: number;
};

export type RouteInitiateInput = {
  initiatorSocketId: SocketId;
  initiatorIdentity: Identity;
  room: Room;
  roomId: RoomId;
  payload: IInitiatePayload;
  signal: AbortSignal;
};

export type RouteInitiateOutput = {
  ack: IInitiateAck;
};

export class CommandRouter {
  private nextDispatchInstanceId = 1;

  // For each socket, the set of in-flight dispatches it has initiated.
  private readonly pendingPerSocket = new Map<SocketId, Set<PendingDispatch>>();

  public constructor(private readonly deps: CommandRouterDeps) {}

  public async routeInitiate(input: RouteInitiateInput): Promise<RouteInitiateOutput> {
    const { initiatorSocketId, initiatorIdentity, room, roomId, payload, signal } = input;

    const inflight = this.pendingPerSocket.get(initiatorSocketId) ?? new Set<PendingDispatch>();
    if (inflight.size >= this.deps.maxInflightPerSocket) {
      // Synchronous reject — emit `dispatch-rejected` and still return an
      // ack with the current room snapshot so the client can render UI.
      const rejection: IResponseEvent = {
        kind: 'dispatch-rejected',
        correlationId: payload.correlationId,
        reason: 'too-many-in-flight',
      };
      this.deps.commandTransport.emitResponse(initiatorSocketId, rejection);
      this.deps.auditLogger.audit('command.dispatch-rejected', {
        userIdHash: undefined,
        roomId,
        correlationId: payload.correlationId,
        command: payload.command,
      });
      return { ack: this.buildAck(room, payload.correlationId) };
    }

    const dispatch: PendingDispatch = {
      correlationId: payload.correlationId,
      dispatchInstanceId: this.nextDispatchInstanceId++,
    };
    inflight.add(dispatch);
    this.pendingPerSocket.set(initiatorSocketId, inflight);

    const ack = this.buildAck(room, payload.correlationId);

    // Snapshot members before fanout so a late-joining or late-leaving
    // member does not change the response set mid-flight.
    const memberSnapshot = new Map<SocketId, Identity>(
      room.getMembers().map(member => [member.socketId, member])
    );

    // Build the execute event sent to each responder.
    const executeEvent: IExecuteEvent = {
      command: payload.command,
      payload: payload.payload,
      correlationId: payload.correlationId,
      initiator: {
        userId: initiatorIdentity.userId,
        displayName: initiatorIdentity.displayName,
        socketId: initiatorIdentity.socketId,
      },
    };

    const broadcastOptions: BroadcastRequestOptions = {
      signal,
      timeoutMs: this.deps.responseTimeoutMs,
    };

    // Drive the fanout asynchronously — the ack returns immediately
    // (M1 ack-before-fanout).
    void this.driveFanout({
      initiatorSocketId,
      roomId,
      executeEvent,
      memberSnapshot,
      broadcastOptions,
      dispatch,
      payload,
    });

    return { ack };
  }

  private buildAck(room: Room, correlationId: CorrelationId): IInitiateAck {
    const dedupedUsers = uniqBy(room.getMembers(), member => member.userId).map(member => ({
      userId: member.userId,
      displayName: member.displayName,
    }));
    return {
      socketCount: room.count(),
      users: dedupedUsers,
      correlationId,
    };
  }

  private async driveFanout(params: {
    initiatorSocketId: SocketId;
    roomId: RoomId;
    executeEvent: IExecuteEvent;
    memberSnapshot: Map<SocketId, Identity>;
    broadcastOptions: BroadcastRequestOptions;
    dispatch: PendingDispatch;
    payload: IInitiatePayload;
  }): Promise<void> {
    const {
      initiatorSocketId,
      roomId,
      executeEvent,
      memberSnapshot,
      broadcastOptions,
      dispatch,
      payload,
    } = params;

    // (correlationId, responderSocketId) state machine — only emit ONCE per
    // pair (per plan C2).
    const settledResponders = new Set<SocketId>();
    let droppedAfterAbort = 0;

    try {
      const stream = this.deps.commandTransport.broadcastRequest(
        roomId,
        initiatorSocketId,
        executeEvent,
        broadcastOptions
      );

      for await (const result of stream) {
        if (broadcastOptions.signal.aborted) {
          droppedAfterAbort += 1;
          break;
        }

        if (settledResponders.has(result.responderSocketId)) {
          this.deps.logger.debug('command-router.duplicate-ack-dropped', {
            correlationId: payload.correlationId,
            responderSocketId: result.responderSocketId,
            kind: result.kind,
          });
          continue;
        }
        settledResponders.add(result.responderSocketId);

        // Use the snapshotted identity — if the responder disconnected
        // mid-flight the registry no longer has them (per plan C3).
        const responder = memberSnapshot.get(result.responderSocketId);
        const responseEvent = this.buildResponseEvent(result, payload.correlationId, responder);
        this.deps.commandTransport.emitResponse(initiatorSocketId, responseEvent);
      }
    } catch (caught) {
      this.deps.logger.error('command-router.fanout-failed', {
        correlationId: payload.correlationId,
        message: caught instanceof Error ? caught.message : String(caught),
      });
    } finally {
      this.releaseDispatch(initiatorSocketId, dispatch);
      if (droppedAfterAbort > 0) {
        this.deps.auditLogger.audit('command.responses-dropped-after-abort', {
          roomId,
          correlationId: payload.correlationId,
          command: payload.command,
        });
      }
    }
  }

  private buildResponseEvent(
    result: TransportAckResult,
    correlationId: CorrelationId,
    responder: Identity | undefined
  ): IResponseEvent {
    const responderSummary =
      responder === undefined
        ? undefined
        : {
            userId: responder.userId,
            displayName: responder.displayName,
            socketId: responder.socketId,
          };
    switch (result.kind) {
      case 'success':
        return {
          kind: 'success',
          correlationId,
          payload: result.payload,
          responder: responderSummary,
        };
      case 'timeout':
        return { kind: 'timeout', correlationId, responder: responderSummary };
      case 'responder-disconnected':
        return {
          kind: 'responder-disconnected',
          correlationId,
          responder: responderSummary,
        };
    }
  }

  private releaseDispatch(socketId: SocketId, dispatch: PendingDispatch): void {
    const inflight = this.pendingPerSocket.get(socketId);
    if (inflight === undefined) {
      return;
    }
    inflight.delete(dispatch);
    if (inflight.size === 0) {
      this.pendingPerSocket.delete(socketId);
    }
  }
}
