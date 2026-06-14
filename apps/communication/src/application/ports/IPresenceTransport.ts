import type { IRoomPresenceEvent } from '@frozik/communication-protocol/messages';
import type { RoomId } from '../../domain/types';

export interface IPresenceTransport {
  emitPresence(roomId: RoomId, event: IRoomPresenceEvent): void;
}
