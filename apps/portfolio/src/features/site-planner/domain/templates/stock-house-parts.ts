import type { Vector2 } from '@frozik/utils/math/vector2';

import type { UtilitySystem } from '../model/foundation';
import { createUtilityEntry, DEFAULT_FROST_DEPTH_METERS } from '../model/foundation';
import type { FurnitureCatalogId } from '../model/furniture';
import { createFurniture } from '../model/furniture';
import type { OpeningPreset } from '../model/openings';
import { createOpening } from '../model/openings';
import type { RoomTypeId } from '../model/rooms';
import { createRoomLabel } from '../model/rooms';
import type { Wall } from '../model/walls';
import { createWall } from '../model/walls';

/** The shorthand the stock houses are written in: rings, pieces, labels, openings and entries by coordinates. */
const ENTRY_SPACING = 3;

export function ring(points: readonly Vector2[]): Wall {
  return { ...createWall({ points }), isClosed: true };
}

export function furnitureAt(catalogId: FurnitureCatalogId, x: number, y: number, turn = 0) {
  return { ...createFurniture({ catalogId, position: { x, y } }), rotationDegrees: turn };
}

export function labelAt(roomTypeId: RoomTypeId, x: number, y: number) {
  return createRoomLabel({ position: { x, y }, roomTypeId });
}

export function opening(wall: Wall, preset: OpeningPreset, offsetMeters: number) {
  return createOpening({ wallId: wall.id, preset, offsetMeters });
}

export function entries(systems: readonly UtilitySystem[]) {
  return systems.map((system, index) =>
    createUtilityEntry({
      system,
      outlineOffsetMeters: index * ENTRY_SPACING,
      frostDepthMeters: DEFAULT_FROST_DEPTH_METERS,
    })
  );
}
