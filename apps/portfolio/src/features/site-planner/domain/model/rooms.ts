import type { Vector2 } from '@frozik/utils/math/vector2';
import type { Opaque } from '@frozik/utils/types/base';

/**
 * What a room is for. A catalog row, not
 * behaviour: the type makes the plan legible, and `isWet` carries the
 * wet-floor concept that later feeds GFCI-розетки and floor-drain rules.
 */
export type RoomTypeId =
  | 'living'
  | 'bedroom'
  | 'kitchen'
  | 'bathroom'
  | 'boiler'
  | 'sauna'
  | 'garage'
  | 'hall'
  | 'dining'
  | 'wardrobe'
  | 'laundry'
  | 'office'
  | 'pantry'
  | 'veranda';

export interface RoomType {
  readonly id: RoomTypeId;
  readonly isWet: boolean;
}

/** Every room type, in the order the panel offers them. */
export const ROOM_TYPES: readonly RoomType[] = [
  { id: 'living', isWet: false },
  { id: 'bedroom', isWet: false },
  { id: 'kitchen', isWet: true },
  { id: 'bathroom', isWet: true },
  { id: 'boiler', isWet: true },
  { id: 'sauna', isWet: true },
  { id: 'garage', isWet: false },
  { id: 'hall', isWet: false },
  { id: 'dining', isWet: false },
  { id: 'wardrobe', isWet: false },
  { id: 'laundry', isWet: true },
  { id: 'office', isWet: false },
  { id: 'pantry', isWet: false },
  { id: 'veranda', isWet: false },
];

export function isWetRoomType(roomTypeId: RoomTypeId): boolean {
  return ROOM_TYPES.find(type => type.id === roomTypeId)?.isWet ?? false;
}

export type RoomLabelId = Opaque<'RoomLabelId', string>;

/**
 * The stored half of a room: rooms themselves derive from the wall loops and
 * are never persisted, so a type is pinned to a SEED POINT — whichever derived
 * region contains the point wears the type.
 */
export interface RoomLabel {
  readonly id: RoomLabelId;
  readonly position: Vector2;
  readonly roomTypeId: RoomTypeId;
}

export function createRoomLabel({
  position,
  roomTypeId,
}: {
  readonly position: Vector2;
  readonly roomTypeId: RoomTypeId;
}): RoomLabel {
  return { id: crypto.randomUUID() as RoomLabelId, position, roomTypeId };
}
