import type { Milliseconds } from '@frozik/utils/date/types';
import { isNil } from 'lodash-es';

import { FLOATS_PER_TEXEL } from '../domain/constants';
import type { IActiveBlockSource } from '../domain/data-controller';
import type { IBlockFlushEvent } from '../domain/flush-events';
import { floorToBlockStart } from '../domain/math';
import type { IBlockMeta, IQuantizedSnapshot, UnixTimeMs } from '../domain/types';

import { snapshotToLevels } from './snapshot-to-levels';

export interface IBlockAccumulatorParams {
  readonly snapshotsPerBlock: number;
  readonly flushEverySnapshots: number;
  readonly snapshotSlots: number;
  readonly depth: number;
  readonly updateSpeedMs: Milliseconds;
  readonly onFlush: (event: IBlockFlushEvent) => void;
}

interface IActiveBlock {
  meta: IBlockMeta;
  readonly data: Float32Array;
  pendingSnapshots: number;
}

interface IMagnitudeBounds {
  readonly min: number;
  readonly max: number;
}

/**
 * Lays incoming orderbook snapshots into fixed-size blocks (one
 * `Float32Array` of `snapshotsPerBlock × snapshotSlots` texels) and flushes
 * every `flushEverySnapshots` snapshots or when a block fills up. The
 * flushed `meta` is a fresh immutable value; `data` stays the live buffer.
 */
export class BlockAccumulator {
  private readonly params: IBlockAccumulatorParams;
  private activeBlock: IActiveBlock | undefined = undefined;

  constructor(params: IBlockAccumulatorParams) {
    this.params = params;
  }

  addSnapshot(snapshot: IQuantizedSnapshot): void {
    const { snapshotsPerBlock, flushEverySnapshots, snapshotSlots, depth, onFlush } = this.params;
    const magnitude = latestMagnitudeBounds(snapshot);

    if (isNil(this.activeBlock) || this.activeBlock.meta.count >= snapshotsPerBlock) {
      this.activeBlock = this.startNewBlock(snapshot.eventTimeMs);
    }
    const block = this.activeBlock;

    const snapshotLayout = snapshotToLevels(
      snapshot,
      snapshotSlots,
      depth,
      snapshot.isInterpolated
    );
    const timeDelta = snapshot.eventTimeMs - block.meta.firstTimestampMs;
    const snapshotIndex = block.meta.count + block.pendingSnapshots;
    const baseOffset = snapshotIndex * snapshotSlots * FLOATS_PER_TEXEL;

    block.data.set(snapshotLayout, baseOffset);
    for (let levelIndex = 0; levelIndex < snapshotSlots; levelIndex++) {
      block.data[baseOffset + levelIndex * FLOATS_PER_TEXEL] = timeDelta;
    }
    block.pendingSnapshots++;

    const reachedFlushBatch = block.pendingSnapshots >= flushEverySnapshots;
    const reachedBlockEnd = block.meta.count + block.pendingSnapshots >= snapshotsPerBlock;
    if (!reachedFlushBatch && !reachedBlockEnd) {
      return;
    }

    const isNewBlock = block.meta.count === 0;
    const addedSnapshots = block.pendingSnapshots;
    block.meta = {
      ...block.meta,
      count: block.meta.count + addedSnapshots,
      lastTimestampMs: snapshot.eventTimeMs,
    };
    block.pendingSnapshots = 0;

    onFlush({
      block: block.meta,
      data: block.data,
      isNewBlock,
      addedSnapshots,
      latestMagnitudeMin: magnitude.min,
      latestMagnitudeMax: magnitude.max,
    });
  }

  getActiveBlock(): IActiveBlockSource | undefined {
    if (isNil(this.activeBlock)) {
      return undefined;
    }
    return { meta: this.activeBlock.meta, data: this.activeBlock.data };
  }

  dispose(): void {
    this.activeBlock = undefined;
  }

  private startNewBlock(firstSnapshotMs: UnixTimeMs): IActiveBlock {
    const { snapshotsPerBlock, snapshotSlots, updateSpeedMs } = this.params;
    const blockStart = floorToBlockStart(firstSnapshotMs, snapshotsPerBlock, updateSpeedMs);

    return {
      meta: {
        blockId: blockStart,
        firstTimestampMs: blockStart,
        lastTimestampMs: firstSnapshotMs,
        count: 0,
      },
      data: new Float32Array(snapshotsPerBlock * snapshotSlots * FLOATS_PER_TEXEL),
      pendingSnapshots: 0,
    };
  }
}

/** Min/max `price × volume` over the live levels; `{0, 0}` when the snapshot carries no volume. */
function latestMagnitudeBounds(snapshot: IQuantizedSnapshot): IMagnitudeBounds {
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const [price, volume] of [...snapshot.bids, ...snapshot.asks]) {
    if (volume <= 0) {
      continue;
    }
    const magnitude = price * volume;
    min = Math.min(min, magnitude);
    max = Math.max(max, magnitude);
  }
  return { min: Number.isFinite(min) ? min : 0, max };
}
