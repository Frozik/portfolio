export type TLogDirection = 'forward' | 'backward';

/** Time order of the lane: `forward` is oldest first, `backward` newest first. */
export function inDisplayOrder<TRow>(
  rows: readonly TRow[],
  time: (row: TRow) => string,
  direction: TLogDirection
): readonly TRow[] {
  const sign = direction === 'forward' ? 1 : -1;
  return [...rows].sort((left, right) => sign * time(left).localeCompare(time(right)));
}

/** Appends a chunk to the far end of the lane, dropping rows the lane already holds. */
export function appendChunk<TRow>(
  lane: readonly TRow[],
  chunk: readonly TRow[],
  keyOf: (row: TRow) => string
): readonly TRow[] {
  const known = new Set(lane.map(keyOf));
  return [...lane, ...chunk.filter(row => !known.has(keyOf(row)))];
}

/** Puts live rows at the fresh edge: the top for `backward`, the bottom for `forward`. */
export function insertLive<TRow>(
  lane: readonly TRow[],
  rows: readonly TRow[],
  keyOf: (row: TRow) => string,
  time: (row: TRow) => string,
  direction: TLogDirection
): readonly TRow[] {
  const known = new Set(lane.map(keyOf));
  const fresh = inDisplayOrder(
    rows.filter(row => !known.has(keyOf(row))),
    time,
    direction
  );
  return direction === 'backward' ? [...fresh, ...lane] : [...lane, ...fresh];
}

/** The time of the freshest row the lane holds, from which live must be complete. */
export function freshestTime<TRow>(
  lane: readonly TRow[],
  time: (row: TRow) => string,
  direction: TLogDirection
): string | undefined {
  const row = direction === 'backward' ? lane[0] : lane[lane.length - 1];
  return row === undefined ? undefined : time(row);
}

/** The time at the far end of the lane, where the next history chunk continues: the last row in either direction. */
export function farEndTime<TRow>(
  lane: readonly TRow[],
  time: (row: TRow) => string
): string | undefined {
  const row = lane[lane.length - 1];
  return row === undefined ? undefined : time(row);
}
