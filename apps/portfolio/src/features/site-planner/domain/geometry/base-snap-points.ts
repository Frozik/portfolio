import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { CircleShape, Shape } from '../model/shapes';
import type { Meters } from '../units';
import { rectangleLocalToPlan } from './polygonize-shape';
import { getShapeKeyPoints } from './shape-key-points';

const HALF = 0.5;

/** N / E / S / W of a circle — the quadrant points every CAD snaps to. */
const CIRCLE_QUADRANT_DIRECTIONS: readonly Vector2[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

/** Halfway along each rectangle edge, in the rectangle's own frame. */
const RECTANGLE_MIDPOINT_FACTORS: readonly Vector2[] = [
  { x: 0, y: -HALF },
  { x: HALF, y: 0 },
  { x: 0, y: HALF },
  { x: -HALF, y: 0 },
];

/**
 * The points of a base shape a WALL wants to land on. Wider than
 * {@link getShapeKeyPoints} on purpose: a partition typically starts at the
 * middle of an edge, and on a round base the quadrants are the only points
 * that exist at all — the polygonized facets are an artifact, not geometry.
 */
export function baseSnapPoints(shapes: readonly Shape[]): readonly Vector2[] {
  return shapes.flatMap(shape => {
    switch (shape.kind) {
      case 'circle':
        return [
          shape.center,
          ...CIRCLE_QUADRANT_DIRECTIONS.map(direction => ({
            x: shape.center.x + direction.x * shape.radius,
            y: shape.center.y + direction.y * shape.radius,
          })),
        ];
      case 'rectangle':
      case 'ellipse':
        return [
          ...getShapeKeyPoints(shape),
          ...RECTANGLE_MIDPOINT_FACTORS.map(factors =>
            rectangleLocalToPlan(shape, {
              x: factors.x * shape.width,
              y: factors.y * shape.length,
            })
          ),
        ];
      default:
        return getShapeKeyPoints(shape);
    }
  });
}

/**
 * The cursor projected onto the nearest circle's TRUE rim, or nothing while no
 * rim is within reach. This is what lets a wall vertex glide along a round
 * base instead of hopping between polygonization facets: the point returned
 * lies exactly at the radius, whatever the facet count.
 */
export function slideOntoCircleRim(
  shapes: readonly Shape[],
  point: Vector2,
  withinMeters: Meters
): Vector2 | undefined {
  let nearest: Vector2 | undefined;
  let nearestGap = withinMeters;

  for (const shape of shapes) {
    if (shape.kind !== 'circle') {
      continue;
    }

    const projected = projectOntoRim(shape, point);

    if (isNil(projected)) {
      continue;
    }

    const gap = Math.hypot(projected.x - point.x, projected.y - point.y);

    if (gap <= nearestGap) {
      nearest = projected;
      nearestGap = gap;
    }
  }

  return nearest;
}

function projectOntoRim(circle: CircleShape, point: Vector2): Vector2 | undefined {
  const towards = { x: point.x - circle.center.x, y: point.y - circle.center.y };
  const distance = Math.hypot(towards.x, towards.y);

  // Dead centre names no direction — there is nothing to project along.
  if (distance === 0) {
    return undefined;
  }

  return {
    x: circle.center.x + (towards.x / distance) * circle.radius,
    y: circle.center.y + (towards.y / distance) * circle.radius,
  };
}
