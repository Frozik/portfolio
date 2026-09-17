import type { Vector2 } from '@frozik/utils/math/vector2';

import { distanceToSegment } from '../collision';
import {
  FLOATER_LARGE_SIDE_METERS,
  ROD_MAX_LENGTH_METERS,
  ROD_MIN_LENGTH_METERS,
} from '../constants';
import type { Edge, EdgeRef, Level, Rod, RodKind, Segment, Wall } from '../level';
import { pointAlongEdge } from '../level';
import { createRod, rodSeat, rodTipLength, rodWidth } from '../rods';
import { add, dot, normalize, rightNormal, scale, subtract } from '../vector';
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
/** The large diamond reaches this far from a floater's centre. */
const FLOATER_REACH_METERS = (FLOATER_LARGE_SIDE_METERS / 2) * Math.SQRT2;

interface Face extends EdgeRef {
  readonly face: Edge;
}

/**
 * Rods for a finished level — spikes and floaters placed, so their room is
 * known: two to four where they fit, each sliding out of a plain horizontal or vertical
 * face and bridging, fully out, to a plain face squarely across from it —
 * the tip sinking into that face — between a short and a long way off,
 * with the path between clear of walls,
 * spike teeth, floaters, the tee and other rods, and both faces free of
 * spike rows and of the cup.
 */
export function placeRods(random: Random, level: Level): readonly Rod[] {
  const faces = plainFaces(level);
  const wanted = random.int(MIN_RODS, MAX_RODS);
  const rods: Rod[] = [];
  for (
    let attempt = 0;
    attempt < ATTEMPTS && rods.length < wanted && faces.length > 0;
    attempt += 1
  ) {
    const from = random.pick(faces);
    if (supportsTee(from.face, level.tee)) {
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
    if (isClear(rod, level, rods)) {
      rods.push(rod);
    }
  }
  return rods;
}

/** Plain floor faces long enough for a rod, with no spike row and no cup on them. */
function plainFaces(level: Level): readonly Face[] {
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
          !level.spikes.some(row => row.wall === wallIndex && row.edge === candidate.edge)
        );
      })
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
function isClear(rod: Rod, level: Level, others: readonly Rod[]): boolean {
  const path = pathOf(rod);
  const halfWidth = rodWidth(rod.kind) / 2 + CORRIDOR_CLEARANCE_METERS;
  const across = scale(rightNormal(rod.direction), halfWidth);
  const onBoard = [path.from, path.to].every(
    point => point.x >= 0 && point.y >= 0 && point.x <= level.width && point.y <= level.height
  );
  if (!onBoard || distanceToSegment(level.tee, path) < TEE_CLEARANCE_METERS) {
    return false;
  }
  for (let along = CORRIDOR_SAMPLE_METERS; along < path.length; along += CORRIDOR_SAMPLE_METERS) {
    const middle = pointAlongEdge(path, along);
    for (const point of [middle, add(middle, across), subtract(middle, across)]) {
      if (level.walls.some(wall => isInBounds(wall, point) && containsPoint(wall, point))) {
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
  const rodsClear = others.every(other => {
    const theirs = pathOf(other);
    const apart = rodWidth(other.kind) + reach;
    return (
      distanceToSegment(path.from, theirs) >= apart &&
      distanceToSegment(path.to, theirs) >= apart &&
      distanceToSegment(theirs.from, path) >= apart &&
      distanceToSegment(theirs.to, path) >= apart
    );
  });
  return teethClear && floatersClear && rodsClear;
}

function isInBounds(wall: Wall, point: Vector2): boolean {
  const { min, max } = wall.bounds;
  return point.x >= min.x && point.x <= max.x && point.y >= min.y && point.y <= max.y;
}

/** The rod's centre line from its base to the face it reaches. */
function pathOf(rod: Rod): Segment {
  const to = rodSeat(rod);
  const direction = normalize(subtract(to, rod.base));
  return {
    from: rod.base,
    to,
    direction,
    normal: rightNormal(direction),
    length: rod.length - rodTipLength(rod.kind),
  };
}
