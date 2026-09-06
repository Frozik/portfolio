import type { ColoredMesh, LitMesh } from '@frozik/utils/geometry/litMesh';

/**
 * The paths draped over the ground: one mesh per flat paving, and the seam
 * strips as a painted mesh whose vertex colours carry the fade baked in.
 */
export interface PathDrapeGeometry {
  readonly dirt: LitMesh;
  readonly asphalt: LitMesh;
  readonly blend: ColoredMesh;
}

/** The roof covers over the exposed ceilings, split by material for the 3D view. */
export interface RoofOverlayGeometry {
  readonly green: LitMesh | undefined;
  readonly terrace: LitMesh | undefined;
}
