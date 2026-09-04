import { BlockSpatialIndex } from './block-store/block-spatial-index';
import { findBucketsAt } from './trades-hit-test';
import type { ITradeBlockIndexItem } from './trades-types';
import type { UnixTimeMs } from './types';

const BLOCK_START_MS = 1_700_000_000_000 as UnixTimeMs;
const BUCKET_START_MS = (BLOCK_START_MS + 5_000) as UnixTimeMs;
const BASE_PRICE = 100;
const VWAP = 120;

function buildIndex(): {
  readonly tradesIndex: BlockSpatialIndex<ITradeBlockIndexItem>;
  readonly blockData: ReadonlyMap<UnixTimeMs, Float32Array>;
} {
  const tradesIndex = new BlockSpatialIndex<ITradeBlockIndexItem>();
  tradesIndex.upsert({
    minX: BLOCK_START_MS,
    maxX: BUCKET_START_MS,
    minY: 0,
    maxY: 0,
    blockId: BLOCK_START_MS,
    textureRowIndex: 0,
    bucketCount: 1,
    basePrice: BASE_PRICE,
  });
  const blockData = new Map<UnixTimeMs, Float32Array>([
    [
      BLOCK_START_MS,
      new Float32Array([BUCKET_START_MS - BLOCK_START_MS, VWAP - BASE_PRICE, 3, 0.5]),
    ],
  ]);
  return { tradesIndex, blockData };
}

function pointerAt(worldTimeMs: number) {
  return { worldTimeMs: worldTimeMs as UnixTimeMs, pointerPx: { x: 0, y: 0 } };
}

describe('findBucketsAt', () => {
  it('hits a bucket anywhere inside its one-second slot', () => {
    const { tradesIndex, blockData } = buildIndex();

    const atStart = findBucketsAt(pointerAt(BUCKET_START_MS), tradesIndex, blockData);
    const nearEnd = findBucketsAt(pointerAt(BUCKET_START_MS + 999), tradesIndex, blockData);

    expect(atStart.map(hit => hit.bucketStartMs)).toEqual([BUCKET_START_MS]);
    expect(nearEnd[0]?.bucket).toEqual({
      bucketStartMs: BUCKET_START_MS,
      vwap: VWAP,
      volumeTotal: 3,
      buyFraction: 0.5,
    });
  });

  it('misses outside the slot on both sides', () => {
    const { tradesIndex, blockData } = buildIndex();

    expect(findBucketsAt(pointerAt(BUCKET_START_MS - 1), tradesIndex, blockData)).toEqual([]);
    expect(findBucketsAt(pointerAt(BUCKET_START_MS + 1_000), tradesIndex, blockData)).toEqual([]);
  });
});
