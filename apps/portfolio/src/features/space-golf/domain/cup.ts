import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BallState } from './ball';
import type { WallHit } from './collision';
import { BALL_RADIUS_METERS } from './constants';
import type { FaceKind, Level, Wall } from './level';
import { edgeOf, pointAlongEdge } from './level';
import { distance, scale, subtract } from './vector';
import { createWall } from './walls';

/** Segments the half-circle of the notch is drawn and collided with. */
const CUP_ARC_SEGMENTS = 8;
/** A corner this close to the rim's circle is a corner of the rim. */
const RIM_TOLERANCE_METERS = 1e-3;

/** The centre of the notch: on the face's line, `at` metres along the edge. */
export function cupCenter(level: Level): Vector2 {
  return pointAlongEdge(edgeOf(level, level.cup), level.cup.at);
}

/**
 * Cuts the hole into its wall: the face segment under the notch is replaced
 * by a half-circle of `cup` edges bowing into the solid. The wall stays one
 * counter-clockwise polygon, now concave; the sweep treats every segment
 * alike, so the rim is a wall the ball can rest in or bounce off; touching
 * any of it turns gravity into the face the hole is cut into.
 */
export function carveCup(level: Level): Level {
  const { cup } = level;
  const wall = level.walls[cup.wall];
  const edge = wall.edges[cup.edge];
  const center = pointAlongEdge(edge, cup.at);
  const arc: Vector2[] = [];
  for (let index = 0; index <= CUP_ARC_SEGMENTS; index += 1) {
    // Walking the edge's own direction: from the near end of the notch, down
    // into the solid (along -normal) and up to the far end.
    const angle = Math.PI * (1 - index / CUP_ARC_SEGMENTS);
    const along = Math.cos(angle) * cup.radius;
    const depth = Math.sin(angle) * cup.radius;
    arc.push({
      x: center.x + edge.direction.x * along - edge.normal.x * depth,
      y: center.y + edge.direction.y * along - edge.normal.y * depth,
    });
  }
  const vertices = [
    ...wall.vertices.slice(0, cup.edge + 1),
    ...arc,
    ...wall.vertices.slice(cup.edge + 1),
  ];
  const insertedEdges = arc.length;
  const kinds = new Map<number, FaceKind>();
  wall.edges.forEach((each, index) => {
    if (each.kind !== 'floor' && each.kind !== 'deflector') {
      kinds.set(index > cup.edge ? index + insertedEdges : index, each.kind);
    }
  });
  for (let index = 1; index <= CUP_ARC_SEGMENTS; index += 1) {
    kinds.set(cup.edge + index, 'cup');
  }
  const carved = createWall(vertices, kinds);
  const walls = level.walls.map((each, index) => (index === cup.wall ? carved : each));
  return { ...level, walls };
}

/**
 * Whether a contact is with the hole's rim: one of its segments, or a
 * corner on the rim's circle — the corners between segments and the two
 * at the mouth, which the sweep may credit to the face beside the notch.
 * `position` is the ball's centre at the contact.
 */
export function touchesRim(level: Level, hit: WallHit, position: Vector2): boolean {
  if (hit.kind === 'cup') {
    return true;
  }
  if (hit.at !== 'corner' || hit.wall !== level.cup.wall) {
    return false;
  }
  const corner = subtract(position, scale(hit.normal, BALL_RADIUS_METERS));
  return Math.abs(distance(corner, cupCenter(level)) - level.cup.radius) <= RIM_TOLERANCE_METERS;
}

/**
 * Whether the ball is sitting in the hole: at rest on a segment of the rim
 * with its centre inside the notch. Nothing pulls it in — it rolls in, or it
 * does not.
 */
export function isInCup(
  level: Level,
  ball: BallState,
  wall: Wall = level.walls[level.cup.wall]
): boolean {
  if (
    ball.contact === undefined ||
    !('wall' in ball.contact) ||
    ball.contact.wall !== level.cup.wall ||
    wall.edges[ball.contact.edge]?.kind !== 'cup'
  ) {
    return false;
  }
  return distance(ball.position, cupCenter(level)) <= level.cup.radius - BALL_RADIUS_METERS / 2;
}
