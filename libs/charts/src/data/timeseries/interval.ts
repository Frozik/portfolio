/**
 * A closed interval of time in nanoseconds. Time is whole, so "after T" is
 * `T + 1` and every bound can be inclusive.
 */
export interface IInterval {
  readonly start: bigint;
  readonly end: bigint;
}

/** Stand for "from the beginning of history" and "for ever": the ends of a 64-bit time. */
export const TIME_MIN = -(2n ** 63n);
export const TIME_MAX = 2n ** 63n - 1n;

export function intersects(first: IInterval, second: IInterval): boolean {
  return first.start <= second.end && second.start <= first.end;
}

export function intersection(first: IInterval, second: IInterval): IInterval | undefined {
  const start = first.start > second.start ? first.start : second.start;
  const end = first.end < second.end ? first.end : second.end;
  return start <= end ? { start, end } : undefined;
}

/** What is left of `whole` once every interval of `taken` is removed, in order. */
export function subtract(whole: IInterval, taken: readonly IInterval[]): readonly IInterval[] {
  const ordered = [...taken].sort((first, second) => (first.start < second.start ? -1 : 1));
  const left: IInterval[] = [];
  let cursor = whole.start;
  for (const each of ordered) {
    if (each.end < cursor) {
      continue;
    }
    if (each.start > whole.end) {
      break;
    }
    if (each.start > cursor) {
      left.push({ start: cursor, end: each.start - 1n });
    }
    if (each.end >= whole.end) {
      return left;
    }
    cursor = each.end + 1n;
  }
  left.push({ start: cursor, end: whole.end });
  return left;
}
