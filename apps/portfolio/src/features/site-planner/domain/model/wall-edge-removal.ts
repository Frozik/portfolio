import { isNil } from 'lodash-es';

import { polylineLength, wallCenterline } from '../geometry/wall-geometry';
import type { Meters } from '../units';
import type { BuildingId } from './building';
import type { Building } from './building';
import { mapStoreys } from './storey-edits';
import type { Storey } from './storeys';
import { devicesOf } from './storeys';
import type { Wall, WallId } from './walls';
import { createWall, isWallClosed, MIN_WALL_POINTS } from './walls';

/** Taking one edge out of a wall at a junction: an open wall splits, a ring opens, and the openings the edge hosted go with it. */
/** The edge removal, addressed the way every wall edit is. */
export function removeWallEdgeIn(
  buildings: readonly Building[],
  buildingId: BuildingId,
  wallId: WallId,
  segmentIndex: number
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => removeWallEdge(storey, wallId, segmentIndex));
}

/**
 * Removes one segment of a wall — the junction UI's «цифра N». A middle
 * segment splits the wall in two; an end segment shortens it; a ring opens
 * into a run missing exactly that stretch. Openings and wall devices follow
 * by centreline offset: those standing on the removed stretch go with it,
 * the rest keep their place on whichever side they stand.
 */
export function removeWallEdge(storey: Storey, wallId: WallId, segmentIndex: number): Storey {
  const wall = storey.walls.find(candidate => candidate.id === wallId);

  if (isNil(wall)) {
    return storey;
  }

  return isWallClosed(wall)
    ? removeRingEdge(storey, wall, segmentIndex)
    : removeOpenEdge(storey, wall, segmentIndex);
}

function removeOpenEdge(storey: Storey, wall: Wall, segmentIndex: number): Storey {
  if (segmentIndex < 0 || segmentIndex >= wall.points.length - 1) {
    return storey;
  }

  const centerline = wallCenterline(wall);
  const segmentStart = polylineLength(centerline.slice(0, segmentIndex + 1));
  const segmentEnd = polylineLength(centerline.slice(0, segmentIndex + 2));
  const leftPoints = wall.points.slice(0, segmentIndex + 1);
  const rightPoints = wall.points.slice(segmentIndex + 1);
  const left = leftPoints.length >= MIN_WALL_POINTS ? { ...wall, points: leftPoints } : undefined;
  const right =
    rightPoints.length >= MIN_WALL_POINTS
      ? {
          ...createWall({ points: rightPoints, material: wall.material }),
          thicknessMeters: wall.thicknessMeters,
          referenceLine: wall.referenceLine,
        }
      : undefined;
  const survivors = [...(isNil(left) ? [] : [left]), ...(isNil(right) ? [] : [right])];

  const relocate = (
    offsetMeters: Meters
  ): { readonly wallId: WallId; readonly offsetMeters: Meters } | undefined => {
    if (offsetMeters < segmentStart) {
      return isNil(left) ? undefined : { wallId: left.id, offsetMeters };
    }

    if (offsetMeters > segmentEnd) {
      return isNil(right)
        ? undefined
        : { wallId: right.id, offsetMeters: offsetMeters - segmentEnd };
    }

    return undefined;
  };

  return applyEdgeRemoval(storey, wall.id, survivors, relocate);
}

function removeRingEdge(storey: Storey, wall: Wall, segmentIndex: number): Storey {
  const pointCount = wall.points.length;

  if (segmentIndex < 0 || segmentIndex >= pointCount) {
    return storey;
  }

  const centerline = wallCenterline(wall);
  const totalLength = polylineLength(centerline);
  const segmentStart = polylineLength(centerline.slice(0, segmentIndex + 1));
  const segmentEnd =
    segmentIndex === pointCount - 1
      ? totalLength
      : polylineLength(centerline.slice(0, segmentIndex + 2));
  const rootIndex = (segmentIndex + 1) % pointCount;
  const opened: Wall = {
    ...wall,
    points: [...wall.points.slice(rootIndex), ...wall.points.slice(0, rootIndex)],
    isClosed: false,
  };

  const relocate = (
    offsetMeters: Meters
  ): { readonly wallId: WallId; readonly offsetMeters: Meters } | undefined => {
    if (offsetMeters >= segmentStart && offsetMeters <= segmentEnd) {
      return undefined;
    }

    return {
      wallId: wall.id,
      offsetMeters: (((offsetMeters - segmentEnd) % totalLength) + totalLength) % totalLength,
    };
  };

  return applyEdgeRemoval(storey, wall.id, [opened], relocate);
}

function applyEdgeRemoval(
  storey: Storey,
  removedWallId: WallId,
  survivors: readonly Wall[],
  relocate: (
    offsetMeters: Meters
  ) => { readonly wallId: WallId; readonly offsetMeters: Meters } | undefined
): Storey {
  return {
    ...storey,
    walls: storey.walls.flatMap(candidate =>
      candidate.id === removedWallId ? survivors : [candidate]
    ),
    openings: storey.openings.flatMap(opening => {
      if (opening.wallId !== removedWallId) {
        return [opening];
      }

      const landed = relocate(opening.offsetMeters);

      return isNil(landed) ? [] : [{ ...opening, ...landed }];
    }),
    devices: devicesOf(storey).flatMap(device => {
      if (device.host.kind !== 'wall' || device.host.wallId !== removedWallId) {
        return [device];
      }

      const landed = relocate(device.host.offsetMeters);

      return isNil(landed) ? [] : [{ ...device, host: { ...device.host, ...landed } }];
    }),
  };
}
