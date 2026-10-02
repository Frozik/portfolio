/** The curve is defined for X from nought to this. */
export const DEPTH_EXTENT = 200;

const POINT_COUNT = 401;
const BASE_LEVEL = 5;
const WAVES = [
  { center: 60, width: 18, height: 40, drift: 22, speed: 1 },
  { center: 130, width: 28, height: 28, drift: 30, speed: 0.6 },
  { center: 165, width: 9, height: 18, drift: 12, speed: 1.7 },
] as const;

export interface IDepthCurve {
  readonly x: Float64Array;
  readonly value: Float64Array;
}

/**
 * A distribution over a plain numeric axis that is another at every phase:
 * three humps drifting at their own pace. Stands for a set of points that
 * changes as a whole — a depth of market, a recalculated curve.
 */
export function depthCurve(phase: number): IDepthCurve {
  const x = new Float64Array(POINT_COUNT);
  const value = new Float64Array(POINT_COUNT);
  for (let index = 0; index < POINT_COUNT; index += 1) {
    const position = (index / (POINT_COUNT - 1)) * DEPTH_EXTENT;
    let level = BASE_LEVEL;
    for (const wave of WAVES) {
      const center = wave.center + Math.sin(phase * wave.speed) * wave.drift;
      level += wave.height * Math.exp(-(((position - center) / wave.width) ** 2));
    }
    x[index] = position;
    value[index] = level;
  }
  return { x, value };
}
