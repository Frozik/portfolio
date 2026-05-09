import type { Room, RoomLimits } from './Room';
import type { RoomId, SocketId } from './types';

export type { RoomLimits };

export interface IRoomRegistry {
  ensure(roomId: RoomId, limits: RoomLimits): Room;
  release(roomId: RoomId, socketId: SocketId): void;
  getRoom(roomId: RoomId): Room | null;
  count(): number;
}
