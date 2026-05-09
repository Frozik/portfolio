import type { IRoomRegistry } from './IRoomRegistry';
import type { RoomLimits } from './Room';
import { Room } from './Room';
import type { RoomId, SocketId } from './types';

export class InMemoryRoomRegistry implements IRoomRegistry {
  private readonly rooms = new Map<RoomId, Room>();

  public ensure(roomId: RoomId, limits: RoomLimits): Room {
    const existing = this.rooms.get(roomId);
    if (existing !== undefined) {
      return existing;
    }
    const created = new Room(roomId, limits);
    this.rooms.set(roomId, created);
    return created;
  }

  public release(roomId: RoomId, socketId: SocketId): void {
    const room = this.rooms.get(roomId);
    if (room === undefined) {
      return;
    }
    room.removeMember(socketId);
    if (room.count() === 0) {
      this.rooms.delete(roomId);
    }
  }

  public getRoom(roomId: RoomId): Room | null {
    return this.rooms.get(roomId) ?? null;
  }

  public count(): number {
    return this.rooms.size;
  }
}
