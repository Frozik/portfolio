import type { IExecuteEvent, IResponseEvent } from '../../domain/protocol';
import type { RoomId, SocketId } from '../../domain/types';

export type TransportAckResult =
  | { kind: 'success'; responderSocketId: SocketId; payload: unknown }
  | { kind: 'timeout'; responderSocketId: SocketId }
  | { kind: 'responder-disconnected'; responderSocketId: SocketId };

export interface BroadcastRequestOptions {
  signal: AbortSignal;
  timeoutMs: number;
}

export interface ICommandTransport {
  broadcastRequest(
    roomId: RoomId,
    initiatorSocketId: SocketId,
    request: IExecuteEvent,
    options: BroadcastRequestOptions
  ): AsyncIterable<TransportAckResult>;

  emitResponse(initiatorSocketId: SocketId, response: IResponseEvent): void;
}
