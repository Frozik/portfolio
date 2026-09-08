import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BallState } from './ball';
import { BALL_RADIUS_METERS } from './constants';
import type { Level, SpikeRow, Wall } from './level';
import { edgeOf, pointAlongEdge } from './level';
import { distance, dot } from './vector';
import { createWall } from './walls';

/** Segments the half-circle of the notch is drawn and collided with. */
const CUP_ARC_SEGMENTS = 8;
/** Gravity must point into the cup's face this squarely for the ball to count as sitting in the hole. */
const INTO_FACE_MIN_ALIGNMENT = 0.9;

/** The centre of the notch: on the face's line, `at` metres along the edge. */
export function cupCenter(level: Level): Vector2 {
  return pointAlongEdge(edgeOf(level, level.cup), level.cup.at);
}

/**
 * Cuts the hole into its wall: the face segment under the notch is replaced
 * by a half-circle of `cup` edges bowing into the solid. The wall stays one
 * counter-clockwise polygon, now concave; the sweep treats every segment
 * alike, so the rim is an ordinary wall the ball can rest in or bounce off.
 * Spike rows on the same wall are re-pointed at their shifted edge indices.
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
  const bounceEdges = new Set<number>();
  wall.edges.forEach((each, index) => {
    if (each.kind === 'bounce') {
      bounceEdges.add(index > cup.edge ? index + insertedEdges : index);
    }
  });
  const cupEdges = new Set<number>();
  for (let index = 1; index <= CUP_ARC_SEGMENTS; index += 1) {
    cupEdges.add(cup.edge + index);
  }
  const carved = createWall(vertices, bounceEdges, cupEdges);
  const walls = level.walls.map((each, index) => (index === cup.wall ? carved : each));
  const spikes: SpikeRow[] = level.spikes.map(row =>
    row.wall === cup.wall && row.edge > cup.edge ? { ...row, edge: row.edge + insertedEdges } : row
  );
  return { ...level, walls, spikes };
}

/**
 * Whether the ball is sitting in the hole: its centre inside the notch,
 * gravity pointing into the face the notch is cut into, and the ball at
 * rest on the rim. Nothing pulls it in — it rolls in, or it does not.
 */
export function isInCup(
  level: Level,
  ball: BallState,
  wall: Wall = level.walls[level.cup.wall]
): boolean {
  const edge = edgeOf(level, level.cup);
  if (dot(ball.down, edge.normal) > -INTO_FACE_MIN_ALIGNMENT) {
    return false;
  }
  if (
    ball.contact === undefined ||
    wall.edges[ball.contact.edge]?.kind !== 'cup' ||
    ball.contact.wall !== level.cup.wall
  ) {
    return false;
  }
  return distance(ball.position, cupCenter(level)) <= level.cup.radius - BALL_RADIUS_METERS / 2;
}
