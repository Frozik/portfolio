import type { IAxisTick, ITickAxis } from '../../core/frame/ticks';

/** A candidate tick as its generator sees it: what to call it, and how much it matters next to its neighbours. */
export interface ITickCandidate {
  readonly label: string;
  /** A candidate that begins a larger unit outranks the plain ones round it and wins the room over them. */
  readonly rank: number;
}

/**
 * Candidates as the axis shows them: each where the axis puts it — a cut
 * swallows what fell into it, and of the candidates it swallowed one stays
 * — and never closer to the one before than its label needs; of two that
 * would run into one another the one of higher rank stays.
 */
export function laidOut<TPosition>(
  candidates: readonly TPosition[],
  axis: ITickAxis<TPosition>,
  minGapPx: number,
  describe: (candidate: TPosition, shown: TPosition) => ITickCandidate
): readonly IAxisTick<TPosition>[] {
  const kept: (IAxisTick<TPosition> & { readonly rank: number; readonly pixel: number })[] = [];
  let lastShown: TPosition | undefined;
  for (const candidate of candidates) {
    const position = axis.shownAt(candidate);
    if (position === lastShown) {
      continue;
    }
    const pixel = axis.pixelOf(position);
    const { label, rank } = describe(candidate, position);
    const last = kept.at(-1);
    const beforeLast = kept.at(-2);
    if (last !== undefined && pixel - last.pixel < minGapPx) {
      const outranks =
        rank > last.rank && (beforeLast === undefined || pixel - beforeLast.pixel >= minGapPx);
      if (!outranks) {
        continue;
      }
      kept.pop();
    }
    kept.push({ position, label, rank, pixel });
    lastShown = position;
  }
  return kept.map(({ position, label }) => ({ position, label }));
}
