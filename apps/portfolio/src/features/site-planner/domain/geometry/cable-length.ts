import type { Vector2 } from '@frozik/utils/math/vector2';
import type { WiringLevel } from '../model/wiring-routes';
import type { Meters } from '../units';
import { polylineLength } from './wall-geometry';

/** ПУЭ practice: the horizontal run sits 150–200 mm under the ceiling. */
export const CEILING_RUN_OFFSET_METERS: Meters = 0.15;
/** A floor run lies just above the slab, under the screed. */
const FLOOR_RUN_OFFSET_METERS: Meters = 0.05;

/** The height a run's horizontal travels at, above the storey's floor. */
export function runHeightMeters(level: WiringLevel, storeyHeightMeters: Meters): Meters {
  return level === 'ceiling'
    ? storeyHeightMeters - CEILING_RUN_OFFSET_METERS
    : FLOOR_RUN_OFFSET_METERS;
}

/**
 * What one cable run measures (`wiring.md` §3.4): the horizontal along the
 * plan plus the drop at either end from the run's level to the device — a
 * socket at 0.3 m under a ceiling run costs a wall's height of cable, a
 * ceiling light costs nothing. The reserve is the caller's to add.
 */
export function cableRunLengthMeters({
  planPoints,
  level,
  storeyHeightMeters,
  fromHeightMeters,
  toHeightMeters,
}: {
  readonly planPoints: readonly Vector2[];
  readonly level: WiringLevel;
  readonly storeyHeightMeters: Meters;
  readonly fromHeightMeters: Meters;
  readonly toHeightMeters: Meters;
}): Meters {
  const runHeight = runHeightMeters(level, storeyHeightMeters);

  return (
    polylineLength(planPoints) +
    Math.abs(runHeight - fromHeightMeters) +
    Math.abs(runHeight - toHeightMeters)
  );
}
