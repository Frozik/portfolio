import type { StairKind } from '../model/stairs';
import type { Meters } from '../units';
import { DEGREES_TO_RADIANS } from '../units';

/** The run of a stair: how many risers a storey needs and whether the resulting steps are comfortable to climb. */
/**
 * The comfort targets the run derives toward : riser ≈ 17 cm,
 * tread from the 2h+d ≈ 63 cm stride formula. The stair stretches itself to
 * the storey height — the footprint is an OUTPUT of the model, never an input.
 */
const TARGET_RISER_METERS: Meters = 0.17;

const STRIDE_FORMULA_METERS: Meters = 0.63;

/** The advisory bands : outside these the warning layer lights up. */
const RISER_COMFORT_RANGE_METERS = { min: 0.15, max: 0.19 } as const;

const TREAD_COMFORT_RANGE_METERS = { min: 0.25, max: 0.3 } as const;

/** No stair is a single step; two risers is the degenerate floor. */
const MIN_RISER_COUNT = 2;

/**
 * A real spiral turns about this much per step; it is a property of how people
 * climb, not a free parameter. Keeping it FIXED is what makes the going a
 * consequence of the diameter — and therefore something worth checking.
 */
export const SPIRAL_DEGREES_PER_RISER = 30;

/** The pole a spiral's treads are fixed to. */
export const SPIRAL_POLE_RADIUS_METERS: Meters = 0.08;

/**
 * The going a spiral offers underfoot: the arc one step covers on the WALKING
 * LINE — the middle of the tread, where a person's foot lands — rather than at
 * the rim, where the arc flatters the stair, or at the pole, where nothing
 * walks. A ⌀1.6 m spiral turning 30° gives about 0.23 m here: too short,
 * though its rim arc looks generous.
 */
export function spiralGoingMeters(diameterMeters: Meters): Meters {
  const walkingRadius = (SPIRAL_POLE_RADIUS_METERS + diameterMeters / 2) / 2;

  return walkingRadius * SPIRAL_DEGREES_PER_RISER * DEGREES_TO_RADIANS;
}

/**
 * The derived run of one stair: how many risers reach the storey height and
 * what each step measures. Treads count one fewer than risers — the top
 * "tread" is the upper floor itself.
 */
export interface StairRun {
  readonly riserCount: number;
  readonly riserMeters: Meters;
  readonly treadMeters: Meters;
}

export function deriveStairRun(storeyHeightMeters: Meters): StairRun {
  const riserCount = Math.max(
    MIN_RISER_COUNT,
    Math.round(storeyHeightMeters / TARGET_RISER_METERS)
  );
  const riserMeters = storeyHeightMeters / riserCount;

  return {
    riserCount,
    riserMeters,
    treadMeters: STRIDE_FORMULA_METERS - 2 * riserMeters,
  };
}

/**
 * Whether the run is comfortable underfoot — the comfort advisory.
 *
 * A spiral must be judged by its OWN going, measured on the walking line, and
 * by the narrow end of its winders. Reading the straight-flight `treadMeters`
 * for it — as this check first did — passed a ⌀1.6 m spiral whose real going
 * is 0.21 m: a false green exactly where the risk is highest.
 */
export function isStairRunComfortable(
  run: StairRun,
  stair?: { readonly kind: StairKind; readonly widthMeters: Meters }
): boolean {
  const isRiserComfortable =
    run.riserMeters >= RISER_COMFORT_RANGE_METERS.min &&
    run.riserMeters <= RISER_COMFORT_RANGE_METERS.max;

  if (!isRiserComfortable) {
    return false;
  }

  if (stair?.kind === 'spiral') {
    const going = spiralGoingMeters(stair.widthMeters);

    return going >= TREAD_COMFORT_RANGE_METERS.min;
  }

  return (
    run.treadMeters >= TREAD_COMFORT_RANGE_METERS.min &&
    run.treadMeters <= TREAD_COMFORT_RANGE_METERS.max
  );
}
