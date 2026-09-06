import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { BuildingId } from './building';
import type { Building } from './building';
import { mapStoreys } from './storey-edits';
import type { Storey, StoreyId } from './storeys';
import type { Wall, WallId } from './walls';
import { isWallClosed } from './walls';

/**
 * Wall topology, derived rather than stored: a JUNCTION is the class of drawn
 * vertices standing on one spot (within {@link WELD_EPSILON_METERS}). Two
 * vertices that coincide ARE welded — there is no way to represent «touching
 * but not joined», which is exactly the illegal-looking state a stored node
 * graph would have allowed. The invariant that crossings carry vertices is
 * kept by {@link normalizeWallCrossings}, run after every finished edit.
 */
const WELD_EPSILON_METERS = 0.001;

/** One drawn vertex of one wall — the unit a junction is made of. */
export interface WallVertexRef {
  readonly wallId: WallId;
  readonly pointIndex: number;
}

/** One segment leaving a junction — what the break UI numbers. */
export interface JunctionEdge {
  readonly wallId: WallId;
  /** The segment after this drawn-point index (ring: the closing one wraps). */
  readonly segmentIndex: number;
  /** The far end of the segment, where its number badge hangs. */
  readonly farPoint: Vector2;
}

function isSameSpot(a: Vector2, b: Vector2): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= WELD_EPSILON_METERS;
}

/** Every drawn vertex of every wall standing on this spot. */
export function junctionVerticesAt(
  walls: readonly Wall[],
  position: Vector2
): readonly WallVertexRef[] {
  return walls.flatMap(wall =>
    wall.points.flatMap((point, pointIndex) =>
      isSameSpot(point, position) ? [{ wallId: wall.id, pointIndex }] : []
    )
  );
}

/** The segments of the wall as index pairs, the ring's closing one included. */
function segmentsOf(wall: Wall): readonly (readonly [number, number])[] {
  const open = wall.points.slice(0, -1).map((_, index) => [index, index + 1] as const);

  return isWallClosed(wall) ? [...open, [wall.points.length - 1, 0] as const] : open;
}

/**
 * The edges meeting at the junction, in a stable order — what the break UI
 * numbers 1…9. Both segments around a mid-wall vertex count, and a segment is
 * named by its index so the edit commands can aim at it.
 */
export function junctionEdgesAt(
  walls: readonly Wall[],
  position: Vector2
): readonly JunctionEdge[] {
  return walls.flatMap(wall =>
    segmentsOf(wall).flatMap(([from, to], segmentIndex) => {
      const start = wall.points[from];
      const end = wall.points[to];

      if (isSameSpot(start, position)) {
        return [{ wallId: wall.id, segmentIndex, farPoint: end }];
      }

      if (isSameSpot(end, position)) {
        return [{ wallId: wall.id, segmentIndex, farPoint: start }];
      }

      return [];
    })
  );
}

/**
 * Which of the edge's two endpoints stands ON the junction — the vertex the
 * detach carry takes hold of.
 */
export function edgeJunctionVertexIndex(
  wall: Wall,
  segmentIndex: number,
  junction: Vector2
): number | undefined {
  const segment = segmentsOf(wall)[segmentIndex];

  if (isNil(segment)) {
    return undefined;
  }

  const [from, to] = segment;

  if (isSameSpot(wall.points[from], junction)) {
    return from;
  }

  return isSameSpot(wall.points[to], junction) ? to : undefined;
}

/**
 * Moves the whole junction: every coincident vertex follows, however many
 * walls run through it — the drag that keeps a T-стык a T-стык.
 */
export function moveWallJunction(storey: Storey, from: Vector2, to: Vector2): Storey {
  return {
    ...storey,
    walls: storey.walls.map(wall =>
      wall.points.some(point => isSameSpot(point, from))
        ? {
            ...wall,
            points: wall.points.map(point => (isSameSpot(point, from) ? to : point)),
          }
        : wall
    ),
  };
}

interface SegmentCrossing {
  readonly t: number;
  readonly point: Vector2;
}

/** Where the point stands along the segment, if it lies on it at all. */
function pointOnSegment(start: Vector2, end: Vector2, point: Vector2): number | undefined {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return undefined;
  }

  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;

  if (t <= 0 || t >= 1) {
    return undefined;
  }

  const onLine = { x: start.x + t * dx, y: start.y + t * dy };

  return isSameSpot(onLine, point) ? t : undefined;
}

/** The proper crossing of two segments, endpoints excluded. */
function segmentCrossing(
  aStart: Vector2,
  aEnd: Vector2,
  bStart: Vector2,
  bEnd: Vector2
): SegmentCrossing | undefined {
  const dax = aEnd.x - aStart.x;
  const day = aEnd.y - aStart.y;
  const dbx = bEnd.x - bStart.x;
  const dby = bEnd.y - bStart.y;
  const denominator = dax * dby - day * dbx;

  if (denominator === 0) {
    return undefined;
  }

  const t = ((bStart.x - aStart.x) * dby - (bStart.y - aStart.y) * dbx) / denominator;
  const u = ((bStart.x - aStart.x) * day - (bStart.y - aStart.y) * dax) / denominator;

  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) {
    return undefined;
  }

  return { t, point: { x: aStart.x + t * dax, y: aStart.y + t * day } };
}

/**
 * Plants a drawn vertex wherever wall segments cross and wherever one wall's
 * vertex stands on another's segment — so every stык is a junction the drag
 * and the break UI can take hold of. The inserted vertices are collinear with
 * their segment, which is what keeps every hosted offset (openings, devices)
 * exactly where it was. Idempotent: a vertex already standing there suppresses
 * its own re-insertion.
 */
export function normalizeWallCrossings(storey: Storey): Storey {
  const inserts = new Map<WallId, Map<number, SegmentCrossing[]>>();

  const planInsert = (wall: Wall, segmentIndex: number, crossing: SegmentCrossing): void => {
    const nearExisting = wall.points.some(point => isSameSpot(point, crossing.point));
    const perWall = inserts.get(wall.id) ?? new Map<number, SegmentCrossing[]>();
    const perSegment = perWall.get(segmentIndex) ?? [];
    const alreadyPlanned = perSegment.some(planned => isSameSpot(planned.point, crossing.point));

    if (nearExisting || alreadyPlanned) {
      return;
    }

    perSegment.push(crossing);
    perWall.set(segmentIndex, perSegment);
    inserts.set(wall.id, perWall);
  };

  for (const wall of storey.walls) {
    for (const other of storey.walls) {
      if (wall.id === other.id) {
        continue;
      }

      segmentsOf(wall).forEach(([aFrom, aTo], aIndex) => {
        const aStart = wall.points[aFrom];
        const aEnd = wall.points[aTo];

        for (const [bFrom, bTo] of segmentsOf(other)) {
          const crossing = segmentCrossing(aStart, aEnd, other.points[bFrom], other.points[bTo]);

          if (!isNil(crossing)) {
            planInsert(wall, aIndex, crossing);
          }
        }

        for (const vertex of other.points) {
          const t = pointOnSegment(aStart, aEnd, vertex);

          if (!isNil(t)) {
            planInsert(wall, aIndex, { t, point: vertex });
          }
        }
      });
    }
  }

  if (inserts.size === 0) {
    return storey;
  }

  return {
    ...storey,
    walls: storey.walls.map(wall => {
      const perWall = inserts.get(wall.id);

      if (isNil(perWall)) {
        return wall;
      }

      const points: Vector2[] = [];

      segmentsOf(wall).forEach(([from], segmentIndex) => {
        points.push(wall.points[from]);

        const planned = [...(perWall.get(segmentIndex) ?? [])].sort((a, b) => a.t - b.t);

        for (const crossing of planned) {
          points.push(crossing.point);
        }
      });

      if (!isWallClosed(wall)) {
        points.push(wall.points[wall.points.length - 1]);
      }

      return { ...wall, points };
    }),
  };
}

/** Runs the crossing normalization over one building's every storey. */
export function normalizeBuildingWallCrossings(
  buildings: readonly Building[],
  buildingId: BuildingId
): readonly Building[] {
  return mapStoreys(buildings, buildingId, normalizeWallCrossings);
}

/** The junction move, addressed the way every wall edit is. */
export function moveWallJunctionIn(
  buildings: readonly Building[],
  buildingId: BuildingId,
  storeyId: StoreyId,
  from: Vector2,
  to: Vector2
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey =>
    storey.id === storeyId ? moveWallJunction(storey, from, to) : storey
  );
}
