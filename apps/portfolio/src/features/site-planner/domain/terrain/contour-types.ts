import type { Vector2 } from '@frozik/utils/math/vector2';

import type { Meters } from '../units';

/** A contour as the plan draws it, and the cell segments it is chained from. */
/** One traced contour: a chain of plan points, all at the same elevation. */
export interface ContourPolyline {
  readonly level: Meters;
  readonly points: readonly Vector2[];
}

export interface ContourSegment {
  readonly start: Vector2;
  readonly end: Vector2;
}
