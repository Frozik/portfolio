import { uniqBy } from 'lodash-es';
import type { IRoomPresenceEvent } from '../domain/protocol';
import type { Room } from '../domain/Room';
import type { RoomId } from '../domain/types';
import type { IPresenceTransport } from './ports/IPresenceTransport';

type PresenceBroadcasterDeps = {
  presenceTransport: IPresenceTransport;
};

export class PresenceBroadcaster {
  public constructor(private readonly deps: PresenceBroadcasterDeps) {}

  public onJoin(roomId: RoomId, room: Room): void {
    this.broadcast(roomId, room);
  }

  public onLeave(roomId: RoomId, room: Room): void {
    this.broadcast(roomId, room);
  }

  private broadcast(roomId: RoomId, room: Room): void {
    // `getMembers` returns insertion order. `uniqBy` keeps the FIRST
    // occurrence of each `userId`, so reverse before dedup to keep the
    // most recent join (last-write-wins for displayName changes).
    const members = room.getMembers();
    const reversed = [...members].reverse();
    const dedupedReversed = uniqBy(reversed, member => member.userId);
    const deduped = dedupedReversed.reverse();
    const event: IRoomPresenceEvent = {
      socketCount: room.count(),
      users: deduped.map(member => ({
        userId: member.userId,
        displayName: member.displayName,
      })),
    };
    this.deps.presenceTransport.emitPresence(roomId, event);
  }
}
