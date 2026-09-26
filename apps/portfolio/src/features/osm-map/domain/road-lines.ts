import type { Vector2 } from '@frozik/utils/math/vector2';

import { JUNCTION_GRID_PER_UNIT, LANE_OFFSET_M } from './constants';
import type { TileRing } from './tile-grid';
import type { TileCoord, TileKey } from './tile-key';
import { tileKeyOf } from './tile-key';

/** The OpenMapTiles road classes cars drive on; paths, rails and piers are not among them. */
export type RoadClass =
  | 'motorway'
  | 'trunk'
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'minor'
  | 'service';

export const ROAD_CLASSES: readonly RoadClass[] = [
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'minor',
  'service',
];

const KMH_PER_MPS = 3.6;

/** Cruising speed by road class, in metres per second. */
const SPEED_MPS: Readonly<Record<RoadClass, number>> = {
  motorway: 90 / KMH_PER_MPS,
  trunk: 70 / KMH_PER_MPS,
  primary: 60 / KMH_PER_MPS,
  secondary: 50 / KMH_PER_MPS,
  tertiary: 40 / KMH_PER_MPS,
  minor: 30 / KMH_PER_MPS,
  service: 15 / KMH_PER_MPS,
};

type Oneway = -1 | 0 | 1;

/** A road as the vector tile gives it: centre lines, class and direction (`1` along the line, `-1` against, `0` both). */
export interface TileRoad {
  readonly lines: readonly TileRing[];
  readonly roadClass: RoadClass;
  readonly oneway: Oneway;
}

/**
 * A road centre line cut to its tile: plan metres from the tile's
 * north-west corner (x east, y north), with a key per vertex on a grid
 * shared by every tile, so the same junction — or the same road crossing
 * the tile border — has the same key on both sides.
 */
export interface RoadLine {
  readonly key: string;
  readonly tileKey: TileKey;
  readonly points: readonly Vector2[];
  readonly vertexKeys: readonly string[];
  /** Distance along the line at each point; the last entry is the line's length. */
  readonly cumulativeM: readonly number[];
  readonly lengthM: number;
  readonly roadClass: RoadClass;
  readonly oneway: Oneway;
  readonly speedMps: number;
  /** Whether the first and the last point lie on the tile border, where the road goes on in the neighbour. */
  readonly bordersAtStart: boolean;
  readonly bordersAtEnd: boolean;
}

export interface Pose {
  readonly position: Vector2;
  readonly headingRad: number;
}

type Edge = 'west' | 'east' | 'north' | 'south';
const EDGES: readonly Edge[] = ['west', 'east', 'north', 'south'];

interface TileSquare {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

function inside(point: Vector2, edge: Edge, square: TileSquare): boolean {
  switch (edge) {
    case 'west':
      return point.x >= square.minX;
    case 'east':
      return point.x <= square.maxX;
    case 'north':
      return point.y >= square.minY;
    case 'south':
      return point.y <= square.maxY;
  }
}

/** Where the segment meets the edge line; both tiles sharing the edge compute it from the same global inputs. */
function crossing(from: Vector2, to: Vector2, edge: Edge, square: TileSquare): Vector2 {
  if (edge === 'west' || edge === 'east') {
    const x = edge === 'west' ? square.minX : square.maxX;
    const along = (x - from.x) / (to.x - from.x);
    return { x, y: from.y + (to.y - from.y) * along };
  }
  const y = edge === 'north' ? square.minY : square.maxY;
  const along = (y - from.y) / (to.y - from.y);
  return { x: from.x + (to.x - from.x) * along, y };
}

/** Sutherland–Hodgman for an open polyline: pieces outside the edge are cut away, splitting the line. */
function clipAgainst(pieces: readonly Vector2[][], edge: Edge, square: TileSquare): Vector2[][] {
  const result: Vector2[][] = [];
  for (const piece of pieces) {
    let current: Vector2[] = [];
    piece.forEach((point, index) => {
      const previous = piece[index - 1];
      const isInside = inside(point, edge, square);
      if (previous !== undefined && inside(previous, edge, square) !== isInside) {
        current.push(crossing(previous, point, edge, square));
        if (!isInside) {
          result.push(current);
          current = [];
        }
      }
      if (isInside) {
        current.push(point);
      }
    });
    if (current.length > 0) {
      result.push(current);
    }
  }
  return result.filter(piece => piece.length > 1);
}

function vertexKey(global: Vector2): string {
  return `${Math.round(global.x * JUNCTION_GRID_PER_UNIT)},${Math.round(global.y * JUNCTION_GRID_PER_UNIT)}`;
}

function onBorder(global: Vector2, square: TileSquare): boolean {
  return (
    global.x === square.minX ||
    global.x === square.maxX ||
    global.y === square.minY ||
    global.y === square.maxY
  );
}

/**
 * Cuts the roads of a tile to the tile square — the tile carries a buffer
 * beyond its edge, which the neighbour carries too — and keys every
 * vertex on the shared grid. Global tile units go in, plan metres come out.
 */
export function roadLinesOfTile(
  roads: readonly TileRoad[],
  coord: TileCoord,
  extent: number,
  tileSizeM: number
): readonly RoadLine[] {
  const square: TileSquare = {
    minX: coord.x * extent,
    maxX: (coord.x + 1) * extent,
    minY: coord.y * extent,
    maxY: (coord.y + 1) * extent,
  };
  const scale = tileSizeM / extent;
  const tileKey = tileKeyOf(coord);
  const lines: RoadLine[] = [];
  for (const road of roads) {
    for (const line of road.lines) {
      const global = line.map(point => ({ x: point.x + square.minX, y: point.y + square.minY }));
      const pieces = EDGES.reduce(
        (clipped, edge) => clipAgainst(clipped, edge, square),
        [global.map(point => ({ ...point }))]
      );
      for (const piece of pieces) {
        const points = piece.map(point => ({
          x: (point.x - square.minX) * scale,
          y: -(point.y - square.minY) * scale,
        }));
        const cumulativeM = [0];
        for (let index = 1; index < points.length; index++) {
          const previous = points[index - 1];
          const point = points[index];
          cumulativeM.push(
            cumulativeM[index - 1] + Math.hypot(point.x - previous.x, point.y - previous.y)
          );
        }
        const lengthM = cumulativeM[cumulativeM.length - 1];
        if (lengthM === 0) {
          continue;
        }
        lines.push({
          key: `${tileKey}/${lines.length}`,
          tileKey,
          points,
          vertexKeys: piece.map(vertexKey),
          cumulativeM,
          lengthM,
          roadClass: road.roadClass,
          oneway: road.oneway,
          speedMps: SPEED_MPS[road.roadClass],
          bordersAtStart: onBorder(piece[0], square),
          bordersAtEnd: onBorder(piece[piece.length - 1], square),
        });
      }
    }
  }
  return lines;
}

/** Where a distance along the line lands and which way a car driving in `direction` faces there. */
export function poseAlongLine(line: RoadLine, distanceM: number, direction: 1 | -1): Pose {
  const { points, cumulativeM } = line;
  let segment = 1;
  while (segment < cumulativeM.length - 1 && cumulativeM[segment] < distanceM) {
    segment++;
  }
  const from = points[segment - 1];
  const to = points[segment];
  const segmentLength = cumulativeM[segment] - cumulativeM[segment - 1];
  const along = segmentLength === 0 ? 0 : (distanceM - cumulativeM[segment - 1]) / segmentLength;
  const heading = Math.atan2(to.y - from.y, to.x - from.x);
  return {
    position: { x: from.x + (to.x - from.x) * along, y: from.y + (to.y - from.y) * along },
    headingRad: direction === 1 ? heading : heading + Math.PI,
  };
}

/** Right-hand traffic: on a two-way road a car keeps to the right of the centre line. */
export function laneOffset(pose: Pose, line: RoadLine): Pose {
  if (line.oneway !== 0) {
    return pose;
  }
  return {
    ...pose,
    position: {
      x: pose.position.x + Math.sin(pose.headingRad) * LANE_OFFSET_M,
      y: pose.position.y - Math.cos(pose.headingRad) * LANE_OFFSET_M,
    },
  };
}
