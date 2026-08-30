import type { Vector2 } from '@frozik/utils/math/vector2';

import type { Meters } from '../units';

/**
 * A point with an elevation, as the terrain pipeline sees it. `ElevationMark`
 * satisfies it structurally, which is what keeps this whole folder free of the
 * plan model and testable with plain literals.
 */
export interface ElevationSample {
  readonly position: Vector2;
  readonly elevation: Meters;
}
