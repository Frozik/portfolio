import type { ISlotPoolGrowth } from '@frozik/utils/webgpu/lruSlotPool';
import { doubleSlotCapacity, LruSlotPool } from '@frozik/utils/webgpu/lruSlotPool';

import {
  FLOATS_PER_POINT,
  POINTS_PER_SLOT,
  SLOTS_PER_ROW,
  TEXTURE_INITIAL_ROWS,
  TEXTURE_MAX_ROWS,
  TEXTURE_WIDTH,
} from '../domain/constants';
import type { ISlotAllocator, ITextureSlot } from '../domain/types';

const TEXTURE_FORMAT: GPUTextureFormat = 'rgba32float';

/**
 * Manages a GPU texture divided into fixed-size 256-point slots.
 * Each texture row contains 8 slots (2048 texels / 256 points per slot).
 *
 * The allocation policy (free list → high-water-mark → grow → LRU
 * eviction) lives in the shared {@link LruSlotPool}; this class only owns
 * the texture geometry — row/slot coordinates, texel offsets and uploads.
 */
export class SlotAllocator implements ISlotAllocator {
  private readonly device: GPUDevice;
  private readonly textureWidth: number;
  private readonly textureUsage: GPUTextureUsageFlags;
  private readonly onEvict?: (slot: ITextureSlot) => void;
  private readonly pool: LruSlotPool;

  private texture: GPUTexture;

  constructor(
    device: GPUDevice,
    options: {
      initialRows?: number;
      maxRows?: number;
      textureWidth?: number;
      onEvict?: (slot: ITextureSlot) => void;
    } = {}
  ) {
    const {
      initialRows = TEXTURE_INITIAL_ROWS,
      maxRows = TEXTURE_MAX_ROWS,
      textureWidth = TEXTURE_WIDTH,
      onEvict,
    } = options;

    this.device = device;
    this.textureWidth = textureWidth;
    this.onEvict = onEvict;
    this.textureUsage =
      GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC;

    this.texture = device.createTexture({
      size: [textureWidth, initialRows],
      format: TEXTURE_FORMAT,
      usage: this.textureUsage,
    });

    this.pool = new LruSlotPool({
      initialCapacity: initialRows * SLOTS_PER_ROW,
      maxCapacity: maxRows * SLOTS_PER_ROW,
      growCapacity: doubleSlotCapacity,
      onGrow: this.handleGrow,
      onEvict: this.handleEvict,
    });
  }

  allocateSlot(): ITextureSlot | null {
    const flatIndex = this.pool.acquire();

    return flatIndex === undefined ? null : this.unflattenSlot(flatIndex);
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
    this.pool.touch(this.flattenSlot(slot));
  }

  releaseSlot(slot: ITextureSlot): void {
    this.pool.release(this.flattenSlot(slot));
  }

  getTextureOffset(slot: ITextureSlot): number {
    return slot.row * this.textureWidth + slot.slotIndex * POINTS_PER_SLOT;
  }

  createView(): GPUTextureView {
    return this.texture.createView();
  }

  /** Returns the current texture height in rows. */
  getCapacity(): number {
    return this.pool.capacity / SLOTS_PER_ROW;
  }

  /** Returns total number of currently allocated (non-free) slots. */
  getAllocatedSlotCount(): number {
    return this.pool.allocatedCount;
  }

  /** Returns the current high-water-mark (total slots ever allocated). */
  getHighWaterMark(): number {
    return this.pool.highWaterMark;
  }

  dispose(): void {
    this.texture.destroy();
    this.pool.clear();
  }

  private readonly handleEvict = (flatIndex: number): void => {
    this.onEvict?.(this.unflattenSlot(flatIndex));
  };

  private readonly handleGrow = ({ newCapacity, usedSlots }: ISlotPoolGrowth): void => {
    const newRows = newCapacity / SLOTS_PER_ROW;
    const newTexture = this.device.createTexture({
      size: [this.textureWidth, newRows],
      format: TEXTURE_FORMAT,
      usage: this.textureUsage,
    });

    if (usedSlots > 0) {
      const rowsUsed = Math.ceil(usedSlots / SLOTS_PER_ROW);
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
  };

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
