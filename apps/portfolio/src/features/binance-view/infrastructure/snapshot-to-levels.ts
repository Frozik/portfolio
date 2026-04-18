import { FLOATS_PER_TEXEL, TEXEL_INTERP_CHANNEL } from '../domain/constants';
import type { IOrderbookSnapshot } from '../domain/types';

/**
 * Pack a single orderbook snapshot into a flat `Float32Array` of
 * `snapshotSlots × FLOATS_PER_TEXEL` floats, with layout
 * `[timeDelta=0, price, volume, isInterpolated]` per texel.
 *
 * Bids occupy indices [0 .. bids.length), asks follow from `depth`
 * (mid-point of the column) so that `side` can be inferred from index:
 *   - indices [0 .. depth)      → bids (price desc)
 *   - indices [depth .. 2*depth) → asks (price asc)
 *   - tail zero-padded (volume=0 → shader skips them)
 *
 * `timeDelta` is intentionally written as 0 — the caller (block-
 * accumulator) rewrites it using the block's `firstTimestampMs`.
 *
 * `isInterpolated` is a 0/1 flag that the fragment shader uses to
 * overlay diagonal stripes on repeat-last snapshots.
 */
export function snapshotToLevels(
  snapshot: IOrderbookSnapshot,
  snapshotSlots: number,
  depth: number,
  isInterpolated: boolean
): Float32Array {
  const buffer = new Float32Array(snapshotSlots * FLOATS_PER_TEXEL);
  const interpolatedFlag = isInterpolated ? 1 : 0;

  const bidsCount = Math.min(snapshot.bids.length, depth);
  for (let index = 0; index < bidsCount; index++) {
    const [price, volume] = snapshot.bids[index];
    const offset = index * FLOATS_PER_TEXEL;
    buffer[offset + 1] = price;
    buffer[offset + 2] = volume;
    buffer[offset + TEXEL_INTERP_CHANNEL] = interpolatedFlag;
  }

  const asksCount = Math.min(snapshot.asks.length, depth);
  for (let index = 0; index < asksCount; index++) {
    const [price, volume] = snapshot.asks[index];
    const offset = (depth + index) * FLOATS_PER_TEXEL;
    buffer[offset + 1] = price;
    buffer[offset + 2] = volume;
    buffer[offset + TEXEL_INTERP_CHANNEL] = interpolatedFlag;
  }

  return buffer;
}

/**
 * Classify a level slot into `bid` / `ask` / `padding` based on its
 * position within the snapshot column.
 */
export function levelSide(levelIndex: number, depth: number): 'bid' | 'ask' | 'padding' {
  if (levelIndex < depth) {
    return 'bid';
  }
  if (levelIndex < 2 * depth) {
    return 'ask';
  }
  return 'padding';
}
