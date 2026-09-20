/** Rows kept rendered beyond each edge of the viewport, to hide scroll latency. */
const DEFAULT_OVERSCAN = 10;

export type VirtualWindow = {
  /** First row to render, overscan included. */
  readonly startIndex: number;
  /** Last row to render, inclusive, overscan included. */
  readonly endIndex: number;
  /** Height of the rows skipped before `startIndex`. */
  readonly offsetBefore: number;
  /** Height of the rows skipped after `endIndex`. */
  readonly offsetAfter: number;
  /** Height of every row together. */
  readonly totalHeight: number;
};

/**
 * Running offsets of every row, plus the total. `offsets[i]` is where row `i`
 * starts; `offsets[count]` is the total height.
 */
export function rowOffsets(heights: readonly number[]): readonly number[] {
  const offsets = new Array<number>(heights.length + 1);
  offsets[0] = 0;
  for (let index = 0; index < heights.length; index += 1) {
    offsets[index + 1] = offsets[index] + heights[index];
  }
  return offsets;
}

/** Index of the last row starting at or before `offset`. Binary search over `rowOffsets`. */
export function indexAtOffset(offsets: readonly number[], offset: number): number {
  let low = 0;
  let high = offsets.length - 2;
  while (low < high) {
    const middle = Math.floor((low + high + 1) / 2);
    if (offsets[middle] <= offset) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low;
}

/**
 * The slice of rows worth rendering for a scroll position.
 *
 * Heights are per row rather than a single estimate on purpose: with an
 * estimate alone the error between guessed and real height accumulates down
 * the list, the scroll offsets drift away from the rendered content, and rows
 * visibly appear and disappear while scrolling.
 */
export function virtualWindow({
  heights,
  scrollTop,
  viewportHeight,
  overscan = DEFAULT_OVERSCAN,
}: {
  readonly heights: readonly number[];
  readonly scrollTop: number;
  readonly viewportHeight: number;
  readonly overscan?: number;
}): VirtualWindow {
  const offsets = rowOffsets(heights);
  const totalHeight = offsets[heights.length];

  if (heights.length === 0) {
    return { startIndex: 0, endIndex: -1, offsetBefore: 0, offsetAfter: 0, totalHeight: 0 };
  }

  const firstVisible = indexAtOffset(offsets, Math.max(0, scrollTop));
  const lastVisible = indexAtOffset(offsets, Math.max(0, scrollTop) + viewportHeight);

  const startIndex = Math.max(0, firstVisible - overscan);
  const endIndex = Math.min(heights.length - 1, lastVisible + overscan);

  return {
    startIndex,
    endIndex,
    offsetBefore: offsets[startIndex],
    offsetAfter: totalHeight - offsets[endIndex + 1],
    totalHeight,
  };
}
