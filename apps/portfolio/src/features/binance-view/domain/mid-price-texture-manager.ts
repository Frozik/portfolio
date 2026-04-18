import { LRUCache } from 'lru-cache';

import {
  MID_PRICE_SAMPLES_PER_BLOCK,
  MID_PRICE_TEXTURE_INITIAL_ROWS,
  MID_PRICE_TEXTURE_MAX_ROWS,
  MID_PRICE_TEXTURE_WIDTH,
} from './constants';
import type { UnixTimeMs } from './types';

const TEXTURE_FORMAT: GPUTextureFormat = 'rgba32float';
const TEXTURE_USAGE =
  GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC;

const FLOATS_PER_TEXEL = 4;
const SLOTS_PER_ROW = Math.floor(MID_PRICE_TEXTURE_WIDTH / MID_PRICE_SAMPLES_PER_BLOCK);

export interface IMidPriceTextureRowManagerParams {
  readonly device: GPUDevice;
  /** Called when a block is LRU-evicted so the index can clear its textureRowIndex. */
  readonly onEvict?: (blockId: UnixTimeMs) => void;
  /** Optional overrides for testing (production always uses the domain constants). */
  readonly textureWidth?: number;
  readonly samplesPerBlock?: number;
  readonly initialRows?: number;
  readonly maxRows?: number;
}

/**
 * Manages the mid-price data-texture as a fixed-width, growing-height
 * buffer partitioned into contiguous `samplesPerBlock`-texel slots —
 * one slot per mid-price block. Mirrors the pattern used by
 * `TextureRowManager` (orderbook + timeseries) but simplified: each
 * block occupies a single contiguous texel run, never multiple rows.
 *
 * Allocation order:
 *   1. Free list (previously released slots).
 *   2. High-water-mark (append a new slot if below capacity).
 *   3. Grow texture 2× (up to `maxRows`).
 *   4. LRU evict (reuse oldest slot; notifies `onEvict`).
 */
export class MidPriceTextureRowManager {
  private readonly device: GPUDevice;
  private readonly textureWidth: number;
  private readonly samplesPerBlock: number;
  private readonly slotsPerRow: number;
  private readonly maxRows: number;
  private readonly onEvict: ((blockId: UnixTimeMs) => void) | undefined;

  private texture: GPUTexture;
  private capacityRows: number;
  private highWaterMark = 0;

  private readonly freeSlots: number[] = [];
  private readonly lru: LRUCache<number, UnixTimeMs>;
  private readonly blockToSlot = new Map<UnixTimeMs, number>();

  constructor(params: IMidPriceTextureRowManagerParams) {
    this.device = params.device;
    this.textureWidth = params.textureWidth ?? MID_PRICE_TEXTURE_WIDTH;
    this.samplesPerBlock = params.samplesPerBlock ?? MID_PRICE_SAMPLES_PER_BLOCK;
    this.slotsPerRow = Math.floor(this.textureWidth / this.samplesPerBlock);
    this.capacityRows = params.initialRows ?? MID_PRICE_TEXTURE_INITIAL_ROWS;
    this.maxRows = params.maxRows ?? MID_PRICE_TEXTURE_MAX_ROWS;
    this.onEvict = params.onEvict;

    this.texture = this.device.createTexture({
      size: [this.textureWidth, this.capacityRows],
      format: TEXTURE_FORMAT,
      usage: TEXTURE_USAGE,
    });

    this.lru = new LRUCache({ max: this.capacityBlocks });
  }

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

  touch(blockId: UnixTimeMs): void {
    const slotIndex = this.blockToSlot.get(blockId);
    if (slotIndex !== undefined) {
      this.lru.get(slotIndex);
    }
  }

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
   * Write a contiguous run of samples starting at `firstSampleIndex`
   * inside the block. `data` is the accumulator's block-wide
   * Float32Array; `dataOffsetFloats` points at the first sample to
   * upload within that array.
   */
  writeSamples(
    slotIndex: number,
    firstSampleIndex: number,
    samples: number,
    data: Float32Array,
    dataOffsetFloats: number
  ): void {
    if (samples <= 0) {
      return;
    }
    const { column, row } = this.slotOriginToTexelCoord(slotIndex);
    const bytesPerRow = this.textureWidth * FLOATS_PER_TEXEL * Float32Array.BYTES_PER_ELEMENT;
    const floatsThisRun = samples * FLOATS_PER_TEXEL;

    this.device.queue.writeTexture(
      { texture: this.texture, origin: { x: column + firstSampleIndex, y: row, z: 0 } },
      data.subarray(dataOffsetFloats, dataOffsetFloats + floatsThisRun),
      { bytesPerRow, rowsPerImage: 1 },
      { width: samples, height: 1, depthOrArrayLayers: 1 }
    );
  }

  /** Return the starting texel offset (row * textureWidth + column) for a slot. */
  slotTextureOffset(slotIndex: number): number {
    const { row, column } = this.slotOriginToTexelCoord(slotIndex);
    return row * this.textureWidth + column;
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

  dispose(): void {
    this.texture.destroy();
    this.lru.clear();
    this.blockToSlot.clear();
    this.freeSlots.length = 0;
  }

  private get capacityBlocks(): number {
    return this.capacityRows * this.slotsPerRow;
  }

  private slotOriginToTexelCoord(slotIndex: number): { row: number; column: number } {
    const row = Math.floor(slotIndex / this.slotsPerRow);
    const column = (slotIndex % this.slotsPerRow) * this.samplesPerBlock;
    return { row, column };
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
    if (this.capacityRows >= this.maxRows) {
      return undefined;
    }
    const newCapacityRows = Math.min(this.capacityRows * 2, this.maxRows);
    this.growTexture(newCapacityRows);
    const slotIndex = this.highWaterMark;
    this.highWaterMark++;
    return slotIndex;
  }

  private evictAndReuseSlot(): number {
    const oldestSlot = this.lru.rkeys().next().value;
    if (oldestSlot === undefined) {
      throw new Error(
        'MidPriceTextureRowManager: cannot evict — LRU empty despite exhausted capacity'
      );
    }
    const evictedBlockId = this.lru.get(oldestSlot);
    this.lru.delete(oldestSlot);
    if (evictedBlockId !== undefined) {
      this.blockToSlot.delete(evictedBlockId);
      this.onEvict?.(evictedBlockId);
    }
    return oldestSlot;
  }

  private growTexture(newCapacityRows: number): void {
    const newTexture = this.device.createTexture({
      size: [this.textureWidth, newCapacityRows],
      format: TEXTURE_FORMAT,
      usage: TEXTURE_USAGE,
    });

    if (this.highWaterMark > 0) {
      const rowsUsed = Math.min(
        this.capacityRows,
        Math.ceil(this.highWaterMark / this.slotsPerRow)
      );
      const encoder = this.device.createCommandEncoder({ label: 'mid-price.texture.grow' });
      encoder.copyTextureToTexture(
        { texture: this.texture, origin: { x: 0, y: 0, z: 0 } },
        { texture: newTexture, origin: { x: 0, y: 0, z: 0 } },
        { width: this.textureWidth, height: rowsUsed, depthOrArrayLayers: 1 }
      );
      this.device.queue.submit([encoder.finish()]);
    }

    this.texture.destroy();
    this.texture = newTexture;
    this.capacityRows = newCapacityRows;
  }
}

export { SLOTS_PER_ROW as MID_PRICE_SLOTS_PER_ROW };
