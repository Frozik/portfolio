import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';

import type { RectangleShape, Shape } from '../model/shapes';
import { rectangleLocalToPlan } from './polygonize-shape';

const HALF = 0.5;

/** Corner offsets in the rectangle's own frame, as fractions of its extents. */
const RECTANGLE_CORNER_FACTORS: readonly Vector2[] = [
  { x: -HALF, y: -HALF },
  { x: HALF, y: -HALF },
  { x: HALF, y: HALF },
  { x: -HALF, y: HALF },
];

/**
 * The points of a shape that carry a position of their own: the corners a
 * rectangle is defined by — rotated with it — and the centre every shape has.
 * A point halfway along an edge is a consequence of two corners rather than a
 * place anything is aligned to, which is why the set stops here.
 */
export function getShapeKeyPoints(shape: Shape): readonly Vector2[] {
  switch (shape.kind) {
    case 'rectangle':
      return rectangleKeyPoints(shape);
    case 'circle':
      return [shape.center];
    default:
      return assertNever(shape);
  }
}

function rectangleKeyPoints(rectangle: RectangleShape): readonly Vector2[] {
  return [
    ...RECTANGLE_CORNER_FACTORS.map(factors =>
      rectangleLocalToPlan(rectangle, {
        x: factors.x * rectangle.width,
        y: factors.y * rectangle.length,
      })
    ),
    rectangle.center,
  ];
}
