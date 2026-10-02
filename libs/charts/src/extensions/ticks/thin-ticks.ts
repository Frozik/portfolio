import type { IAxisTick } from '../../core/frame/ticks';

/** Keeps only ticks at least `minGapPx` apart, given where each falls along the axis. */
export function thinTicks<TPosition>(
  ticks: readonly IAxisTick<TPosition>[],
  pixelOf: (position: TPosition) => number,
  minGapPx: number
): readonly IAxisTick<TPosition>[] {
  const kept: IAxisTick<TPosition>[] = [];
  let lastPixel = Number.NEGATIVE_INFINITY;
  for (const tick of ticks) {
    const pixel = pixelOf(tick.position);
    if (pixel - lastPixel >= minGapPx) {
      kept.push(tick);
      lastPixel = pixel;
    }
  }
  return kept;
}
