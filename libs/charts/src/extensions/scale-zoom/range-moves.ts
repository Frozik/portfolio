import type { IScaleFrame } from '../../core/scale/scale';
import { fromAxis, pixelToValue, toAxis } from '../../core/scale/scale-mapping';
import type { IValueRange } from '../../core/viewport/axis-domain';

function rangeOf(scale: IScaleFrame, low: number, high: number): IValueRange | undefined {
  const next = { min: fromAxis(scale.kind, low), max: fromAxis(scale.kind, high) };
  return Number.isFinite(next.min) && Number.isFinite(next.max) && next.min < next.max
    ? next
    : undefined;
}

/** The range stretched by `factor` about `anchor`, both measured as the axis measures; none when nothing is left of it. */
export function stretched(
  scale: IScaleFrame,
  range: IValueRange,
  factor: number,
  anchor: number
): IValueRange | undefined {
  const low = toAxis(scale.kind, range.min);
  const high = toAxis(scale.kind, range.max);
  return rangeOf(scale, anchor - (anchor - low) * factor, anchor + (high - anchor) * factor);
}

/** Fingers closer than this, device pixels, set no height: the pinch only moves the range. */
const MIN_PINCH_SEPARATION = 20;

/**
 * The range of the scale that brings what stood under two fingers at `from`
 * under them at `to`, device pixels: moved by their middle and stretched by
 * their separation. Fingers too close together only move it.
 */
export function pinched(
  scale: IScaleFrame,
  from: readonly [number, number],
  to: readonly [number, number]
): IValueRange | undefined {
  const low = toAxis(scale.kind, scale.min);
  const span = toAxis(scale.kind, scale.max) - low;
  const along = (y: number): number => (toAxis(scale.kind, pixelToValue(scale, y)) - low) / span;
  const held = [low + span * along(from[0]), low + span * along(from[1])] as const;
  const at = [along(to[0]), along(to[1])] as const;
  const isSpread =
    Math.abs(from[1] - from[0]) >= MIN_PINCH_SEPARATION &&
    Math.abs(to[1] - to[0]) >= MIN_PINCH_SEPARATION;
  const nextSpan = isSpread ? (held[1] - held[0]) / (at[1] - at[0]) : span;
  const nextLow = (held[0] + held[1]) / 2 - (nextSpan * (at[0] + at[1])) / 2;
  return rangeOf(scale, nextLow, nextLow + nextSpan);
}

/** The range of the scale moved so that what stood at `fromY` stands at `toY`, device pixels. */
export function shifted(scale: IScaleFrame, fromY: number, toY: number): IValueRange | undefined {
  const delta =
    toAxis(scale.kind, pixelToValue(scale, fromY)) - toAxis(scale.kind, pixelToValue(scale, toY));
  return rangeOf(
    scale,
    toAxis(scale.kind, scale.min) + delta,
    toAxis(scale.kind, scale.max) + delta
  );
}
