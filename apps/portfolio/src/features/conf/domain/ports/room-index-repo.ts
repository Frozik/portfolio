import type { ISO } from '@frozik/utils/date/types';

import type { IConfRoomIndexEntry, ParticipantId, RoomId } from '../types';

/** The lobby's memory of created and visited rooms. */
export interface IConfRoomIndexRepo {
  list(): Promise<readonly IConfRoomIndexEntry[]>;
  add(roomId: RoomId, createdAt: ISO, ownerParticipantId: ParticipantId): Promise<void>;
  /** Bumps `lastVisitedAt`, inserting an ownerless row for a room first joined by link. */
  touchVisited(roomId: RoomId): Promise<void>;
  remove(roomId: RoomId): Promise<void>;
}
