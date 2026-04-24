import type { IGlassesTransform } from '../domain/glasses-transform';

/**
 * Default EMA coefficient for glasses-transform smoothing.
 *
 * Higher values (closer to 1) react faster to landmark changes but show
 * more per-frame jitter; lower values smooth aggressively at the cost of
 * visible lag. 0.35 was picked empirically on a 640x480 webcam feed.
 *
 * Kept as a named constant so callers and tests stay in sync with the
 * default used by the presentation layer; CLAUDE.md forbids magic
 * numeric literals outside well-known math.
 */
export const DEFAULT_SMOOTHING_ALPHA = 0.35;

/**
 * Apply a per-field exponential moving average between `previous` and
 * `next`. `alpha = 1` returns `next` unchanged; `alpha = 0` freezes on
 * `previous`. `previous === null` means "no prior sample" and short-
 * circuits to the incoming transform so the first frame appears
 * instantly without an unnatural ramp-in.
 *
 * Pure function — no DOM, no MobX, no time dependency — so it is
 * trivially unit-testable.
 */
export function smoothGlassesTransform(
  previous: IGlassesTransform | null,
  next: IGlassesTransform,
  alpha: number
): IGlassesTransform {
  if (previous === null) {
    return next;
  }
  return {
    translateX: lerp(previous.translateX, next.translateX, alpha),
    translateY: lerp(previous.translateY, next.translateY, alpha),
    rotateDeg: lerp(previous.rotateDeg, next.rotateDeg, alpha),
    scaleX: lerp(previous.scaleX, next.scaleX, alpha),
    scaleY: lerp(previous.scaleY, next.scaleY, alpha),
  };
}

function lerp(previous: number, next: number, alpha: number): number {
  return previous + (next - previous) * alpha;
}
