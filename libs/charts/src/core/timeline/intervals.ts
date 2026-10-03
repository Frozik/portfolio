/** A half-open stretch of time `[from, to)` in epoch nanoseconds. */
export interface ITimeInterval {
  readonly from: bigint;
  readonly to: bigint;
}

/** The intervals merged where they overlap or touch, in order, empty ones dropped. */
export function unionOf(intervals: readonly ITimeInterval[]): readonly ITimeInterval[] {
  const sorted = intervals
    .filter(interval => interval.to > interval.from)
    .sort((first, second) => (first.from < second.from ? -1 : first.from > second.from ? 1 : 0));
  const merged: { from: bigint; to: bigint }[] = [];
  for (const interval of sorted) {
    const last = merged.at(-1);
    if (last !== undefined && interval.from <= last.to) {
      last.to = interval.to > last.to ? interval.to : last.to;
    } else {
      merged.push({ from: interval.from, to: interval.to });
    }
  }
  return merged;
}

/** What is left of `kept` once `removed` is taken out; both already merged and in order. */
export function differenceOf(
  kept: readonly ITimeInterval[],
  removed: readonly ITimeInterval[]
): readonly ITimeInterval[] {
  const left: ITimeInterval[] = [];
  let index = 0;
  for (const interval of kept) {
    let from = interval.from;
    while (index < removed.length && removed[index].to <= from) {
      index += 1;
    }
    for (
      let cursor = index;
      cursor < removed.length && removed[cursor].from < interval.to;
      cursor += 1
    ) {
      const hole = removed[cursor];
      if (hole.from > from) {
        left.push({ from, to: hole.from });
      }
      from = hole.to > from ? hole.to : from;
    }
    if (from < interval.to) {
      left.push({ from, to: interval.to });
    }
  }
  return left;
}

/** The parts of `within` that the merged, ordered intervals leave uncovered. */
export function complementOf(
  within: ITimeInterval,
  covered: readonly ITimeInterval[]
): readonly ITimeInterval[] {
  return differenceOf([within], covered);
}

/** The intervals cut down to `within`; those outside it dropped. */
export function clippedTo(
  within: ITimeInterval,
  intervals: readonly ITimeInterval[]
): readonly ITimeInterval[] {
  return intervals.flatMap(interval => {
    const from = interval.from > within.from ? interval.from : within.from;
    const to = interval.to < within.to ? interval.to : within.to;
    return to > from ? [{ from, to }] : [];
  });
}
