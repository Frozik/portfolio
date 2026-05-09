import { RoomFullError, TooManyTabsError } from './errors';
import type { Identity } from './Identity';
import type { RoomId, SocketId } from './types';

export type RoomLimits = {
  maxListeners: number;
  maxTabsPerUser: number;
};

// Local result alias — the application layer's `Result<T,E>` would be a
// circular import, so the aggregate carries its own discriminated union.
type AddMemberResult = { ok: true } | { ok: false; error: RoomFullError | TooManyTabsError };

export class Room {
  private readonly members = new Map<SocketId, Identity>();

  public constructor(
    public readonly roomId: RoomId,
    private readonly limits: RoomLimits
  ) {}

  public addMember(socketId: SocketId, identity: Identity): AddMemberResult {
    if (this.members.size >= this.limits.maxListeners) {
      return { ok: false, error: new RoomFullError() };
    }
    let tabsForUser = 0;
    for (const member of this.members.values()) {
      if (member.userId === identity.userId) {
        tabsForUser += 1;
      }
    }
    if (tabsForUser >= this.limits.maxTabsPerUser) {
      return { ok: false, error: new TooManyTabsError() };
    }
    this.members.set(socketId, identity);
    return { ok: true };
  }

  public removeMember(socketId: SocketId): void {
    this.members.delete(socketId);
  }

  public getMembers(): ReadonlyArray<Identity> {
    return Array.from(this.members.values());
  }

  public count(): number {
    return this.members.size;
  }

  public getMember(socketId: SocketId): Identity | undefined {
    return this.members.get(socketId);
  }
}
