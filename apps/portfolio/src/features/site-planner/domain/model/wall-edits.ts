import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { polylineLength, wallCenterline } from '../geometry/wall-geometry';
import type { Meters } from '../units';
import type { Opening, OpeningId } from './openings';
import type { Building, BuildingId } from './site-plan';
import { storeysOf } from './site-plan';
import { mapStoreys } from './storey-edits';
import type { Storey, StoreyId } from './storeys';
import { devicesOf } from './storeys';
import type { Wall, WallId } from './walls';
import { createWall, isWallClosed, MIN_CLOSED_WALL_POINTS, MIN_WALL_POINTS } from './walls';

export function addWall(
  buildings: readonly Building[],
  buildingId: BuildingId,
  storeyId: StoreyId,
  wall: Wall
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey =>
    storey.id === storeyId ? { ...storey, walls: [...storey.walls, wall] } : storey
  );
}

export function updateWall(
  buildings: readonly Building[],
  buildingId: BuildingId,
  wallId: WallId,
  changes: Partial<Omit<Wall, 'id'>>
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    walls: storey.walls.map(wall => (wall.id === wallId ? { ...wall, ...changes } : wall)),
  }));
}

export function removeWall(
  buildings: readonly Building[],
  buildingId: BuildingId,
  wallId: WallId
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    walls: storey.walls.filter(wall => wall.id !== wallId),
    // A wall takes its hosted openings with it: an opening cannot outlive
    // the wall it pierces.
    openings: storey.openings.filter(opening => opening.wallId !== wallId),
  }));
}

export function moveWallPoint(
  buildings: readonly Building[],
  buildingId: BuildingId,
  wallId: WallId,
  pointIndex: number,
  point: Vector2
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    walls: storey.walls.map(wall =>
      wall.id === wallId
        ? {
            ...wall,
            points: wall.points.map((existing, index) => (index === pointIndex ? point : existing)),
          }
        : wall
    ),
  }));
}

/**
 * Splits the segment after `segmentIndex` by planting a new drawn point inside
 * it. On a ring, `segmentIndex` equal to the last point's index names the
 * closing segment — the new point simply appends, which IS that segment split.
 */
export function insertWallPoint(
  buildings: readonly Building[],
  buildingId: BuildingId,
  wallId: WallId,
  segmentIndex: number,
  point: Vector2
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    walls: storey.walls.map(wall =>
      wall.id === wallId
        ? {
            ...wall,
            points: [
              ...wall.points.slice(0, segmentIndex + 1),
              point,
              ...wall.points.slice(segmentIndex + 1),
            ],
          }
        : wall
    ),
  }));
}

/**
 * Refuses silently at the floor: an open run keeps a segment's worth of
 * points, a ring keeps a triangle's worth — below either the wall would stop
 * being a wall, and Delete must never do that by accident.
 */
export function removeWallPoint(
  buildings: readonly Building[],
  buildingId: BuildingId,
  wallId: WallId,
  pointIndex: number
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    walls: storey.walls.map(wall => {
      if (wall.id !== wallId) {
        return wall;
      }

      const floor = isWallClosed(wall) ? MIN_CLOSED_WALL_POINTS : MIN_WALL_POINTS;

      return wall.points.length <= floor
        ? wall
        : { ...wall, points: wall.points.filter((_, index) => index !== pointIndex) };
    }),
  }));
}

/** Endpoints landed on each other read as one point — the ring-closing gesture. */
const RING_SEAM_EPSILON_METERS = 1e-6;

/**
 * Closes the wall into a ring: the last point connects back to the first.
 * Ends that were dragged onto each other collapse into the one seam point;
 * anything below a triangle's worth of corners refuses — two points close
 * into nothing. Openings keep their offsets: the centreline's start does not
 * move, closing only grows its far end.
 */
export function closeWallRing(
  buildings: readonly Building[],
  buildingId: BuildingId,
  wallId: WallId
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    walls: storey.walls.map(wall => {
      if (wall.id !== wallId || isWallClosed(wall)) {
        return wall;
      }

      const [first] = wall.points;
      const last = wall.points[wall.points.length - 1];
      const endsMeet =
        wall.points.length > 1 &&
        Math.hypot(first.x - last.x, first.y - last.y) <= RING_SEAM_EPSILON_METERS;
      const points = endsMeet ? wall.points.slice(0, -1) : wall.points;

      return points.length < MIN_CLOSED_WALL_POINTS ? wall : { ...wall, points, isClosed: true };
    }),
  }));
}

/**
 * Cuts the wall at one drawn point — the closing gesture's inverse. A ring
 * opens there: the polyline is re-rooted at the cut and walks the whole loop
 * back to it, ends coincident but no longer joined, and every hosted offset
 * (openings, wall devices) rotates with the new start. An open wall splits
 * into TWO walls sharing the cut point, its hosted things dealt to whichever
 * side they stand on; cutting an open wall's endpoint is a no-op.
 */
export function cutWallAtPoint(
  buildings: readonly Building[],
  buildingId: BuildingId,
  wallId: WallId,
  pointIndex: number
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => {
    const wall = storey.walls.find(candidate => candidate.id === wallId);

    if (isNil(wall)) {
      return storey;
    }

    return isWallClosed(wall)
      ? openRingAt(storey, wall, pointIndex)
      : splitOpenWallAt(storey, wall, pointIndex);
  });
}

function openRingAt(storey: Storey, wall: Wall, pointIndex: number): Storey {
  if (pointIndex < 0 || pointIndex >= wall.points.length) {
    return storey;
  }

  const centerline = wallCenterline(wall);
  const totalLength = polylineLength(centerline);
  const cutOffset = polylineLength(centerline.slice(0, pointIndex + 1));
  const rotated = [...wall.points.slice(pointIndex), ...wall.points.slice(0, pointIndex)];
  const cutWall: Wall = {
    ...wall,
    points: [...rotated, rotated[0]],
    isClosed: false,
  };
  const rotateOffset = (offsetMeters: Meters): Meters =>
    (((offsetMeters - cutOffset) % totalLength) + totalLength) % totalLength;

  return {
    ...storey,
    walls: storey.walls.map(candidate => (candidate.id === wall.id ? cutWall : candidate)),
    openings: storey.openings.map(opening =>
      opening.wallId === wall.id
        ? { ...opening, offsetMeters: rotateOffset(opening.offsetMeters) }
        : opening
    ),
    devices: devicesOf(storey).map(device =>
      device.host.kind === 'wall' && device.host.wallId === wall.id
        ? {
            ...device,
            host: { ...device.host, offsetMeters: rotateOffset(device.host.offsetMeters) },
          }
        : device
    ),
  };
}

function splitOpenWallAt(storey: Storey, wall: Wall, pointIndex: number): Storey {
  // An endpoint has nothing to split off; the interior points do.
  if (pointIndex <= 0 || pointIndex >= wall.points.length - 1) {
    return storey;
  }

  const splitOffset = polylineLength(wallCenterline(wall).slice(0, pointIndex + 1));
  const firstHalf: Wall = { ...wall, points: wall.points.slice(0, pointIndex + 1) };
  const secondHalf: Wall = {
    ...createWall({ points: wall.points.slice(pointIndex), material: wall.material }),
    thicknessMeters: wall.thicknessMeters,
    referenceLine: wall.referenceLine,
  };
  const walls = storey.walls.flatMap(candidate =>
    candidate.id === wall.id ? [firstHalf, secondHalf] : [candidate]
  );

  return {
    ...storey,
    walls,
    openings: storey.openings.map(opening =>
      opening.wallId === wall.id && opening.offsetMeters > splitOffset
        ? { ...opening, wallId: secondHalf.id, offsetMeters: opening.offsetMeters - splitOffset }
        : opening
    ),
    devices: devicesOf(storey).map(device =>
      device.host.kind === 'wall' &&
      device.host.wallId === wall.id &&
      device.host.offsetMeters > splitOffset
        ? {
            ...device,
            host: {
              ...device.host,
              wallId: secondHalf.id,
              offsetMeters: device.host.offsetMeters - splitOffset,
            },
          }
        : device
    ),
  };
}

export function findWall(
  buildings: readonly Building[],
  buildingId: BuildingId,
  wallId: WallId
): Wall | undefined {
  const building = buildings.find(candidate => candidate.id === buildingId);

  return building === undefined
    ? undefined
    : storeysOf(building)
        .flatMap(storey => storey.walls)
        .find(wall => wall.id === wallId);
}

/** Lands on whichever storey holds the host wall — an opening needs no floor. */
export function addOpening(
  buildings: readonly Building[],
  buildingId: BuildingId,
  opening: Opening
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey =>
    storey.walls.some(wall => wall.id === opening.wallId)
      ? { ...storey, openings: [...storey.openings, opening] }
      : storey
  );
}

export function updateOpening(
  buildings: readonly Building[],
  buildingId: BuildingId,
  openingId: OpeningId,
  changes: Partial<Omit<Opening, 'id' | 'wallId' | 'kind'>>
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    openings: storey.openings.map(opening =>
      opening.id === openingId ? { ...opening, ...changes } : opening
    ),
  }));
}

export function removeOpening(
  buildings: readonly Building[],
  buildingId: BuildingId,
  openingId: OpeningId
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    openings: storey.openings.filter(opening => opening.id !== openingId),
  }));
}

export function findOpening(
  buildings: readonly Building[],
  buildingId: BuildingId,
  openingId: OpeningId
): Opening | undefined {
  const building = buildings.find(candidate => candidate.id === buildingId);

  return building === undefined
    ? undefined
    : storeysOf(building)
        .flatMap(storey => storey.openings)
        .find(opening => opening.id === openingId);
}
