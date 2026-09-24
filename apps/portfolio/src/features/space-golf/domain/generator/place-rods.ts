import type { Vector2 } from '@frozik/utils/math/vector2';

import { distanceBetweenSegments, distanceToSegment } from '../collision';
import {
  FLOATER_LARGE_SIDE_METERS,
  ROD_MAX_LENGTH_METERS,
  ROD_MIN_LENGTH_METERS,
} from '../constants';
import type { Edge, EdgeRef, Floater, Rod, RodKind, Segment, SpikeRow, Wall } from '../level';
import { pointAlongEdge } from '../level';
import { createRod, rodPath, rodTipLength, rodWidth } from '../rods';
import { add, dot, rightNormal, scale, subtract } from '../vector';
import { containsPoint } from '../walls';
import type { Random } from './random';
import { supportsTee } from './tee-support';

const MIN_RODS = 2;
const MAX_RODS = 4;
/** Faces and spots tried before the level goes with the rods it has. */
const ATTEMPTS = 300;
const KINDS: readonly RodKind[] = ['slide', 'screw'];
/** The widest rod there is, for what the faces must accommodate. */
const WIDEST_ROD_METERS = Math.max(...KINDS.map(rodWidth));
/** Face kept clear beside the rod at the ends of the face it slides out of and of the face it reaches. */
const END_CLEARANCE_METERS = 0.2;
const END_MARGIN_METERS = WIDEST_ROD_METERS / 2 + END_CLEARANCE_METERS;
/** Empty space kept around the rod's path, beyond its own thickness. */
const CORRIDOR_CLEARANCE_METERS = 0.1;
const CORRIDOR_SAMPLE_METERS = 0.05;
/** The path keeps this far from the ball on the tee, so no rod slides into it at the start. */
const TEE_CLEARANCE_METERS = 1;
/** A facing face's normal is the rod's direction reversed, within this. */
const FACING_TOLERANCE = 1e-6;
const ON_FACE_TOLERANCE_METERS = 1e-6;
/** The large diamond reaches this far from a floater's centre. */
const FLOATER_REACH_METERS = (FLOATER_LARGE_SIDE_METERS / 2) * Math.SQRT2;

/** What rods are placed on and among: the sector's own walls, and what already stands on and between them. */
export interface RodGround {
  /** A rod slides out of one of these and seats in one of these, and nowhere else. */
  readonly walls: readonly Wall[];
  /**
   * The walls of the sectors next door: in a rod's way like any wall, never
   * what it is fastened to. They are made anew after a hole while this
   * sector stays, and a rod fastened to one was left hanging in the air;
   * and two sectors out of each other's sight both fastened a rod to the
   * same face of a third.
   */
  readonly neighbourWalls: readonly Wall[];
  readonly spikes: readonly SpikeRow[];
  readonly floaters: readonly Floater[];
}

interface Face extends EdgeRef {
  readonly face: Edge;
}

/**
 * Rods for a finished sector — spikes and floaters placed, so their room is
 * known: two to four where they fit, each sliding out of a plain horizontal
 * or vertical face of the sector's own and bridging, fully out, to a plain
 * face of its own squarely across from it — the tip sinking into that face
 * — between a short and a long way off, with the path between clear of
 * walls, the neighbours' too,
 * spike teeth, floaters, the tee and other rods, and both faces free of
 * spike rows and of the cup.
 */
export function placeRods(
  random: Random,
  level: RodGround,
  avoid: readonly Vector2[],
  others: readonly Rod[]
): readonly Rod[] {
  const faces = plainFaces(level);
  const wanted = random.int(MIN_RODS, MAX_RODS);
  const rods: Rod[] = [];
  for (
    let attempt = 0;
    attempt < ATTEMPTS && rods.length < wanted && faces.length > 0;
    attempt += 1
  ) {
    const from = random.pick(faces);
    if (avoid.some(point => supportsTee(from.face, point))) {
      continue;
    }
    const at = END_MARGIN_METERS + random.next() * (from.face.length - 2 * END_MARGIN_METERS);
    const base = pointAlongEdge(from.face, at);
    const direction = from.face.normal;
    const gap = gapAcross(base, direction, faces);
    if (gap === undefined) {
      continue;
    }
    const kind = random.pick(KINDS);
    const rod = createRod(kind, base, direction, gap + rodTipLength(kind));
    if (isClear(rod, level, avoid, [...others, ...rods])) {
      rods.push(rod);
    }
  }
  return rods;
}

/** Plain floor faces long enough for a rod, with no spike row and no cup on them. */
function plainFaces(level: RodGround): readonly Face[] {
  return level.walls.flatMap((wall, wallIndex) =>
    wall.edges
      .map((face, edgeIndex) => ({ wall: wallIndex, edge: edgeIndex, face }))
      .filter(candidate => {
        const count = wall.edges.length;
        const before = wall.edges[(candidate.edge - 1 + count) % count];
        const after = wall.edges[(candidate.edge + 1) % count];
        return (
          candidate.face.kind === 'floor' &&
          candidate.face.length >= 2 * END_MARGIN_METERS &&
          before.kind !== 'cup' &&
          after.kind !== 'cup' &&
          !level.spikes.some(row => standsOn(row.base, candidate.face))
        );
      })
  );
}

/** Whether a stretch of face lies on `face`: the same line, the same side. */
function standsOn(stretch: Segment, face: Edge): boolean {
  return (
    dot(stretch.normal, face.normal) > 1 - FACING_TOLERANCE &&
    distanceToSegment(stretch.from, face) < ON_FACE_TOLERANCE_METERS &&
    distanceToSegment(stretch.to, face) < ON_FACE_TOLERANCE_METERS
  );
}

/** How far it is from `base` along `direction` to the nearest plain face squarely across, if one is in range. */
function gapAcross(base: Vector2, direction: Vector2, faces: readonly Face[]): number | undefined {
  let nearest: number | undefined;
  for (const { face } of faces) {
    if (dot(face.normal, direction) > -1 + FACING_TOLERANCE) {
      continue;
    }
    const gap = dot(subtract(face.from, base), direction);
    if (gap < ROD_MIN_LENGTH_METERS || gap > ROD_MAX_LENGTH_METERS) {
      continue;
    }
    const landing = dot(subtract(add(base, scale(direction, gap)), face.from), face.direction);
    if (landing < END_MARGIN_METERS || landing > face.length - END_MARGIN_METERS) {
      continue;
    }
    if (nearest === undefined || gap < nearest) {
      nearest = gap;
    }
  }
  return nearest;
}

/** The rod's path — its thickness plus the clearance, from base to the face it reaches — lies on the board and meets nothing. */
function isClear(
  rod: Rod,
  level: RodGround,
  avoid: readonly Vector2[],
  others: readonly Rod[]
): boolean {
  const path = rodPath(rod);
  const halfWidth = rodWidth(rod.kind) / 2 + CORRIDOR_CLEARANCE_METERS;
  const across = scale(rightNormal(rod.direction), halfWidth);
  if (avoid.some(point => distanceToSegment(point, path) < TEE_CLEARANCE_METERS)) {
    return false;
  }
  const standing = [...level.walls, ...level.neighbourWalls];
  for (let along = CORRIDOR_SAMPLE_METERS; along < path.length; along += CORRIDOR_SAMPLE_METERS) {
    const middle = pointAlongEdge(path, along);
    for (const point of [middle, add(middle, across), subtract(middle, across)]) {
      if (standing.some(wall => isInBounds(wall, point) && containsPoint(wall, point))) {
        return false;
      }
    }
  }
  const reach = halfWidth;
  const teethClear = level.spikes.every(row =>
    row.sides.every(
      side =>
        distanceToSegment(side.from, path) >= reach && distanceToSegment(side.to, path) >= reach
    )
  );
  const floatersClear = level.floaters.every(
    floater => distanceToSegment(floater.center, path) >= FLOATER_REACH_METERS + reach
  );
  // The whole of each path against the whole of the other: measured end to
  // end only, two rods crossing in the middle of both counted as clear.
  const rodsClear = others.every(
    other => distanceBetweenSegments(path, rodPath(other)) >= rodWidth(other.kind) + reach
  );
  return teethClear && floatersClear && rodsClear;
}

function isInBounds(wall: Wall, point: Vector2): boolean {
  const { min, max } = wall.bounds;
  return point.x >= min.x && point.x <= max.x && point.y >= min.y && point.y <= max.y;
}
