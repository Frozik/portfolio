import type { ITokenExpiringEvent } from '../../domain/protocol';
import type { RoomId, SocketId } from '../../domain/types';

export interface ILifecycleTransport {
  emitTokenExpiring(socketId: SocketId, payload: ITokenExpiringEvent): void;
  emitTokenExpired(socketId: SocketId): void;
  emitDraining(roomId: RoomId): void;
  // v2: hint that the client should refresh its TURN credentials and issue
  // a mid-call ICE restart. Empty payload by design.
  emitTurnCredentialsRenewed(socketId: SocketId): void;
  disconnect(socketId: SocketId, reason: string): void;
}
