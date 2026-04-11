import {
  FLOATS_PER_POINT,
  POINTS_PER_SLOT,
  SLOTS_PER_ROW,
  TEXTURE_INITIAL_ROWS,
  TEXTURE_MAX_ROWS,
  TEXTURE_WIDTH,
} from './constants';
import type { ITextureSlot } from './types';

const TEXTURE_FORMAT: GPUTextureFormat = 'rgba32float';

interface ISlotMetadata {
  lastUsed: number;
}

/**
 * Manages a GPU texture divided into fixed-size 256-point slots.
 * Each texture row contains 8 slots (2048 texels / 256 points per slot).
 *
 * Allocation strategy (in order):
 * 1. Free list (stack of freed slot indices)
 * 2. High-water-mark (advance if below capacity)
 * 3. Grow texture (double rows, copy data, update capacity)
 * 4. LRU eviction (find oldest slot, release, return)
 */
export class SlotAllocator {
  private readonly device: GPUDevice;
  private readonly maxRows: number;
  private readonly textureWidth: number;
  private readonly textureUsage: GPUTextureUsageFlags;
  private readonly onEvict?: (slot: ITextureSlot) => void;

  private texture: GPUTexture;
  private capacity: number;
  private highWaterMark = 0;
  private usageCounter = 0;

  private readonly freeSlots: number[] = [];
  private readonly slotMetadata = new Map<number, ISlotMetadata>();

  constructor(
    device: GPUDevice,
    initialRows: number = TEXTURE_INITIAL_ROWS,
    maxRows: number = TEXTURE_MAX_ROWS,
    textureWidth: number = TEXTURE_WIDTH,
    onEvict?: (slot: ITextureSlot) => void
  ) {
    this.device = device;
    this.maxRows = maxRows;
    this.textureWidth = textureWidth;
    this.onEvict = onEvict;
    this.capacity = initialRows;
    this.textureUsage =
      GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC;

    this.texture = device.createTexture({
      size: [textureWidth, initialRows],
      format: TEXTURE_FORMAT,
      usage: this.textureUsage,
    });
  }

  allocateSlot(): ITextureSlot | null {
    // Phase 1: free list
    if (this.freeSlots.length > 0) {
      const slotIndex = this.freeSlots.pop() as number;
      return this.registerSlot(slotIndex);
    }

    // Phase 2: high-water-mark
    const totalSlotCapacity = this.capacity * SLOTS_PER_ROW;
    if (this.highWaterMark < totalSlotCapacity) {
      const slotIndex = this.highWaterMark;
      this.highWaterMark++;
      return this.registerSlot(slotIndex);
    }

    // Phase 3: grow texture
    if (this.capacity < this.maxRows) {
      const newCapacity = Math.min(this.capacity * 2, this.maxRows);
      this.growTexture(newCapacity);
      const slotIndex = this.highWaterMark;
      this.highWaterMark++;
      return this.registerSlot(slotIndex);
    }

    // Phase 4: LRU eviction
    return this.evictAndAllocate();
  }

  writeSlotData(slot: ITextureSlot, encoded: Float32Array, pointCount: number): void {
    const texelOffset = slot.row * this.textureWidth + slot.slotIndex * POINTS_PER_SLOT;
    const column = texelOffset % this.textureWidth;
    const row = Math.floor(texelOffset / this.textureWidth);

    const bytesPerRow = this.textureWidth * FLOATS_PER_POINT * Float32Array.BYTES_PER_ELEMENT;
    const dataSlice = encoded.subarray(0, pointCount * FLOATS_PER_POINT);

    this.device.queue.writeTexture(
      { texture: this.texture, origin: [column, row, 0] },
      dataSlice,
      { bytesPerRow, rowsPerImage: 1 },
      [pointCount, 1, 1]
    );
  }

  touch(slot: ITextureSlot): void {
    const flatIndex = this.flattenSlot(slot);
    const metadata = this.slotMetadata.get(flatIndex);

    if (metadata === undefined) {
      return;
    }

    this.usageCounter++;
    metadata.lastUsed = this.usageCounter;
  }

  releaseSlot(slot: ITextureSlot): void {
    const flatIndex = this.flattenSlot(slot);
    this.slotMetadata.delete(flatIndex);
    this.freeSlots.push(flatIndex);
  }

  getTextureOffset(slot: ITextureSlot): number {
    return slot.row * this.textureWidth + slot.slotIndex * POINTS_PER_SLOT;
  }

  createView(): GPUTextureView {
    return this.texture.createView();
  }

  getCapacity(): number {
    return this.capacity;
  }

  /** Returns total number of currently allocated (non-free) slots. */
  getAllocatedSlotCount(): number {
    return this.slotMetadata.size;
  }

  /** Returns the current high-water-mark (total slots ever allocated). */
  getHighWaterMark(): number {
    return this.highWaterMark;
  }

  dispose(): void {
    this.texture.destroy();
    this.slotMetadata.clear();
    this.freeSlots.length = 0;
  }

  private registerSlot(flatIndex: number): ITextureSlot {
    this.usageCounter++;
    this.slotMetadata.set(flatIndex, { lastUsed: this.usageCounter });
    return this.unflattenSlot(flatIndex);
  }

  private evictAndAllocate(): ITextureSlot | null {
    let oldestIndex = -1;
    let oldestUsage = Number.POSITIVE_INFINITY;

    for (const [flatIndex, metadata] of this.slotMetadata) {
      if (metadata.lastUsed < oldestUsage) {
        oldestUsage = metadata.lastUsed;
        oldestIndex = flatIndex;
      }
    }

    if (oldestIndex === -1) {
      return null;
    }

    const evictedSlot = this.unflattenSlot(oldestIndex);
    this.slotMetadata.delete(oldestIndex);

    if (this.onEvict !== undefined) {
      this.onEvict(evictedSlot);
    }

    return this.registerSlot(oldestIndex);
  }

  private growTexture(newCapacity: number): void {
    const newTexture = this.device.createTexture({
      size: [this.textureWidth, newCapacity],
      format: TEXTURE_FORMAT,
      usage: this.textureUsage,
    });

    if (this.highWaterMark > 0) {
      const rowsUsed = Math.ceil(this.highWaterMark / SLOTS_PER_ROW);
      const encoder = this.device.createCommandEncoder();
      encoder.copyTextureToTexture(
        { texture: this.texture, origin: [0, 0, 0] },
        { texture: newTexture, origin: [0, 0, 0] },
        [this.textureWidth, rowsUsed, 1]
      );
      this.device.queue.submit([encoder.finish()]);
    }

    this.texture.destroy();
    this.texture = newTexture;
    this.capacity = newCapacity;
  }

  private flattenSlot(slot: ITextureSlot): number {
    return slot.row * SLOTS_PER_ROW + slot.slotIndex;
  }

  private unflattenSlot(flatIndex: number): ITextureSlot {
    return {
      row: Math.floor(flatIndex / SLOTS_PER_ROW),
      slotIndex: flatIndex % SLOTS_PER_ROW,
    };
  }
}
