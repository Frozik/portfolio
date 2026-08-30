import type { Vector2 } from '@frozik/utils/math/vector2';

import { DEGREES_TO_RADIANS } from '../../domain/units';

const QUARTER_TURN_DEGREES = 90;

/** The two halves of a needle, ready for a pair of SVG `polygon` elements. */
export interface CompassNeedlePoints {
  /** The head, which carries the accent colour and points at geographic north. */
  readonly northPoints: string;
  /** The tail, drawn quieter so the needle reads as an arrow rather than a bar. */
  readonly southPoints: string;
}

/**
 * A point on a compass dial, in the frame both of the editor's SVG compasses are
 * drawn in: `y` grows downwards, so an angle counted clockwise from the top of
 * the view runs along `(sin, −cos)`.
 */
export function dialPoint({
  center,
  radius,
  angleDegrees,
}: {
  readonly center: Vector2;
  readonly radius: number;
  readonly angleDegrees: number;
}): Vector2 {
  const angle = angleDegrees * DEGREES_TO_RADIANS;

  return { x: center.x + Math.sin(angle) * radius, y: center.y - Math.cos(angle) * radius };
}

/**
 * The needle shared by the compass panel's dial and the gizmo over the 3D view,
 * so the two turn the same way and read as one instrument at two sizes.
 */
export function buildCompassNeedle({
  center,
  angleDegrees,
  northLength,
  tailLength,
  halfWidth,
}: {
  readonly center: Vector2;
  readonly angleDegrees: number;
  readonly northLength: number;
  readonly tailLength: number;
  readonly halfWidth: number;
}): CompassNeedlePoints {
  const tip = dialPoint({ center, radius: northLength, angleDegrees });
  const tail = dialPoint({ center, radius: -tailLength, angleDegrees });
  const acrossAngleDegrees = angleDegrees + QUARTER_TURN_DEGREES;
  const left = dialPoint({ center, radius: halfWidth, angleDegrees: acrossAngleDegrees });
  const right = dialPoint({ center, radius: -halfWidth, angleDegrees: acrossAngleDegrees });

  return {
    northPoints: formatPolygonPoints([tip, left, right]),
    southPoints: formatPolygonPoints([tail, left, right]),
  };
}

function formatPolygonPoints(points: readonly Vector2[]): string {
  return points.map(point => `${point.x},${point.y}`).join(' ');
}
