/** Parametric tolerance for line parameter comparisons */
export const POSITION_EPSILON = 1e-6;

/** Checks if a parameter lies strictly inside any interval (with epsilon margin). */
export function isInAnyInterval(
  parameter: number,
  intervals: readonly { start: number; end: number }[]
): boolean {
  for (const interval of intervals) {
    if (
      parameter > interval.start + POSITION_EPSILON &&
      parameter < interval.end - POSITION_EPSILON
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if an entire range [rangeStart, rangeEnd] is contained within any single interval.
 * Both endpoints must be inside the same interval.
 */
export function isRangeInAnyInterval(
  rangeStart: number,
  rangeEnd: number,
  intervals: readonly { start: number; end: number }[]
): boolean {
  for (const interval of intervals) {
    if (
      rangeStart >= interval.start - POSITION_EPSILON &&
      rangeEnd <= interval.end + POSITION_EPSILON
    ) {
      return true;
    }
  }
  return false;
}

/** Checks if a parameter is within epsilon of any existing parameter. */
export function isDuplicateParameter(parameter: number, existing: readonly number[]): boolean {
  for (const existingParam of existing) {
    if (Math.abs(parameter - existingParam) < POSITION_EPSILON) {
      return true;
    }
  }
  return false;
}

/** Removes parameters that are within epsilon of their predecessor (assumes sorted input). */
export function deduplicateParameters(sortedParams: readonly number[]): readonly number[] {
  const result: number[] = [];

  for (const parameter of sortedParams) {
    if (result.length === 0 || Math.abs(parameter - result[result.length - 1]) > POSITION_EPSILON) {
      result.push(parameter);
    }
  }

  return result;
}

/** Merges overlapping intervals (assumes intervals may be unsorted). */
export function mergeIntervals(
  intervals: readonly { start: number; end: number }[]
): readonly { start: number; end: number }[] {
  if (intervals.length === 0) {
    return [];
  }

  const sorted = [...intervals].sort((intervalA, intervalB) => intervalA.start - intervalB.start);
  const merged: { start: number; end: number }[] = [sorted[0]];

  for (let index = 1; index < sorted.length; index++) {
    const current = sorted[index];
    const previous = merged[merged.length - 1];

    if (current.start <= previous.end + POSITION_EPSILON) {
      merged[merged.length - 1] = {
        start: previous.start,
        end: Math.max(previous.end, current.end),
      };
    } else {
      merged.push(current);
    }
  }

  return merged;
}
