import type { Meters } from '../units';
import { subtractPolygons } from './polygon-booleans';
import type { MultiPolygon } from './polygon-types';

/**
 * A reinforced-concrete floor slab, the primitive the building model was
 * missing (plan O-A3/П1). Without it a house of walls is an open box: the
 * extrusion's "roof" is only the top face of the wall ring, the sun shines
 * into the plan through the middle, upper-storey furniture floats over the
 * one below, an overhang shows its own guts instead of a soffit, and a stair
 * cutout has nothing to cut.
 */
export const SLAB_THICKNESS_METERS: Meters = 0.22;

/**
 * One horizontal plate of a storey, spanning its footprint. The TOP of the
 * plate is the storey's finished floor, so the plate itself hangs below that
 * level — the ceiling of whatever stands underneath.
 */
export interface StoreyPlate {
  readonly polygons: MultiPolygon;
  readonly baseElevation: Meters;
  readonly topElevation: Meters;
}

/**
 * The plate carrying a storey: its footprint minus whatever pierces it —
 * stair cutouts today. `floorElevation` is the finished floor level, so the
 * slab occupies the thickness immediately below it.
 */
export function buildFloorPlate({
  footprint,
  cutouts,
  floorElevation,
  thicknessMeters = SLAB_THICKNESS_METERS,
}: {
  readonly footprint: MultiPolygon;
  readonly cutouts: MultiPolygon;
  readonly floorElevation: Meters;
  readonly thicknessMeters?: Meters;
}): StoreyPlate | undefined {
  const polygons = cutouts.length === 0 ? footprint : subtractPolygons(footprint, cutouts);

  if (polygons.length === 0) {
    return undefined;
  }

  return {
    polygons,
    baseElevation: floorElevation - thicknessMeters,
    topElevation: floorElevation,
  };
}

/**
 * The plate closing a storey from above where no storey stands on it — the
 * roof over the exposed ceiling. Cutouts still apply: a stair reaching the
 * roof leaves its opening.
 */
export function buildRoofPlate({
  exposedCeiling,
  cutouts,
  ceilingElevation,
  thicknessMeters = SLAB_THICKNESS_METERS,
}: {
  readonly exposedCeiling: MultiPolygon;
  readonly cutouts: MultiPolygon;
  readonly ceilingElevation: Meters;
  readonly thicknessMeters?: Meters;
}): StoreyPlate | undefined {
  const polygons =
    cutouts.length === 0 ? exposedCeiling : subtractPolygons(exposedCeiling, cutouts);

  if (polygons.length === 0) {
    return undefined;
  }

  return {
    polygons,
    baseElevation: ceilingElevation,
    topElevation: ceilingElevation + thicknessMeters,
  };
}

/**
 * Floor-to-floor: what a stair actually has to climb (O-A4). `heightMeters`
 * on a storey is the CLEAR height — wall height, the number a person feels —
 * so the slab above it adds to the climb. Deriving a stair from the clear
 * height alone leaves it short by the slab and butting into the slab's edge.
 */
export function floorToFloorMeters(
  clearHeightMeters: Meters,
  thicknessMeters: Meters = SLAB_THICKNESS_METERS
): Meters {
  return clearHeightMeters + thicknessMeters;
}
