import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { multiPolygonArea } from '../domain/geometry/building-outline';
import {
  interiorPointOf,
  isPointInMultiPolygon,
  subtractPolygons,
} from '../domain/geometry/polygon-booleans';
import { computeMultiPolygonCentroid } from '../domain/geometry/polygon-centroid';
import type { MultiPolygon } from '../domain/geometry/polygon-types';
import { buildWallHull } from '../domain/geometry/wall-geometry';
import type { RoomLabelId, RoomTypeId } from '../domain/model/rooms';
import { isWetRoomType } from '../domain/model/rooms';
import type { RoofCover, RoofZoneLabelId, Storey, StoreyId } from '../domain/model/storeys';
import { DEFAULT_ROOF_COVER } from '../domain/model/storeys';

/** One derived room: a region the walls enclose, with its assigned type. */
export interface BuildingRoom {
  readonly storeyId: StoreyId;
  readonly polygons: MultiPolygon;
  readonly areaSquareMeters: number;
  readonly centroid: Vector2 | undefined;
  readonly roomTypeId: RoomTypeId | undefined;
  readonly labelId: RoomLabelId | undefined;
  readonly isWet: boolean;
}

/** One region of a storey's exposed ceiling, with the cover pinned to it. */
export interface RoofZoneScene {
  readonly storeyId: StoreyId;
  readonly polygons: MultiPolygon;
  readonly cover: RoofCover;
  readonly areaSquareMeters: number;
  readonly centroid: Vector2 | undefined;
  readonly labelId: RoofZoneLabelId | undefined;
}

const NO_ROOMS: readonly BuildingRoom[] = [];

/**
 * The rooms the walls cut the footprint into: footprint minus wall bodies,
 * each remaining region one room, its type looked up by which region holds a
 * stored label's seed point.
 */
export function deriveRooms(
  storey: Storey,
  footprint: MultiPolygon,
  wallBodies: MultiPolygon
): readonly BuildingRoom[] {
  if (wallBodies.length === 0 || footprint.length === 0) {
    return NO_ROOMS;
  }

  const cut = subtractPolygons(footprint, wallBodies);
  // A room is what the walls ENCLOSE. A footprint slightly wider than the
  // wall ring leaves a hairline frame between the walls and the slab's edge —
  // real leftover concrete, but no room — so regions outside the wall hull
  // are dropped, UNLESS a stored label claims one: a veranda is exactly a
  // deliberate floor outside the walls, and planting its label is how the
  // planner says this leftover is a place, not concrete. Until any enclosure
  // exists (partitions running edge to edge, the pre-ring way of drawing),
  // the footprint boundary stands in for the exterior walls and every cut
  // region counts.
  const hull = buildWallHull(wallBodies);
  const enclosed = new Set(
    cut.filter(region => {
      const probe = interiorPointOf([region]);

      return !isNil(probe) && isPointInMultiPolygon(hull, probe);
    })
  );
  const regions =
    enclosed.size > 0
      ? cut.filter(
          region =>
            enclosed.has(region) ||
            storey.roomLabels.some(candidate => isPointInMultiPolygon([region], candidate.position))
        )
      : cut;

  return regions.map(region => {
    const polygons = [region];
    const label = storey.roomLabels.find(candidate =>
      isPointInMultiPolygon(polygons, candidate.position)
    );

    return {
      storeyId: storey.id,
      polygons,
      areaSquareMeters: multiPolygonArea(polygons),
      centroid: computeMultiPolygonCentroid(polygons),
      roomTypeId: label?.roomTypeId,
      labelId: label?.id,
      isWet: isNil(label) ? false : isWetRoomType(label.roomTypeId),
    };
  });
}

/** The roof-zone counterpart of {@link deriveRooms}, over the exposed ceiling. */
export function deriveRoofZones(storey: Storey, exposed: MultiPolygon): readonly RoofZoneScene[] {
  return exposed.map(region => {
    const polygons = [region];
    const label = storey.roofZoneLabels.find(candidate =>
      isPointInMultiPolygon(polygons, candidate.position)
    );

    return {
      storeyId: storey.id,
      polygons,
      cover: label?.cover ?? DEFAULT_ROOF_COVER,
      areaSquareMeters: multiPolygonArea(polygons),
      centroid: computeMultiPolygonCentroid(polygons),
      labelId: label?.id,
    };
  });
}
