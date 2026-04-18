import type { Milliseconds } from '@frozik/utils';
import { describe, expect, test, vi } from 'vitest';

import { FLOATS_PER_TEXEL, SNAPSHOT_SLOTS, SNAPSHOTS_PER_BLOCK } from '../domain/constants';
import type { IQuantizedSnapshot, UnixTimeMs } from '../domain/types';
import type { IBlockFlushEvent } from './block-accumulator';
import { BlockAccumulator } from './block-accumulator';

const UPDATE_SPEED_MS = 1000 as Milliseconds;
const DEPTH = 50;
const FLUSH_EVERY = 16;

function buildSnapshot(
  eventTimeMs: number,
  bidPrice = 100,
  askPrice = 101,
  isInterpolated = false
): IQuantizedSnapshot {
  return {
    eventTimeMs: eventTimeMs as UnixTimeMs,
    bids: [[bidPrice, 1]],
    asks: [[askPrice, 1]],
    isInterpolated,
  };
}

describe('BlockAccumulator', () => {
  test('flushes after flushEverySnapshots snapshots with isNewBlock=true on first flush', () => {
    const onFlush = vi.fn<(event: IBlockFlushEvent) => void>();
    const accumulator = new BlockAccumulator({
      snapshotsPerBlock: SNAPSHOTS_PER_BLOCK,
      flushEverySnapshots: FLUSH_EVERY,
      snapshotSlots: SNAPSHOT_SLOTS,
      depth: DEPTH,
      updateSpeedMs: UPDATE_SPEED_MS,
      onFlush,
    });

    // Use aligned blockStart = 0; first 16 snapshots ts 0..15000
    for (let index = 0; index < FLUSH_EVERY; index++) {
      accumulator.addSnapshot(buildSnapshot(index * 1000));
    }

    expect(onFlush).toHaveBeenCalledTimes(1);
    const event = onFlush.mock.calls[0][0];
    expect(event.isNewBlock).toBe(true);
    expect(event.addedSnapshots).toBe(FLUSH_EVERY);
    expect(event.block.count).toBe(FLUSH_EVERY);
  });

  test('second flush reports isNewBlock=false and accumulates count', () => {
    const onFlush = vi.fn<(event: IBlockFlushEvent) => void>();
    const accumulator = new BlockAccumulator({
      snapshotsPerBlock: SNAPSHOTS_PER_BLOCK,
      flushEverySnapshots: FLUSH_EVERY,
      snapshotSlots: SNAPSHOT_SLOTS,
      depth: DEPTH,
      updateSpeedMs: UPDATE_SPEED_MS,
      onFlush,
    });

    for (let index = 0; index < FLUSH_EVERY * 2; index++) {
      accumulator.addSnapshot(buildSnapshot(index * 1000));
    }

    expect(onFlush).toHaveBeenCalledTimes(2);
    expect(onFlush.mock.calls[1][0].isNewBlock).toBe(false);
    expect(onFlush.mock.calls[1][0].block.count).toBe(FLUSH_EVERY * 2);
  });

  test('closes block at snapshotsPerBlock and starts a new one on next snapshot', () => {
    const onFlush = vi.fn<(event: IBlockFlushEvent) => void>();
    const accumulator = new BlockAccumulator({
      snapshotsPerBlock: SNAPSHOTS_PER_BLOCK,
      flushEverySnapshots: FLUSH_EVERY,
      snapshotSlots: SNAPSHOT_SLOTS,
      depth: DEPTH,
      updateSpeedMs: UPDATE_SPEED_MS,
      onFlush,
    });

    for (let index = 0; index < SNAPSHOTS_PER_BLOCK; index++) {
      accumulator.addSnapshot(buildSnapshot(index * 1000));
    }

    // 128 / 16 = 8 flushes
    expect(onFlush).toHaveBeenCalledTimes(8);
    const lastEvent = onFlush.mock.calls[7][0];
    expect(lastEvent.block.count).toBe(SNAPSHOTS_PER_BLOCK);
    const firstBlockId = lastEvent.block.blockId;

    // 129th snapshot starts a new block (isNewBlock=true) with different blockId
    accumulator.addSnapshot(buildSnapshot(SNAPSHOTS_PER_BLOCK * 1000));
    // No flush yet (only 1 snapshot pending in new block); addSnapshot doesn't
    // invoke onFlush until 16 accumulate. Verify active block:
    const active = accumulator.getActiveBlock();
    expect(active).not.toBeNull();
    expect(active?.meta.blockId).not.toBe(firstBlockId);
  });

  test('writes timeDelta = eventTimeMs - firstTimestampMs into every cell of the snapshot', () => {
    const onFlush = vi.fn<(event: IBlockFlushEvent) => void>();
    const accumulator = new BlockAccumulator({
      snapshotsPerBlock: SNAPSHOTS_PER_BLOCK,
      flushEverySnapshots: FLUSH_EVERY,
      snapshotSlots: SNAPSHOT_SLOTS,
      depth: DEPTH,
      updateSpeedMs: UPDATE_SPEED_MS,
      onFlush,
    });

    // Start of a block at ts=128_000 (aligned to 128_000 boundary).
    const firstTs = 128_000;
    accumulator.addSnapshot(buildSnapshot(firstTs));
    accumulator.addSnapshot(buildSnapshot(firstTs + 1000));

    const active = accumulator.getActiveBlock();
    if (active === null) {
      throw new Error('active block should not be null');
    }
    const data = active.data;

    // Snapshot 0 cell 0: timeDelta = 0
    expect(data[0]).toBe(0);
    // Snapshot 1 cell 0: timeDelta = 1000
    const snapshot1Offset = SNAPSHOT_SLOTS * FLOATS_PER_TEXEL;
    expect(data[snapshot1Offset]).toBe(1000);
    // Same timeDelta at other cells of snapshot 1
    expect(data[snapshot1Offset + 4]).toBe(1000);
  });

  test('getActiveBlock returns current state with pending snapshots not yet flushed', () => {
    const onFlush = vi.fn<(event: IBlockFlushEvent) => void>();
    const accumulator = new BlockAccumulator({
      snapshotsPerBlock: SNAPSHOTS_PER_BLOCK,
      flushEverySnapshots: FLUSH_EVERY,
      snapshotSlots: SNAPSHOT_SLOTS,
      depth: DEPTH,
      updateSpeedMs: UPDATE_SPEED_MS,
      onFlush,
    });

    for (let index = 0; index < 5; index++) {
      accumulator.addSnapshot(buildSnapshot(index * 1000));
    }

    expect(onFlush).toHaveBeenCalledTimes(0);
    const active = accumulator.getActiveBlock();
    expect(active).not.toBeNull();
    // Not yet flushed: meta.count still 0, but data already contains 5 snapshots
    expect(active?.meta.count).toBe(0);
  });

  test('block boundaries are aligned to floor(ts / blockDuration)', () => {
    const onFlush = vi.fn<(event: IBlockFlushEvent) => void>();
    const accumulator = new BlockAccumulator({
      snapshotsPerBlock: SNAPSHOTS_PER_BLOCK,
      flushEverySnapshots: FLUSH_EVERY,
      snapshotSlots: SNAPSHOT_SLOTS,
      depth: DEPTH,
      updateSpeedMs: UPDATE_SPEED_MS,
      onFlush,
    });

    // First snapshot at ts = 5000 → blockStart = 0 (128_000 boundary, floor(5000/128000)=0)
    accumulator.addSnapshot(buildSnapshot(5000));
    const active = accumulator.getActiveBlock();
    expect(active?.meta.blockId).toBe(0);
    expect(active?.meta.firstTimestampMs).toBe(0);
  });
});
