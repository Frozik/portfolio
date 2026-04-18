import type { Milliseconds } from '@frozik/utils';
import { isNil } from 'lodash-es';

import { FLOATS_PER_TEXEL } from '../domain/constants';
import { floorToBlockStart } from '../domain/math';
import type { IBlockMeta, IQuantizedSnapshot, UnixTimeMs } from '../domain/types';

import { snapshotToLevels } from './snapshot-to-levels';

export interface IBlockFlushEvent {
  readonly block: IBlockMeta;
  readonly data: Float32Array;
  readonly isNewBlock: boolean;
  readonly addedSnapshots: number;
  /** Min `price × volume` observed across the last snapshot. `0` if no non-zero volumes. */
  readonly latestMagnitudeMin: number;
  /** Max `price × volume` observed across the last snapshot. */
  readonly latestMagnitudeMax: number;
}

export interface IBlockAccumulatorParams {
  readonly snapshotsPerBlock: number;
  readonly flushEverySnapshots: number;
  readonly snapshotSlots: number;
  readonly depth: number;
  readonly updateSpeedMs: Milliseconds;
  readonly onFlush: (event: IBlockFlushEvent) => void;
}

/**
 * Accumulates incoming orderbook snapshots into fixed-size blocks and
 * flushes them in batches of `flushEverySnapshots` to the renderer,
 * IndexedDB, and RBush via the `onFlush` callback.
 *
 * Responsibilities:
 * - lays out each snapshot into a per-block `Float32Array` (128×128×4
 *   floats, 256 KB) at the right `(snapshotIndex, levelIndex)` offset,
 * - fills `timeDelta = eventTime - firstTimestampMs` per cell,
 * - rolls over to a fresh block when `snapshotsPerBlock` is reached,
 * - exposes the active (in-progress) block for `DataController` lookups.
 *
 * Mid-price derivation lives outside this module — `DataController`
 * + `getMidPrice` recompute it on demand from block data when the
 * position controller needs to re-center the Y axis.
 */
export class BlockAccumulator {
  private readonly params: IBlockAccumulatorParams;

  private activeMeta: IBlockMeta | null = null;
  private activeData: Float32Array | null = null;
  private pendingSnapshots = 0;

  constructor(params: IBlockAccumulatorParams) {
    this.params = params;
  }

  addSnapshot(snapshot: IQuantizedSnapshot): void {
    const { snapshotsPerBlock, flushEverySnapshots, snapshotSlots, depth, updateSpeedMs, onFlush } =
      this.params;

    let latestMagnitudeMin = Number.POSITIVE_INFINITY;
    let latestMagnitudeMax = 0;
    for (const [price, volume] of snapshot.bids) {
      if (volume <= 0) {
        continue;
      }
      const magnitude = price * volume;
      if (magnitude < latestMagnitudeMin) {
        latestMagnitudeMin = magnitude;
      }
      if (magnitude > latestMagnitudeMax) {
        latestMagnitudeMax = magnitude;
      }
    }
    for (const [price, volume] of snapshot.asks) {
      if (volume <= 0) {
        continue;
      }
      const magnitude = price * volume;
      if (magnitude < latestMagnitudeMin) {
        latestMagnitudeMin = magnitude;
      }
      if (magnitude > latestMagnitudeMax) {
        latestMagnitudeMax = magnitude;
      }
    }
    if (!Number.isFinite(latestMagnitudeMin)) {
      latestMagnitudeMin = 0;
    }

    if (isNil(this.activeMeta) || this.activeMeta.count >= snapshotsPerBlock) {
      this.startNewBlock(snapshot.eventTimeMs);
    }

    const meta = this.activeMeta;
    const data = this.activeData;
    if (isNil(meta) || isNil(data)) {
      return;
    }

    const snapshotLayout = snapshotToLevels(
      snapshot,
      snapshotSlots,
      depth,
      snapshot.isInterpolated
    );
    const timeDelta = snapshot.eventTimeMs - meta.firstTimestampMs;
    const snapshotIndex = meta.count + this.pendingSnapshots;
    const baseOffset = snapshotIndex * snapshotSlots * FLOATS_PER_TEXEL;

    data.set(snapshotLayout, baseOffset);
    // Write per-cell time delta (shared across all levels of this snapshot).
    for (let levelIndex = 0; levelIndex < snapshotSlots; levelIndex++) {
      const cellOffset = baseOffset + levelIndex * FLOATS_PER_TEXEL;
      data[cellOffset] = timeDelta;
    }

    this.pendingSnapshots++;

    const reachedFlushBatch = this.pendingSnapshots >= flushEverySnapshots;
    const reachedBlockEnd = meta.count + this.pendingSnapshots >= snapshotsPerBlock;

    if (reachedFlushBatch || reachedBlockEnd) {
      const isNewBlock = meta.count === 0;
      const addedSnapshots = this.pendingSnapshots;
      meta.count += this.pendingSnapshots;
      meta.lastTimestampMs = snapshot.eventTimeMs;
      this.pendingSnapshots = 0;

      onFlush({
        block: meta,
        data,
        isNewBlock,
        addedSnapshots,
        latestMagnitudeMin,
        latestMagnitudeMax,
      });
    }

    // Suppress unused param linting; kept for future per-block rollover tuning.
    void updateSpeedMs;
  }

  getActiveBlock(): { meta: IBlockMeta; data: Float32Array } | null {
    if (isNil(this.activeMeta) || isNil(this.activeData)) {
      return null;
    }
    return { meta: this.activeMeta, data: this.activeData };
  }

  dispose(): void {
    this.activeMeta = null;
    this.activeData = null;
    this.pendingSnapshots = 0;
  }

  private startNewBlock(firstSnapshotMs: UnixTimeMs): void {
    const { snapshotsPerBlock, snapshotSlots, updateSpeedMs } = this.params;

    const blockStart = floorToBlockStart(firstSnapshotMs, snapshotsPerBlock, updateSpeedMs);

    this.activeMeta = {
      blockId: blockStart,
      firstTimestampMs: blockStart,
      lastTimestampMs: firstSnapshotMs,
      count: 0,
      textureRowIndex: undefined,
    };
    this.activeData = new Float32Array(snapshotsPerBlock * snapshotSlots * FLOATS_PER_TEXEL);
    this.pendingSnapshots = 0;
  }
}
