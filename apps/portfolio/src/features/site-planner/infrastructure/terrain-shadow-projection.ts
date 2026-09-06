import { planToWorld } from '@frozik/utils/geometry/worldFrame';
import type { WorldPoint } from '@frozik/utils/geometry/worldFrame';
import type { ShadowProjection } from '@frozik/utils/webgpu/shadowMap';
import { computeShadowProjection } from '@frozik/utils/webgpu/shadowMap';

import type { Heightfield } from '../domain/terrain/heightfield';
import { computeElevationRange } from '../domain/terrain/heightfield';
import type { Meters } from '../domain/units';

/**
 * One shadow map, no cascades: a plot is tens of metres across, so 2048² texels
 * over its bounding box land at about three centimetres each — finer than the
 * feature's own accuracy target. Cascades solve a problem this scene does not
 * have.
 */
export const PLOT_SHADOW_MAP_SIZE = 2048;

const HALF = 0.5;

/**
 * Head-room above the ground for whatever stands on it. The light's box is built
 * from the terrain, and a tree or a house rises out of it — losing the top of a
 * tree would lose the shadow it casts, so the box grows by the tallest thing the
 * catalogue can put on the plot.
 */
const OBJECT_HEIGHT_ALLOWANCE_METERS: Meters = 15;

/** The light's box over the plot: the terrain's bounding sphere plus head-room. */
export function computeTerrainShadowProjection({
  field,
  sunDirection,
}: {
  readonly field: Heightfield;
  /** Unit vector towards the sun. */
  readonly sunDirection: WorldPoint;
}): ShadowProjection {
  const extent: Meters = (field.resolution - 1) * field.cellSizeMeters;
  const { minElevation, maxElevation } = computeElevationRange(field);
  const center = planToWorld(
    {
      x: field.originMeters.x + extent * HALF,
      y: field.originMeters.y + extent * HALF,
    },
    (minElevation + maxElevation) * HALF
  );
  const radius =
    Math.hypot(extent, extent, maxElevation - minElevation) * HALF + OBJECT_HEIGHT_ALLOWANCE_METERS;

  return computeShadowProjection({ center, radius, sunDirection, mapSize: PLOT_SHADOW_MAP_SIZE });
}
