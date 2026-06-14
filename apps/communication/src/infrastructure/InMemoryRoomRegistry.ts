import type { IRoomRegistry } from '../domain/IRoomRegistry';
import type { RoomLimits } from '../domain/Room';
import { Room } from '../domain/Room';
import type { RoomId, SocketId } from '../domain/types';

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
