import type { Result } from '../Result';
import { err, ok } from '../Result';
import type { ExpressionNode } from './ast';
import { evaluate } from './evaluate';

export interface SampleRange {
  readonly xMin: number;
  readonly xMax: number;
  readonly points: number;
}

export type SampleRangeError = 'invalid-range' | 'too-few-points' | 'too-many-points';

export interface SampledCurve {
  readonly x: Float64Array;
  /** NaN marks a gap: an undefined value or the jump across an asymptote. */
  readonly y: Float64Array;
}

const MIN_POINTS = 2;
/** A sign flip bigger than this many times the typical spread of the curve is an asymptote, not a steep slope. */
const ASYMPTOTE_JUMP_FACTOR = 4;
const SPREAD_LOW_QUANTILE = 0.05;
const SPREAD_HIGH_QUANTILE = 0.95;

export function validateSampleRange(
  range: SampleRange,
  maxPoints: number
): Result<SampleRange, SampleRangeError> {
  if (!Number.isFinite(range.xMin) || !Number.isFinite(range.xMax) || range.xMin >= range.xMax) {
    return err('invalid-range');
  }
  if (!Number.isInteger(range.points) || range.points < MIN_POINTS) {
    return err('too-few-points');
  }
  if (range.points > maxPoints) {
    return err('too-many-points');
  }
  return ok(range);
}

/** Evenly spaced samples; values that are not finite and jumps across asymptotes become NaN gaps. */
export function sampleCurve(expression: ExpressionNode, range: SampleRange): SampledCurve {
  const step = (range.xMax - range.xMin) / (range.points - 1);
  const x = Float64Array.from({ length: range.points }, (_, index) => range.xMin + index * step);
  const y = x.map(value => {
    const result = evaluate(expression, value);
    return Number.isFinite(result) ? result : Number.NaN;
  });
  return { x, y: withAsymptoteGaps(y) };
}

function withAsymptoteGaps(y: Float64Array): Float64Array {
  const threshold = ASYMPTOTE_JUMP_FACTOR * typicalSpread(y);
  if (threshold === 0) {
    return y;
  }
  const gapped = y.slice();
  for (let index = 1; index < y.length; index += 1) {
    const before = y[index - 1] ?? Number.NaN;
    const after = y[index] ?? Number.NaN;
    const flipsSign = Math.sign(before) * Math.sign(after) < 0;
    if (flipsSign && Math.abs(after - before) > threshold) {
      gapped[Math.abs(before) > Math.abs(after) ? index - 1 : index] = Number.NaN;
    }
  }
  return gapped;
}

function typicalSpread(y: Float64Array): number {
  const finite = y.filter(Number.isFinite).sort();
  if (finite.length < MIN_POINTS) {
    return 0;
  }
  const low = finite[Math.floor(SPREAD_LOW_QUANTILE * (finite.length - 1))] ?? 0;
  const high = finite[Math.ceil(SPREAD_HIGH_QUANTILE * (finite.length - 1))] ?? 0;
  return high - low;
}
