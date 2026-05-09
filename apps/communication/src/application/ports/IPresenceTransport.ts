import type { IRoomPresenceEvent } from '../../domain/protocol';
import type { RoomId } from '../../domain/types';

export interface IPresenceTransport {
  emitPresence(roomId: RoomId, event: IRoomPresenceEvent): void;
}
