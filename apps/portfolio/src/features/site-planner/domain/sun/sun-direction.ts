import { DEGREES_TO_RADIANS } from '../units';
import type { WorldPoint } from '../view/world-frame';
import type { SunPosition } from './sun-position';

/** Direct sunlight is switched off entirely once the sun is under the horizon. */
const NIGHT_INTENSITY = 0;
const DAY_INTENSITY = 1;

/** The sun as the renderer takes it. */
export interface Sunlight {
  /** Unit vector pointing *towards* the sun, in world axes. */
  readonly direction: WorldPoint;
  /**
   * Multiplier on the direct light: 1 while the sun is up, 0 once it has set,
   * leaving the scene on its ambient light alone. Shadows follow it — a shadow
   * only ever darkens the direct term, so the night needs no second switch.
   */
  readonly intensity: number;
}

/**
 * The one conversion from an astronomical bearing to a direction in the scene,
 * and the place where the plot's own idea of north is applied.
 *
 * SunCalc measures the azimuth clockwise from geographic north (0 = N, π/2 = E,
 * π = S). The plan is drawn with its own north up, rotated away from geographic
 * north by `northOffsetDegrees` — the angle the compass needle shows — so the
 * bearing the plan sees is the geographic one less that offset. The world the
 * scene renders in has `+X` east, `+Y` up and `+Z` south (`planToWorld`), which
 * puts plan north at `−Z`: a bearing `b` therefore runs along
 * `(sin b, 0, −cos b)`, and the altitude lifts it out of that plane.
 *
 * The whole feature's sun and shadows hang off these three lines, which is why
 * they are tested against a known sky rather than only read.
 */
export function computeSunDirection(position: SunPosition, northOffsetDegrees: number): WorldPoint {
  const planBearing = position.azimuthRadians - northOffsetDegrees * DEGREES_TO_RADIANS;
  const horizontal = Math.cos(position.altitudeRadians);

  return [
    horizontal * Math.sin(planBearing),
    Math.sin(position.altitudeRadians),
    -horizontal * Math.cos(planBearing),
  ];
}

export function computeSunlight(position: SunPosition, northOffsetDegrees: number): Sunlight {
  return {
    direction: computeSunDirection(position, northOffsetDegrees),
    intensity: position.altitudeRadians > 0 ? DAY_INTENSITY : NIGHT_INTENSITY,
  };
}
