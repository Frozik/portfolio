import { LRUCache } from 'lru-cache';

import { FLOATS_PER_TEXEL, INITIAL_GPU_BLOCKS, MAX_GPU_BLOCKS } from './constants';
import type { ITextureLayoutConfig, UnixTimeMs } from './types';

const TEXTURE_FORMAT: GPUTextureFormat = 'rgba32float';
const TEXTURE_USAGE =
  GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC;

export interface ITextureRowManagerParams {
  readonly device: GPUDevice;
  readonly layout: ITextureLayoutConfig;
  readonly initialBlocks?: number;
  readonly maxBlocks?: number;
  /** Called when a block is evicted from GPU so the owner can mark it in RBush. */
  readonly onEvict?: (blockId: UnixTimeMs) => void;
}

/**
 * Manages the GPU data-texture as a fixed-width / growing-height buffer
 * divided into contiguous `rowsPerBlock`-row slots, one per orderbook
 * block.
 *
 * Allocation order:
 *   1. Free list (previously released block slots).
 *   2. High-water-mark (append new slot if below capacity).
 *   3. Grow texture (double block capacity up to `maxBlocks`).
 *   4. LRU eviction (remove oldest accessed block, return its slot).
 */
export class TextureRowManager {
  private readonly device: GPUDevice;
  private readonly layout: ITextureLayoutConfig;
  private readonly maxBlocks: number;
  private readonly onEvict: ((blockId: UnixTimeMs) => void) | undefined;

  private texture: GPUTexture;
  private capacityBlocks: number;
  private highWaterMark = 0;

  private readonly freeSlots: number[] = [];
  private readonly lru: LRUCache<number, UnixTimeMs>;
  private readonly blockToSlot = new Map<UnixTimeMs, number>();

  constructor(params: ITextureRowManagerParams) {
    this.device = params.device;
    this.layout = params.layout;
    this.maxBlocks = params.maxBlocks ?? MAX_GPU_BLOCKS;
    this.onEvict = params.onEvict;
    this.capacityBlocks = params.initialBlocks ?? INITIAL_GPU_BLOCKS;

    this.texture = this.device.createTexture({
      size: [this.layout.textureWidth, this.capacityBlocks * this.layout.rowsPerBlock],
      format: TEXTURE_FORMAT,
      usage: TEXTURE_USAGE,
    });

    this.lru = new LRUCache({ max: this.maxBlocks });
  }

  /**
   * Reserve a slot for `blockId`. If the block already has a slot, return
   * it (updating LRU recency). Otherwise follow the 4-step strategy.
   */
  allocate(blockId: UnixTimeMs): number {
    const existing = this.blockToSlot.get(blockId);
    if (existing !== undefined) {
      this.lru.get(existing);
      return existing;
    }

    const slotIndex =
      this.popFreeSlot() ??
      this.advanceHighWaterMark() ??
      this.growAndAdvance() ??
      this.evictAndReuseSlot();

    this.blockToSlot.set(blockId, slotIndex);
    this.lru.set(slotIndex, blockId);
    return slotIndex;
  }

  /** Refresh recency for an already-allocated block. */
  touch(blockId: UnixTimeMs): void {
    const slotIndex = this.blockToSlot.get(blockId);
    if (slotIndex !== undefined) {
      this.lru.get(slotIndex);
    }
  }

  /** Release a block's slot back to the free list. */
  release(blockId: UnixTimeMs): void {
    const slotIndex = this.blockToSlot.get(blockId);
    if (slotIndex === undefined) {
      return;
    }
    this.blockToSlot.delete(blockId);
    this.lru.delete(slotIndex);
    this.freeSlots.push(slotIndex);
  }

  /**
   * Upload (partial or full) data for a block's slot starting at
   * `firstSnapshotIndex`.
   *
   * `snapshots` is the number of snapshots to write; the caller
   * provides a contiguous `Float32Array` covering those snapshots
   * starting at `dataOffsetFloats` within the array.
   */
  writeSnapshots(
    slotIndex: number,
    firstSnapshotIndex: number,
    snapshots: number,
    data: Float32Array,
    dataOffsetFloats: number
  ): void {
    const { textureWidth, rowsPerBlock, snapshotsPerRow } = this.layout;
    const snapshotSlots = textureWidth / snapshotsPerRow;
    const baseRow = slotIndex * rowsPerBlock;
    const bytesPerRow = textureWidth * FLOATS_PER_TEXEL * Float32Array.BYTES_PER_ELEMENT;

    let remaining = snapshots;
    let snapshotCursor = firstSnapshotIndex;
    let floatCursor = dataOffsetFloats;

    while (remaining > 0) {
      const rowOffsetInBlock = Math.floor(snapshotCursor / snapshotsPerRow);
      const columnSnapshot = snapshotCursor % snapshotsPerRow;
      const columnTexel = columnSnapshot * snapshotSlots;

      const snapshotsThisRow = Math.min(remaining, snapshotsPerRow - columnSnapshot);
      const texelsThisRow = snapshotsThisRow * snapshotSlots;
      const floatsThisRow = texelsThisRow * FLOATS_PER_TEXEL;

      this.device.queue.writeTexture(
        {
          texture: this.texture,
          origin: { x: columnTexel, y: baseRow + rowOffsetInBlock, z: 0 },
        },
        data.subarray(floatCursor, floatCursor + floatsThisRow),
        { bytesPerRow, rowsPerImage: 1 },
        { width: texelsThisRow, height: 1, depthOrArrayLayers: 1 }
      );

      remaining -= snapshotsThisRow;
      snapshotCursor += snapshotsThisRow;
      floatCursor += floatsThisRow;
    }
  }

  createView(): GPUTextureView {
    return this.texture.createView();
  }

  get currentCapacityBlocks(): number {
    return this.capacityBlocks;
  }

  get currentAllocatedBlocks(): number {
    return this.blockToSlot.size;
  }

  getSlotForBlock(blockId: UnixTimeMs): number | undefined {
    return this.blockToSlot.get(blockId);
  }

  dispose(): void {
    this.texture.destroy();
    this.lru.clear();
    this.blockToSlot.clear();
    this.freeSlots.length = 0;
  }

  private popFreeSlot(): number | undefined {
    return this.freeSlots.pop();
  }

  private advanceHighWaterMark(): number | undefined {
    if (this.highWaterMark >= this.capacityBlocks) {
      return undefined;
    }
    const slotIndex = this.highWaterMark;
    this.highWaterMark++;
    return slotIndex;
  }

  private growAndAdvance(): number | undefined {
    if (this.capacityBlocks >= this.maxBlocks) {
      return undefined;
    }
    const newCapacity = Math.min(this.capacityBlocks * 2, this.maxBlocks);
    this.growTexture(newCapacity);
    const slotIndex = this.highWaterMark;
    this.highWaterMark++;
    return slotIndex;
  }

  private evictAndReuseSlot(): number {
    const oldestSlot = this.lru.rkeys().next().value;
    if (oldestSlot === undefined) {
      throw new Error('TextureRowManager: cannot evict — LRU is empty despite exhausted capacity');
    }
    const evictedBlockId = this.lru.get(oldestSlot);
    this.lru.delete(oldestSlot);
    if (evictedBlockId !== undefined) {
      this.blockToSlot.delete(evictedBlockId);
      this.onEvict?.(evictedBlockId);
    }
    return oldestSlot;
  }

  private growTexture(newCapacityBlocks: number): void {
    const newTexture = this.device.createTexture({
      size: [this.layout.textureWidth, newCapacityBlocks * this.layout.rowsPerBlock],
      format: TEXTURE_FORMAT,
      usage: TEXTURE_USAGE,
    });

    if (this.highWaterMark > 0) {
      const rowsUsed = this.highWaterMark * this.layout.rowsPerBlock;
      const encoder = this.device.createCommandEncoder();
      encoder.copyTextureToTexture(
        { texture: this.texture, origin: { x: 0, y: 0, z: 0 } },
        { texture: newTexture, origin: { x: 0, y: 0, z: 0 } },
        { width: this.layout.textureWidth, height: rowsUsed, depthOrArrayLayers: 1 }
      );
      this.device.queue.submit([encoder.finish()]);
    }

    this.texture.destroy();
    this.texture = newTexture;
    this.capacityBlocks = newCapacityBlocks;
  }
}
